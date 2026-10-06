import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApiServer } from '../server.js';

test('stress: conserva gravações concorrentes, filtros e persistência após reinício', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'performance-quest-'));
  const dataFile = path.join(directory, 'results.jsonl');
  const total = 400;
  let server = await createApiServer({ dataFile });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });

  const deviceIds = Array.from({ length: total }, () => randomUUID());
  const students = [];
  for (let start = 0; start < total; start += 20) {
    students.push(...await Promise.all(Array.from({ length: 20 }, (_, offset) => {
      const index = start + offset;
      return fetch(`${baseUrl}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceIds[index], studentName: `Aluno ${index}`, className: index % 2 ? '3A' : '3B', registrationNumber: String(index).padStart(3, '0') })
      });
    })));
  }
  assert.ok(students.every(response => response.status === 200));
  const profiles = await Promise.all(students.map(response => response.json()));
  const duplicateStudents = await Promise.all([0, 1, 2].map((index) => fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: randomUUID(), studentName: 'Mesmo nome', className: '3A', registrationNumber: `dup-${index}` })
  })));
  assert.equal(duplicateStudents.filter(response => response.status === 200).length, 1);
  assert.equal(duplicateStudents.filter(response => response.status === 409).length, 2);

  const responses = [];
  for (let start = 0; start < total; start += 20) {
    responses.push(...await Promise.all(Array.from({ length: 20 }, (_, offset) => {
      const index = start + offset;
      return fetch(`${baseUrl}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: `Aluno ${index}`,
          idempotencyKey: randomUUID(),
          className: index % 2 ? '3A' : '3B',
          registrationNumber: String(index).padStart(3, '0'),
          deviceId: deviceIds[index],
          studentId: profiles[index].student.id,
          score: index % 6,
          totalQuestions: 5,
          totalTimeSeconds: total - index
        })
      });
    })));
  }
  assert.ok(responses.every(response => response.status === 201));

  const rankingResponse = await fetch(`${baseUrl}/api/rankings?limit=100`);
  const ranking = await rankingResponse.json();
  assert.equal(rankingResponse.status, 200);
  assert.equal(ranking.length, 100);
  assert.ok(ranking.every((result, index) => index === 0 || ranking[index - 1].percentage >= result.percentage));

  const classRanking = await fetch(`${baseUrl}/api/rankings?className=3A&limit=100`).then(response => response.json());
  assert.equal(classRanking.length, 100);
  assert.ok(classRanking.every(result => result.className === '3A'));
  assert.equal((await fetch(`${baseUrl}/api/rankings?limit=101`)).status, 400);

  await new Promise(resolve => server.close(resolve));
  server = await createApiServer({ dataFile });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const recoveredResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/rankings?limit=100`);
  const recovered = await recoveredResponse.json();
  assert.equal(recovered.length, 100);
  assert.equal((await fs.readFile(dataFile, 'utf8')).trim().split('\n').length, total);
});

test('produção não inicia sem banco e origens CORS explícitas', async () => {
  const { spawnSync } = await import('node:child_process');
  const processResult = spawnSync(process.execPath, ['backend/server.js'], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: '', FRONTEND_ORIGIN: '' }
  });
  assert.equal(processResult.status, 1);
  assert.match(processResult.stderr, /DATABASE_URL e FRONTEND_ORIGIN/);
});

test('stress: bloqueia nomes duplicados entre dispositivos e atualiza o mesmo perfil', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'performance-quest-identities-'));
  const dataFile = path.join(directory, 'results.jsonl');
  const server = await createApiServer({ dataFile });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const first = await fetch(`${baseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', studentName: 'José da Silva', className: '3A', registrationNumber: '111' })
  });
  assert.equal(first.status, 200);
  const student = (await first.json()).student;

  const duplicate = await fetch(`${baseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', studentName: 'JOSE DA SILVA', className: '3B', registrationNumber: '222' })
  });
  assert.equal(duplicate.status, 409);

  const update = await fetch(`${baseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: student.deviceId, studentName: 'José da Silva', className: '3B', registrationNumber: '111' })
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).student.id, student.id);
});

test('stress: valida resultados ruins e respeita CORS configurado', async t => {
  const server = await createApiServer({
    store: {
      persistence: 'test',
      insert: async result => result,
      rankings: async () => []
    },
    frontendOrigins: ['https://app.example.test/', 'https://performance-quest.vercel.app/']
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (const payload of [
    {},
    { studentName: 'a'.repeat(121), className: '3A', registrationNumber: '1', score: 1, totalQuestions: 1 },
    { studentName: 'A', className: '3A', registrationNumber: '1', score: 2, totalQuestions: 1 },
    { studentName: 'A', className: '3A', registrationNumber: '1', score: 1, totalQuestions: 201 },
    { studentName: 'A', className: '3A', registrationNumber: '1', score: 1, totalQuestions: 1, totalTimeSeconds: -1 },
    { studentName: 'A', className: '3A', registrationNumber: '1', score: 1, totalQuestions: 1, answers: 'not-an-array' },
    { studentName: 'A', className: '3A', registrationNumber: '1', score: 1, totalQuestions: 1, createdAt: 'invalid' }
  ]) {
    const response = await fetch(`${baseUrl}/api/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(response.status, 400);
  }

  const denied = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(denied.status, 403);
  const allowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://app.example.test' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example.test');

  for (const origin of [
    'https://performance-quest.vercel.app',
    'https://perfomancequest-frontend.vercel.app'
  ]) {
    const productionFrontend = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });
    assert.equal(productionFrontend.status, 200);
    assert.equal(productionFrontend.headers.get('access-control-allow-origin'), origin);
  }

  const vercelPreview = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://performance-quest-feature-saymuc.vercel.app' }
  });
  assert.equal(vercelPreview.status, 200);
  assert.equal(vercelPreview.headers.get('access-control-allow-origin'), 'https://performance-quest-feature-saymuc.vercel.app');

  const unrelatedVercel = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://unrelated-project.vercel.app' }
  });
  assert.equal(unrelatedVercel.status, 403);
});

test('limita cadastro e resultados por origem', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'performance-quest-limits-'));
  const server = await createApiServer({ dataFile: path.join(directory, 'results.jsonl'), requestLimits: { students: 1, results: 1 } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = () => fetch(`${baseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: randomUUID(), studentName: `aluno ${randomUUID()}`, className: '3A', registrationNumber: randomUUID() })
  });
  const registered = await request();
  assert.equal(registered.status, 200);
  const { student } = await registered.json();
  const resultRequest = () => fetch(`${baseUrl}/api/results`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: randomUUID(), deviceId: student.deviceId, studentId: student.id, studentName: student.studentName, className: student.className, registrationNumber: student.registrationNumber, score: 1, totalQuestions: 1, totalTimeSeconds: 1 })
  });
  assert.equal((await resultRequest()).status, 201);
  assert.equal((await resultRequest()).status, 429);
  assert.equal((await request()).status, 429);
});
