import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSessaoQuiz } from '../src/sessaoQuiz.js';
import { carregarHistorico } from '../src/storage.js';

class LocalStorageEmMemoria {
    constructor() {
        this.dados = new Map();
    }

    getItem(chave) {
        return this.dados.get(chave) ?? null;
    }

    setItem(chave, valor) {
        this.dados.set(chave, String(valor));
    }

    removeItem(chave) {
        this.dados.delete(chave);
    }
}

globalThis.localStorage = new LocalStorageEmMemoria();

const questao = {
    id: 'q-1',
    assunto: 'Atual',
    area: 'Matematica',
    alternativas: ['A', 'B'],
    alternativaCorreta: 'A'
};

test('nao permite criar quiz vazio ou com questoes duplicadas', () => {
    assert.throws(() => criarSessaoQuiz([]), /pelo menos uma questao/);
    assert.throws(() => criarSessaoQuiz([questao, { ...questao }]), /esta duplicada/);
});

test('nao permite responder a mesma questao duas vezes', () => {
    const sessao = criarSessaoQuiz([questao]);
    sessao.registrarResposta('q-1', 'A', 5);

    assert.throws(() => sessao.registrarResposta('q-1', 'A', 6), /ja foi respondida/);
});

test('nao permite finalizar antes de responder todas as questoes', () => {
    const sessao = criarSessaoQuiz([
        questao,
        { ...questao, id: 'q-2' }
    ]);
    sessao.registrarResposta('q-1', 'A', 5);

    assert.throws(() => sessao.finalizar(), /Responda todas as questoes/);
});

test('finalizar gera relatorio somente da tentativa atual e preserva o historico', () => {
    localStorage.setItem('performance_quest_historico', JSON.stringify([
        { questaoId: 'antiga', assunto: 'Tentativa antiga', area: 'Geral', acertou: false, tempoSegundos: 5 }
    ]));
    const sessao = criarSessaoQuiz([
        { id: 'nova-1', assunto: 'Atual', area: 'Matematica', alternativas: ['A', 'B'], alternativaCorreta: 'A' },
        { id: 'nova-2', assunto: 'Atual', area: 'Matematica', alternativas: ['A', 'B'], alternativaCorreta: 'B' }
    ]);

    sessao.registrarResposta('nova-1', 'A', 10);
    sessao.registrarResposta('nova-2', 'B', 20);
    const relatorio = sessao.finalizar();

    assert.equal(relatorio.resumo.total, 2);
    assert.equal(relatorio.resumo.acertos, 2);
    assert.deepEqual(Object.keys(relatorio.desempenhoPorAssunto), ['Atual']);
    assert.equal(carregarHistorico().length, 3);
});
