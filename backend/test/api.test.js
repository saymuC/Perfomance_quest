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

  const questions = await fetch(`${baseUrl}/api/questions?area=Linguagens&quantity=2&year=2023`).then(response => response.json());
  assert.equal(questions.questions.length, 2);
  assert.ok(questions.questions.every(question => question.ano === 2023));

  const mathematics = await fetch(`${baseUrl}/api/questions?area=Matemática&quantity=50&year=2023`).then(response => response.json());
  assert.equal(mathematics.questions.length, 44);
  assert.ok(mathematics.questions.every(question => question.alternativas.every(alternative => alternative.texto || alternative.imagem)));
  assert.ok(mathematics.questions.every(question => !question.enunciado.includes('broken-image.svg')));
  assert.ok(!mathematics.questions.some(question => question.id === 'enem-2023-132'));

  const fullQuestionSetResponse = await fetch(`${baseUrl}/api/questions?area=Todas&quantity=200&year=2023`);
  assert.equal(fullQuestionSetResponse.status, 200);
  const fullQuestionSet = await fullQuestionSetResponse.json();
  assert.equal(fullQuestionSet.questions.length, fullQuestionSet.total);
  assert.ok(fullQuestionSet.total > 50);
  assert.equal((await fetch(`${baseUrl}/api/questions?quantity=201&year=2023`)).status, 400);

  const saved = await fetch(`${baseUrl}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentName: 'Ana', className: '3A', registrationNumber: '12345', score: 4, totalQuestions: 5, totalTimeSeconds: 60 })
  });
  assert.equal(saved.status, 201);

  const ranking = await fetch(`${baseUrl}/api/rankings?className=3A`).then(response => response.json());
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].percentage, 80);
});
