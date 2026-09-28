import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from '../server.js';

test('API local fornece saúde, questões, resultados e ranking', async t => {
  const server = createApiServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${baseUrl}/api/health`).then(response => response.json());
  assert.equal(health.status, 'ok');

  const questions = await fetch(`${baseUrl}/api/questions?area=Linguagens&quantity=2&year=2023`).then(response => response.json());
  assert.equal(questions.questions.length, 2);
  assert.ok(questions.questions.every(question => question.ano === 2023));

  const mathematics = await fetch(`${baseUrl}/api/questions?area=Matemática&quantity=50&year=2023`).then(response => response.json());
  assert.equal(mathematics.questions.length, 44);
  assert.ok(mathematics.questions.every(question => question.alternativas.every(alternative => alternative.texto || alternative.imagem)));
  assert.ok(mathematics.questions.every(question => !question.enunciado.includes('broken-image.svg')));
  assert.ok(!mathematics.questions.some(question => question.id === 'enem-2023-132'));

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
