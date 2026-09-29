import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApiServer } from '../server.js';

test('API local fornece saúde, questões, resultados e ranking', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'performance-quest-api-'));
  const server = await createApiServer({ dataFile: path.join(directory, 'results.jsonl') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${baseUrl}/api/health`).then(response => response.json());
  assert.equal(health.status, 'ok');
  assert.equal(health.persistence, 'file');

  const student = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', studentName: 'Ana', className: '3A', registrationNumber: '12345' })
  }).then(response => response.json());

  const questions = await fetch(`${baseUrl}/api/questions?area=Linguagens&quantity=2&year=2023`).then(response => response.json());
  assert.equal(questions.questions.length, 2);
  assert.ok(questions.questions.every(question => question.ano === 2023));

  const mathematics = await fetch(`${baseUrl}/api/questions?area=Matemática&quantity=50&year=2023`).then(response => response.json());
  assert.equal(mathematics.questions.length, 45);
  assert.ok(mathematics.questions.every(question => question.alternativas.some(alternative => alternative.texto || alternative.imagem)));
  assert.ok(mathematics.questions.every(question => !question.enunciado.includes('broken-image.svg')));
  assert.ok(mathematics.questions.some(question => question.id === 'enem-2023-132'));

  const year2022 = await fetch(`${baseUrl}/api/questions?area=Todas&quantity=200&year=2022`).then(response => response.json());
  assert.ok(year2022.total > 150);
  assert.ok(year2022.questions.every(question => question.ano === 2022));
  assert.ok(year2022.questions.every(question => question.enunciado && question.alternativas.length >= 4 && question.alternativaCorreta && question.explicacao));

  const allYears = await fetch(`${baseUrl}/api/questions?area=Todas&quantity=500&year=all`).then(response => response.json());
  assert.ok(allYears.total > year2022.total + 150);
  assert.deepEqual(new Set(allYears.questions.map(question => question.ano)), new Set([2022, 2023]));

  const fullQuestionSetResponse = await fetch(`${baseUrl}/api/questions?area=Todas&quantity=200&year=2023`);
  assert.equal(fullQuestionSetResponse.status, 200);
  const fullQuestionSet = await fullQuestionSetResponse.json();
  assert.equal(fullQuestionSet.questions.length, fullQuestionSet.total);
  assert.ok(fullQuestionSet.total > 50);
  assert.ok(allYears.questions.every(question => question.explicacao));
  assert.equal((await fetch(`${baseUrl}/api/questions?quantity=501&year=2023`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/questions?year=2024`)).status, 400);

  const saved = await fetch(`${baseUrl}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentName: 'Ana', className: '3A', registrationNumber: '12345', deviceId: student.student.deviceId, studentId: student.student.id, score: 4, totalQuestions: 5, totalTimeSeconds: 60 })
  });
  assert.equal(saved.status, 201);

  const ranking = await fetch(`${baseUrl}/api/rankings?className=3A`).then(response => response.json());
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].percentage, 80);

  const duplicateName = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', studentName: 'ANA', className: '3A', registrationNumber: '67890' })
  });
  assert.equal(duplicateName.status, 409);

  const recoveredProfileResponse = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: '99999999-9999-4999-8999-999999999999', studentName: 'ANA', className: '3A', registrationNumber: '12345' })
  });
  assert.equal(recoveredProfileResponse.status, 200, await recoveredProfileResponse.clone().text());
  const recoveredProfile = await recoveredProfileResponse.json();
  assert.equal(recoveredProfile.success, true);
  assert.ok(recoveredProfile.student.id);

  const recoveredWithoutKnownStudent = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: '88888888-8888-4888-8888-888888888888', studentName: 'ANA', className: '3A', registrationNumber: '12345' })
  }).then(response => response.json());
  assert.equal(recoveredWithoutKnownStudent.success, true);
  assert.ok(recoveredWithoutKnownStudent.student.id);

  const nameTakeover = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', studentName: 'ANA', className: '3A', registrationNumber: 'different-matricula' })
  });
  assert.equal(nameTakeover.status, 409);

  const duplicateNameAccent = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', studentName: 'ÁNA', className: '3A', registrationNumber: '87654' })
  });
  assert.equal(duplicateNameAccent.status, 409);

  const sameStudent = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: student.student.deviceId, studentName: 'Ana', className: '3A', registrationNumber: '12345' })
  }).then(response => response.json());
  assert.equal(sameStudent.student.id, student.student.id);

  const repeatResult = await fetch(`${baseUrl}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentName: 'Ana', className: '3A', registrationNumber: '12345', deviceId: student.student.deviceId, studentId: student.student.id, score: 5, totalQuestions: 5, totalTimeSeconds: 40 })
  });
  assert.equal(repeatResult.status, 201);
  const uniqueRanking = await fetch(`${baseUrl}/api/rankings?className=3A`).then(response => response.json());
  assert.equal(uniqueRanking.length, 1);
  assert.equal(uniqueRanking[0].score, 5);

  const editedProfile = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: student.student.deviceId, studentName: 'Ana Silva', className: '3B', registrationNumber: '12345' })
  }).then(response => response.json());
  assert.equal(editedProfile.student.id, student.student.id);
  await new Promise(resolve => server.close(resolve));
  const restartedServer = await createApiServer({ dataFile: path.join(directory, 'results.jsonl') });
  await new Promise(resolve => restartedServer.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => restartedServer.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const restartedBaseUrl = `http://127.0.0.1:${restartedServer.address().port}`;
  const sameDeviceAfterRestart = await fetch(`${restartedBaseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: student.student.deviceId, studentName: 'Ana Silva', className: '3B', registrationNumber: '12345' })
  }).then(response => response.json());
  assert.equal(sameDeviceAfterRestart.student.id, student.student.id);
  const duplicateAfterRestart = await fetch(`${restartedBaseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', studentName: 'Ana Silva', className: '3A', registrationNumber: '333' })
  });
  assert.equal(duplicateAfterRestart.status, 409);
  const movedRanking = await fetch(`${restartedBaseUrl}/api/rankings?className=3B`).then(response => response.json());
  assert.equal(movedRanking.length, 1);
  assert.equal(movedRanking[0].studentName, 'Ana Silva');

  const recoveredOnNewDevice = await fetch(`${restartedBaseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', studentName: 'Ana Silva', className: '3B', registrationNumber: '12345' })
  }).then(response => response.json());
  assert.equal(recoveredOnNewDevice.student.id, student.student.id);
  assert.equal((await fetch(`${restartedBaseUrl}/api/rankings?className=3B`).then(response => response.json())).length, 1);
});
