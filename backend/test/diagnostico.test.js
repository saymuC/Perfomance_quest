import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularDesempenhoPorAssunto, calcularIPE, sugerirAssuntosPrioritarios } from '../src/diagnostico.js';

test('Top 3 nao inclui assuntos com menos de duas respostas', () => {
    const respostas = [
        { assunto: 'Algebra', acertou: false, tempoSegundos: 10 },
        { assunto: 'Geometria', acertou: true, tempoSegundos: 20 }
    ];

    assert.deepEqual(sugerirAssuntosPrioritarios(respostas), []);
});

test('tempo medio desempata, sem alterar o IPE de taxas diferentes', () => {
    const desempenho = calcularDesempenhoPorAssunto([
        { assunto: 'Taxa pior', acertou: false, tempoSegundos: 1 },
        { assunto: 'Taxa pior', acertou: true, tempoSegundos: 1 },
        { assunto: 'Taxa melhor lenta', acertou: true, tempoSegundos: 100 },
        { assunto: 'Taxa melhor lenta', acertou: true, tempoSegundos: 100 },
        { assunto: 'Empate rapido', acertou: false, tempoSegundos: 10 },
        { assunto: 'Empate rapido', acertou: true, tempoSegundos: 10 },
        { assunto: 'Empate lento', acertou: false, tempoSegundos: 30 },
        { assunto: 'Empate lento', acertou: true, tempoSegundos: 30 }
    ]);
    const ranking = calcularIPE(desempenho);

    assert.equal(ranking.find(item => item.assunto === 'Taxa pior').ipe, 0.5);
    assert.equal(ranking.find(item => item.assunto === 'Taxa melhor lenta').ipe, 0);
    assert.deepEqual(ranking.slice(0, 3).map(item => item.assunto), [
        'Empate lento',
        'Empate rapido',
        'Taxa pior'
    ]);
});
