import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarQuestao, registrarAlunoAPI, enviarResultadoAPI } from '../js/api.js';
import { corrigirResposta } from '../js/quiz.js';
globalThis.window = { PERFORMANCE_QUEST_CONFIG: { apiBaseUrl: 'https://teste.invalid/api' } };
const alternativas = [{ letra: 'A', texto: 'Um' }, { letra: 'B', texto: 'Dois' }];

test('recusa gabarito ausente, inexistente e alternativas duplicadas', () => {
    for (const dados of [{}, { alternativaCorreta: 'C' }, { alternativaCorreta: 'A', alternativas: [alternativas[0], alternativas[0]] }]) {
        assert.throws(() => normalizarQuestao({ id: 'q', alternativas, ...dados }), /gabarito|alternativas/i);
    }
});

test('correção direta também recusa questão sem gabarito', () => {
    assert.throws(() => corrigirResposta({ id: 'q', alternativas }, 'A', 1), /gabarito/i);
});

test('cadastro interrompe uma conexão que não responde', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    t.mock.method(globalThis, 'fetch', (url, { signal } = {}) => new Promise((resolve, reject) => {
        if (!signal) return reject(new Error('Requisição sem limite'));
        signal.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')));
    }));
    const resultado = assert.rejects(registrarAlunoAPI({}), { name: 'AbortError' });
    t.mock.timers.tick(6000);
    await resultado;
});

test('envio preserva o status e a mensagem técnica para diagnóstico interno', async t => {
    for (const status of [400, 409, 429, 500]) {
        t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Diagnóstico do envio' }, { status }));
        await assert.rejects(enviarResultadoAPI({}), erro => erro.status === status && erro.message === 'Diagnóstico do envio');
    }
});
