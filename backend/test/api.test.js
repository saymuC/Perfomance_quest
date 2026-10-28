import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createApiServer } from '../server.js';

test('saúde reflete falha posterior do banco e ranking responde sem derrubar servidor', async t => {
  let available = true;
  const server = await createApiServer({ store: {
    persistence: 'postgres',
    poolStats: { total: 0, idle: 0, waiting: 0, max: 5 },
    checkHealth: async () => { if (!available) throw new Error('tenant not found'); },
    rankings: async () => { throw new Error('tenant not found'); },
    registerStudent: async () => { throw new Error('(ENOTFOUND) tenant/user postgres.invalid not found'); }
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  available = false;
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 503);
  assert.equal((await health.json()).status, 'unavailable');
  const rankings = await fetch(`${baseUrl}/api/rankings`);
  assert.equal(rankings.status, 503);
  assert.deepEqual(await rankings.json(), { error: 'Não foi possível consultar o ranking.' });
  const registration = await fetch(`${baseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', studentName: 'Ana', className: '3° ano 1', registrationNumber: '12345' })
  });
  assert.equal(registration.status, 503);
  assert.deepEqual(await registration.json(), { error: 'Não foi possível registrar o aluno.' });
  assert.equal((await fetch(`${baseUrl}/api/questions?quantity=1`)).status, 200);
});

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

  for (const target of ['//?page=..%2f..%2f..%2f..%2f..%2fwindows/win.ini', '//interactsh.com%2f..']) {
    const response = await new Promise((resolve, reject) => {
      const socket = net.connect(server.address().port, '127.0.0.1');
      let data = '';
      socket.on('connect', () => socket.write(`GET ${target} HTTP/1.0\r\nHost: localhost\r\n\r\n`));
      socket.on('data', chunk => { data += chunk; });
      socket.on('end', () => resolve(data));
      socket.on('error', reject);
    });
    assert.match(response, /^HTTP\/1\.1 400 Bad Request/);
  }
  assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);

  const student = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', studentName: 'Ana', className: '3° ano 1', registrationNumber: '12345' })
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
  assert.equal(allYears.total, 2721);
  assert.ok(allYears.questions.every(question => question.ano >= 2009 && question.ano <= 2023));

  const oldYear = await fetch(`${baseUrl}/api/questions?area=Linguagens&quantity=200&year=2021`).then(response => response.json());
  assert.ok(oldYear.questions.length > 0);
  assert.ok(oldYear.questions.every(question => question.ano === 2021 && question.id && question.enunciado && question.alternativas.length === 5));
  assert.ok(oldYear.questions.every(question => question.alternativas.some(alternative => alternative.letra === question.alternativaCorreta)));
  assert.ok(oldYear.questions.some(question => question.id === 'enem-2021-1-espanhol' && question.explicacao));
  const oldYearAgain = await fetch(`${baseUrl}/api/questions?area=Linguagens&quantity=200&year=2021`).then(response => response.json());
  assert.notDeepEqual(oldYear.questions.map(question => question.id), oldYearAgain.questions.map(question => question.id));
  for (let year = 2009; year <= 2021; year++) {
    const response = await fetch(`${baseUrl}/api/questions?quantity=1&year=${year}`).then(result => result.json());
    assert.ok(response.total > 0, `${year}: sem questões na API`);
    assert.equal(response.questions[0].ano, year);
  }
  const year2021 = await fetch(`${baseUrl}/api/questions?quantity=200&year=2021`).then(response => response.json());
  assert.equal(year2021.total, 184);
  assert.ok(year2021.questions.every(question => question.id !== 'enem-2021-138'));
  assert.ok(year2021.questions.every(question => question.area === ['Linguagens', 'Ciências Humanas', 'Ciências da Natureza', 'Matemática'][Math.ceil(Number(question.id.match(/enem-2021-(\d+)/)[1]) / 45) - 1]));
  const year2020 = await fetch(`${baseUrl}/api/questions?quantity=200&year=2020`).then(response => response.json());
  assert.equal(year2020.total, 183);
  assert.ok(year2020.questions.every(question => question.alternativaCorreta && question.explicacao));
  assert.ok(year2020.questions.every(question => !['enem-2020-135', 'enem-2020-157'].includes(question.id)));
  const year2019 = await fetch(`${baseUrl}/api/questions?quantity=200&year=2019`).then(response => response.json());
  assert.equal(year2019.total, 184);
  assert.ok(year2019.questions.every(question => question.alternativaCorreta && question.explicacao));
  assert.ok(year2019.questions.every(question => question.id !== 'enem-2019-90'));
  assert.ok(year2019.questions.some(question => question.id === 'enem-2019-5-ingles'));
  const year2019Again = await fetch(`${baseUrl}/api/questions?quantity=200&year=2019`).then(response => response.json());
  assert.notDeepEqual(year2019.questions.map(question => question.id), year2019Again.questions.map(question => question.id));
  const year2018 = await fetch(`${baseUrl}/api/questions?quantity=200&year=2018`).then(response => response.json());
  assert.equal(year2018.total, 184);
  assert.ok(year2018.questions.every(question => question.alternativaCorreta && question.explicacao));
  assert.ok(year2018.questions.every(question => question.id !== 'enem-2018-163'));
  const year2018Again = await fetch(`${baseUrl}/api/questions?quantity=200&year=2018`).then(response => response.json());
  assert.notDeepEqual(year2018.questions.map(question => question.id), year2018Again.questions.map(question => question.id));
  const year2017 = await fetch(`${baseUrl}/api/questions?quantity=200&year=2017`).then(response => response.json());
  assert.equal(year2017.total, 185);
  assert.ok(year2017.questions.every(question => question.enunciado && question.alternativaCorreta && question.explicacao));
  const year2017Again = await fetch(`${baseUrl}/api/questions?quantity=200&year=2017`).then(response => response.json());
  assert.notDeepEqual(year2017.questions.map(question => question.id), year2017Again.questions.map(question => question.id));
  const year2016 = await fetch(`${baseUrl}/api/questions?quantity=200&year=2016`).then(response => response.json());
  assert.equal(year2016.total, 185);
  assert.ok(year2016.questions.every(question => question.enunciado && question.alternativaCorreta && question.explicacao && question.alternativas.length === 5));
  assert.ok(year2016.questions.some(question => question.id === 'enem-2016-93-espanhol'));
  assert.ok(year2016.questions.some(question => question.id === 'enem-2016-93-ingles'));
  const year2016Again = await fetch(`${baseUrl}/api/questions?quantity=200&year=2016`).then(response => response.json());
  assert.notDeepEqual(year2016.questions.map(question => question.id), year2016Again.questions.map(question => question.id));

  const fullQuestionSetResponse = await fetch(`${baseUrl}/api/questions?area=Todas&quantity=200&year=2023`);
  assert.equal(fullQuestionSetResponse.status, 200);
  const fullQuestionSet = await fullQuestionSetResponse.json();
  assert.equal(fullQuestionSet.questions.length, fullQuestionSet.total);
  assert.ok(fullQuestionSet.total > 50);
  assert.ok(allYears.questions.filter(question => question.ano >= 2022).every(question => question.explicacao));
  assert.equal((await fetch(`${baseUrl}/api/questions?quantity=501&year=2023`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/questions?year=2024`)).status, 400);

  const saved = await fetch(`${baseUrl}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: '11111111-1111-4111-8111-111111111111', studentName: 'Ana', className: '3° ano 1', registrationNumber: '12345', deviceId: student.student.deviceId, studentId: student.student.id, score: 4, totalQuestions: 5, totalTimeSeconds: 60 })
  });
  assert.equal(saved.status, 201);
  const firstSaved = await saved.json();
  const missingIdempotencyKey = await fetch(`${baseUrl}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentName: 'Ana', className: '3° ano 1', registrationNumber: '12345', deviceId: student.student.deviceId, studentId: student.student.id, score: 4, totalQuestions: 5, totalTimeSeconds: 60 })
  });
  assert.equal(missingIdempotencyKey.status, 400);

  const ranking = await fetch(`${baseUrl}/api/rankings?className=3° ano 1`).then(response => response.json());
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].percentage, 80);

  const duplicateName = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', studentName: 'ANA', className: '3° ano 1', registrationNumber: '67890' })
  });
  assert.equal(duplicateName.status, 409);

  const recoveredProfileResponse = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: '99999999-9999-4999-8999-999999999999', studentName: 'ANA', className: '3° ano 1', registrationNumber: '12345' })
  });
  assert.equal(recoveredProfileResponse.status, 200, await recoveredProfileResponse.clone().text());
  const recoveredProfile = await recoveredProfileResponse.json();
  assert.equal(recoveredProfile.success, true);
  assert.ok(recoveredProfile.student.id);

  const recoveredWithoutKnownStudent = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: '88888888-8888-4888-8888-888888888888', studentName: 'ANA', className: '3° ano 1', registrationNumber: '12345' })
  }).then(response => response.json());
  assert.equal(recoveredWithoutKnownStudent.success, true);
  assert.ok(recoveredWithoutKnownStudent.student.id);

  const nameTakeover = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', studentName: 'ANA', className: '3° ano 1', registrationNumber: 'different-matricula' })
  });
  assert.equal(nameTakeover.status, 409);

  const duplicateNameAccent = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', studentName: 'ÁNA', className: '3° ano 1', registrationNumber: '87654' })
  });
  assert.equal(duplicateNameAccent.status, 409);

  const sameStudent = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: student.student.deviceId, studentName: 'Ana', className: '3° ano 1', registrationNumber: '12345' })
  }).then(response => response.json());
  assert.equal(sameStudent.student.id, student.student.id);

  const repeatResult = await fetch(`${baseUrl}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: '22222222-2222-4222-8222-222222222222', studentName: 'Ana', className: '3° ano 1', registrationNumber: '12345', deviceId: student.student.deviceId, studentId: student.student.id, score: 5, totalQuestions: 5, totalTimeSeconds: 40 })
  });
  assert.equal(repeatResult.status, 201);
  const secondSaved = await repeatResult.json();
  const replay = await fetch(`${baseUrl}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: '22222222-2222-4222-8222-222222222222', studentName: 'Ana', className: '3° ano 1', registrationNumber: '12345', deviceId: student.student.deviceId, studentId: student.student.id, score: 5, totalQuestions: 5, totalTimeSeconds: 40 })
  });
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).result.id, secondSaved.result.id);
  assert.equal((await fs.readFile(path.join(directory, 'results.jsonl'), 'utf8')).trim().split('\n').length, 2);
  const conflictingReplay = await fetch(`${baseUrl}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: '22222222-2222-4222-8222-222222222222', studentName: 'Ana', className: '3° ano 1', registrationNumber: '12345', deviceId: student.student.deviceId, studentId: student.student.id, score: 3, totalQuestions: 5, totalTimeSeconds: 40 })
  });
  assert.equal(conflictingReplay.status, 409);
  assert.notEqual(firstSaved.result.id, secondSaved.result.id);
  const uniqueRanking = await fetch(`${baseUrl}/api/rankings?className=3° ano 1`).then(response => response.json());
  assert.deepEqual(Object.keys(uniqueRanking[0]).sort(), ['studentId', 'studentName', 'className', 'score', 'totalQuestions', 'percentage', 'totalTimeSeconds', 'createdAt'].sort());
  assert.equal(uniqueRanking.length, 1);
  assert.equal(uniqueRanking[0].score, 5);

  const editedProfile = await fetch(`${baseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: student.student.deviceId, studentName: 'Ana Silva', className: '3° ano 2', registrationNumber: '12345' })
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
    body: JSON.stringify({ deviceId: student.student.deviceId, studentName: 'Ana Silva', className: '3° ano 2', registrationNumber: '12345' })
  }).then(response => response.json());
  assert.equal(sameDeviceAfterRestart.student.id, student.student.id);
  const duplicateAfterRestart = await fetch(`${restartedBaseUrl}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', studentName: 'Ana Silva', className: '3° ano 1', registrationNumber: '333' })
  });
  assert.equal(duplicateAfterRestart.status, 409);
  const movedRanking = await fetch(`${restartedBaseUrl}/api/rankings?className=3° ano 2`).then(response => response.json());
  assert.equal(movedRanking.length, 1);
  assert.equal(movedRanking[0].studentName, 'Ana Silva');

  const recoveredOnNewDevice = await fetch(`${restartedBaseUrl}/api/students`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', studentName: 'Ana Silva', className: '3° ano 2', registrationNumber: '12345' })
  }).then(response => response.json());
  assert.equal(recoveredOnNewDevice.student.id, student.student.id);
  assert.equal((await fetch(`${restartedBaseUrl}/api/rankings?className=3° ano 2`).then(response => response.json())).length, 1);
});
