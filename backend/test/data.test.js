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

test('2020 contém todas as questões e separa as duas anuladas', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(dataDir, 'questoes_enem_2020.json'), 'utf8'));
  assert.equal(questions.length, 185);
  assert.ok(Array.from({ length: 180 }, (_, index) => index + 1).every(index => questions.some(question => question.index === index)));
  assert.ok(questions.every(question => question.explicacao && question.alternatives.length === 5));
  assert.deepEqual(questions.filter(question => question.anulada).map(question => question.index), [135, 157]);
  assert.equal(questions.find(question => question.index === 140).alternatives[2].text, '3 caixas do tipo A e 2 caixas do tipo B.');
});

test('2019 contém todas as questões e separa a anulada', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(dataDir, 'questoes_enem_2019.json'), 'utf8'));
  assert.equal(questions.length, 185);
  assert.ok(Array.from({ length: 180 }, (_, index) => index + 1).every(index => questions.some(question => question.index === index)));
  assert.ok(questions.every(question => question.explicacao && question.alternatives.length === 5));
  assert.deepEqual(questions.filter(question => question.anulada).map(question => question.index), [90]);
  assert.equal(questions.filter(question => question.index <= 5 && question.language === 'ingles').length, 5);
});

test('2018 contém todas as questões e separa a anulada', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(dataDir, 'questoes_enem_2018.json'), 'utf8'));
  assert.equal(questions.length, 185);
  assert.ok(Array.from({ length: 180 }, (_, index) => index + 1).every(index => questions.some(question => question.index === index)));
  assert.ok(questions.every(question => question.explicacao && question.alternatives.length === 5));
  assert.deepEqual(questions.filter(question => question.anulada).map(question => question.index), [163]);
  assert.equal(questions.find(question => question.index === 15).alternativaCorreta, 'D');
  const images = questions.flatMap(question => [
    ...[...`${question.context} ${question.alternativesIntroduction}`.matchAll(/!\[[^\]]*\]\((\.\/assets\/[^)]+)\)/g)].map(match => match[1]),
    ...question.alternatives.map(alternative => alternative.file).filter(Boolean)
  ]);
  assert.ok(images.length > 200);
  assert.ok(images.every(image => image.startsWith('./assets/') && fs.existsSync(path.join(dataDir, '../../frontend', image))));
});

test('2017 contém todas as questões, explicações e imagens locais', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(dataDir, 'questoes_enem_2017.json'), 'utf8'));
  assert.equal(questions.length, 185);
  assert.ok(Array.from({ length: 180 }, (_, index) => index + 1).every(index => questions.some(question => question.index === index)));
  assert.ok(questions.every(question => question.context && question.explicacao && question.alternatives.length === 5));
  const images = questions.flatMap(question => [
    ...[...`${question.context} ${question.alternativesIntroduction}`.matchAll(/!\[[^\]]*\]\((\.\/assets\/[^)]+)\)/g)].map(match => match[1]),
    ...question.alternatives.map(alternative => alternative.file).filter(Boolean)
  ]);
  assert.ok(images.length > 100);
  assert.ok(images.every(image => image.startsWith('./assets/') && fs.existsSync(path.join(dataDir, '../../frontend', image))));
  assert.equal(questions.find(question => question.index === 175).alternativaCorreta, 'A');
  assert.equal(questions.find(question => question.index === 179).alternativaCorreta, 'C');
  assert.equal(questions.find(question => question.index === 180).alternativaCorreta, 'D');
});

test('2016 contém 180 índices, duas línguas, explicações e imagens locais', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(dataDir, 'questoes_enem_2016.json'), 'utf8'));
  assert.equal(questions.length, 185);
  assert.ok(Array.from({ length: 180 }, (_, index) => index + 1).every(index => questions.some(question => question.index === index)));
  assert.ok(questions.every(question => question.context && question.explicacao && question.alternatives.length === 5));
  for (let index = 91; index <= 95; index++) {
    assert.deepEqual(questions.filter(question => question.index === index).map(question => question.language).sort(), ['espanhol', 'ingles']);
  }
  const images = questions.flatMap(question => [
    ...[...`${question.context} ${question.alternativesIntroduction}`.matchAll(/!\[[^\]]*\]\((\.\/assets\/[^)]+)\)/g)].map(match => match[1]),
    ...question.alternatives.map(alternative => alternative.file).filter(Boolean),
    ...question.files
  ]);
  assert.ok(images.length > 100);
  assert.ok(images.every(image => image.startsWith('./assets/') && fs.existsSync(path.join(dataDir, '../../frontend', image))));
  assert.deepEqual(questions.find(question => question.index === 47).alternatives.map(alternative => alternative.text), ['0', '1,18', '116,96', '816,96', '13 183,04']);
  assert.ok(questions.filter(question => question.index >= 46 && question.index <= 90).every(question => question.discipline === 'ciencias-natureza'));
  assert.match(questions.find(question => question.index === 136).context, /20 m³/);
  assert.match(questions.find(question => question.index === 139).context, /6 000 L/);
  assert.match(questions.find(question => question.index === 180).context, /9,0/);
});
