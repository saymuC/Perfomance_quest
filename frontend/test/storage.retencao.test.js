import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarRetencaoLocal, registrarAtividadeLocal, limparDadosLocais, enfileirarResultadoPendente, obterResultadosPendentes } from '../js/storage.js';
const memoria = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: chave => memoria.get(chave) ?? null,
    setItem: (chave, valor) => memoria.set(chave, String(valor)),
    removeItem: chave => memoria.delete(chave)
} });
const dia = 86400000;
beforeEach(() => {
    memoria.clear();
    memoria.set('performance_quest_aluno', 'cadastro');
    memoria.set('performance_quest_historico', 'historico');
    memoria.set('performance_quest_device_id', 'dispositivo');
});

test('expira aos 30 dias preservando a fila e a identidade necessária ao envio', t => {
    t.mock.timers.enable({ apis: ['Date'], now: 100 * dia });
    registrarAtividadeLocal();
    const tentativa = { studentId: 'aluno', deviceId: 'dispositivo', respostas: ['A'], idempotencyKey: 'tentativa' };
    enfileirarResultadoPendente(tentativa);
    t.mock.timers.tick(30 * dia);
    assert.equal(aplicarRetencaoLocal(), true);
    assert.equal(memoria.has('performance_quest_aluno'), false);
    assert.equal(memoria.has('performance_quest_historico'), false);
    assert.equal(memoria.get('performance_quest_device_id'), 'dispositivo');
    assert.deepEqual(obterResultadosPendentes()[0].payload, tentativa);
});

test('atividade renova o prazo e expiração sem pendências remove a identificação', t => {
    t.mock.timers.enable({ apis: ['Date'], now: 100 * dia });
    registrarAtividadeLocal();
    t.mock.timers.tick(29 * dia);
    assert.equal(aplicarRetencaoLocal(), false);
    t.mock.timers.tick(29 * dia);
    assert.equal(aplicarRetencaoLocal(), false);
    t.mock.timers.tick(30 * dia);
    assert.equal(aplicarRetencaoLocal(), true);
    assert.equal(memoria.has('performance_quest_device_id'), false);
});

test('dados anteriores à política recebem prazo e exclusão explícita inclui pendências', () => {
    enfileirarResultadoPendente({ idempotencyKey: 'antiga' });
    memoria.set('outro_aplicativo', 'preservar');
    assert.equal(aplicarRetencaoLocal(), false);
    assert.equal(memoria.has('performance_quest_aluno'), true);
    limparDadosLocais();
    assert.deepEqual([...memoria.entries()], [['outro_aplicativo', 'preservar']]);
});
