import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data');

test('arquivos anuais contêm questões únicas do ano correspondente', () => {
  for (let year = 2009; year <= 2021; year++) {
    const questions = JSON.parse(fs.readFileSync(path.join(dataDir, `questoes_enem_${year}.json`), 'utf8'));
    assert.ok(questions.length > 0, `${year}: arquivo vazio`);
    assert.ok(questions.every(question => question.year === year), `${year}: ano incorreto`);
    assert.equal(new Set(questions.map(question => `${question.index}-${question.language || ''}`)).size, questions.length, `${year}: questão duplicada`);
    for (const question of questions) {
      assert.equal(question.alternativaCorreta, question.correctAlternative, `${year}/${question.index}: gabarito divergente`);
      if (question.anulada) {
        assert.equal(question.alternativaCorreta, null);
        assert.ok(question.explicacao);
        assert.ok(question.alternatives.every(alternative => !alternative.isCorrect));
        continue;
      }
      assert.equal(question.alternatives.filter(alternative => alternative.isCorrect).length, 1, `${year}/${question.index}: alternativas corretas inválidas`);
      assert.ok(question.alternatives.some(alternative => alternative.letter === question.alternativaCorreta && alternative.isCorrect), `${year}/${question.index}: gabarito sem alternativa`);
    }
  }
});

test('gabaritos corrigidos de 2021 e questão anulada seguem o Inep', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(dataDir, 'questoes_enem_2021.json'), 'utf8'));
  assert.ok(questions.every(item => item.explicacao && item.alternatives.length === 5));
  for (const [index, correct] of [[15, 'D'], [25, 'B'], [38, 'C'], [53, 'B'], [139, 'E'], [145, 'C'], [152, 'E']]) {
    const question = questions.find(item => item.index === index && !item.language);
    assert.equal(question.alternativaCorreta, correct, `2021/${index}`);
    assert.ok(question.explicacao, `2021/${index}: sem explicação`);
  }
  assert.equal(questions.find(item => item.index === 138).anulada, true);
  const magneticQuestion = questions.find(item => item.index === 105);
  assert.deepEqual(magneticQuestion.alternatives.map(item => item.letter), ['A', 'B', 'C', 'D', 'E']);
  assert.match(magneticQuestion.alternatives[0].text, /positiva aponta para baixo/);
  assert.equal(magneticQuestion.alternatives[0].isCorrect, true);
  assert.equal(questions.find(item => item.index === 147).alternatives[2].text, 'D, H, R e V.');
  assert.match(questions.find(item => item.index === 165).context, /a cada 20 km/);
});
