import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApiServer } from '../server.js';
import { createPostgresStore } from '../src/resultStore.js';

test('PostgreSQL load: concorrência gradual sem erros ou gravações perdidas', {
  skip: process.env.PG_LOAD_TEST_DATABASE_URL ? false : 'Configure PG_LOAD_TEST_DATABASE_URL no .env com a URL de um banco PostgreSQL de teste.'
}, async t => {
  const { Client } = await import('pg');
  const connectionString = process.env.PG_LOAD_TEST_DATABASE_URL;
  const store = await createPostgresStore(connectionString, process.env.DATABASE_SSL === 'true');
  const server = await createApiServer({ store, requestLimits: { students: 100_000, results: 100_000 } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const total = Number(process.env.PG_LOAD_TOTAL || 100);
  const stages = (process.env.PG_LOAD_CONCURRENCY || '1,5,10,25').split(',').map(Number);
  const insertedKeys = [];

  for (const concurrency of stages) {
    assert.ok(Number.isInteger(concurrency) && concurrency > 0);
    const latencies = [];
    const failures = [];
    let next = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (next < total) {
        const index = next++;
        const startedAt = performance.now();
        const deviceId = randomUUID();
        const idempotencyKey = randomUUID();
        try {
          const registered = await fetch(`${baseUrl}/api/students`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, studentName: `load-${randomUUID()}`, className: 'LOAD', registrationNumber: randomUUID() })
          });
          const profile = await registered.json();
          if (!registered.ok) throw new Error(`cadastro HTTP ${registered.status}: ${profile.error}`);
          const result = await fetch(`${baseUrl}/api/results`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idempotencyKey, deviceId, studentId: profile.student.id, studentName: profile.student.studentName, className: 'LOAD', registrationNumber: profile.student.registrationNumber, score: 1, totalQuestions: 1, totalTimeSeconds: 1 })
          });
          const saved = await result.json();
          if (!result.ok) throw new Error(`resultado HTTP ${result.status}: ${saved.error}`);
          insertedKeys.push(idempotencyKey);
        } catch (error) {
          failures.push(error.message);
        } finally {
          latencies.push(performance.now() - startedAt);
        }
      }
    });
    await Promise.all(workers);
    latencies.sort((a, b) => a - b);
    const percentile = p => Math.round(latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)] || 0);
    console.log(JSON.stringify({ type: 'postgres_load_stage', concurrency, attempts: total, errors: failures.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: Math.round(latencies.at(-1) || 0) }));
    assert.deepEqual(failures, []);
  }

  const duplicateName = `load-duplicate-${randomUUID()}`;
  const duplicateRegistrations = await Promise.all(Array.from({ length: 10 }, (_, index) => fetch(`${baseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: randomUUID(), studentName: duplicateName, className: 'LOAD', registrationNumber: `duplicate-${index}` })
  })));
  assert.equal(duplicateRegistrations.filter(response => response.status === 200).length, 1);
  assert.equal(duplicateRegistrations.filter(response => response.status === 409).length, 9);

  const competingDevice = randomUUID();
  const existingDeviceRegistration = `load-device-existing-${randomUUID()}`;
  const existingDeviceProfile = await fetch(`${baseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: competingDevice, studentName: existingDeviceRegistration, className: 'LOAD', registrationNumber: randomUUID() })
  });
  assert.equal(existingDeviceProfile.status, 200);
  const sameDeviceNames = ['load-device-one', 'load-device-two'];
  const sameDeviceRegistrations = await Promise.all(sameDeviceNames.map(studentName => fetch(`${baseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: competingDevice, studentName, className: 'LOAD', registrationNumber: `other-${studentName}` })
  })));
  assert.ok(sameDeviceRegistrations.every(response => response.status === 409));
  const { rows: deviceCount } = await (async () => {
    const client = new Client({ connectionString, ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}) });
    await client.connect();
    try { return await client.query('SELECT count(*)::int AS count FROM public.student_profiles WHERE device_id = $1', [competingDevice]); }
    finally { await client.end(); }
  })();
  assert.equal(deviceCount[0].count, 1, 'requisições simultâneas do mesmo dispositivo devem manter um perfil único');

  const deviceId = randomUUID();
  const registered = await fetch(`${baseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, studentName: `retry-${randomUUID()}`, className: 'LOAD', registrationNumber: randomUUID() })
  });
  const { student } = await registered.json();
  const idempotencyKey = randomUUID();
  const retryPayload = { idempotencyKey, deviceId, studentId: student.id, studentName: student.studentName, className: student.className, registrationNumber: student.registrationNumber, score: 1, totalQuestions: 1, totalTimeSeconds: 1 };
  const retries = await Promise.all([1, 2].map(() => fetch(`${baseUrl}/api/results`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(retryPayload)
  })));
  const retryResults = await Promise.all(retries.map(response => response.json()));
  assert.ok(retries.every(response => response.status === 201));
  assert.equal(retryResults[0].result.id, retryResults[1].result.id, 'reenvios concorrentes devem retornar a mesma tentativa');
  insertedKeys.push(idempotencyKey);

  const client = new Client({ connectionString, ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}) });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT count(*)::int AS count FROM public.quiz_results WHERE idempotency_key = ANY($1::uuid[])', [insertedKeys]);
    assert.equal(rows[0].count, total * stages.length + 1, 'todas as tentativas aceitas devem existir uma única vez no PostgreSQL');
  } finally {
    await client.end();
  }
});
