import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApiServer } from '../server.js';

test('stress: conserva gravações concorrentes, filtros e persistência após reinício', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'performance-quest-'));
  const dataFile = path.join(directory, 'results.jsonl');
  let server = await createApiServer({ dataFile });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });

  const total = 400;
  const responses = [];
  for (let start = 0; start < total; start += 20) {
    responses.push(...await Promise.all(Array.from({ length: 20 }, (_, offset) => {
      const index = start + offset;
      return fetch(`${baseUrl}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: `Aluno ${index}`,
          className: index % 2 ? '3A' : '3B',
          registrationNumber: String(index),
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
