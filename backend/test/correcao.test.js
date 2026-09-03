import test from 'node:test';
import assert from 'node:assert/strict';
import { corrigirResposta } from '../src/correcao.js';

const questao = {
    id: 'q-1',
    area: 'Matematica',
    assunto: 'Funcoes',
    alternativas: ['A', 'B', 'C', 'D'],
    alternativaCorreta: 'B'
};

test('corrigirResposta normaliza a alternativa e registra uma resposta correta', () => {
    const resposta = corrigirResposta(questao, ' b ', 12);

    assert.deepEqual(resposta, {
        questaoId: 'q-1',
        area: 'Matematica',
        assunto: 'Funcoes',
        alternativaEscolhida: 'b',
        alternativaCorreta: 'B',
        acertou: true,
        tempoSegundos: 12
    });
});

test('corrigirResposta registra resposta incorreta', () => {
    const resposta = corrigirResposta(questao, 'A', 8);

    assert.equal(resposta.acertou, false);
    assert.equal(resposta.alternativaEscolhida, 'A');
    assert.equal(resposta.alternativaCorreta, 'B');
});

test('corrigirResposta rejeita alternativa fora da questao e tempo invalido', () => {
    assert.throws(() => corrigirResposta(questao, 'E', 10), /nao pertence/);
    assert.throws(() => corrigirResposta(questao, 'A', -1), /maior ou igual a zero/);
});
