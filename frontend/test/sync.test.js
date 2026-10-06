import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../js/ui.js';
import { MENSAGENS } from '../js/mensagens.js';
import { salvarDadosAluno, obterDadosAluno, obterResultadosPendentes, enfileirarResultadoPendente } from '../js/storage.js';

const memoria = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: chave => memoria.get(chave) ?? null,
    setItem: (chave, valor) => memoria.set(chave, String(valor)),
    removeItem: chave => memoria.delete(chave)
} });
const eventos = new Map();
const botoes = new Map(['btn-iniciar-simulado', 'btn-confirmar-resposta', 'btn-proxima-questao'].map(id => [id, {
    style: {}, addEventListener: (evento, callback) => eventos.set(`${id}:${evento}`, callback)
}]));
globalThis.document = {
    getElementById: id => botoes.get(id) ?? null,
    addEventListener: (evento, callback) => eventos.set(evento, callback)
};
globalThis.window = {
    PERFORMANCE_QUEST_CONFIG: { apiBaseUrl: 'https://teste.invalid/api' },
    addEventListener: (evento, callback) => eventos.set(evento, callback)
};
let feedback;
let requisicoes;
let cadastroFalha;
let cadastroPendente;
let resultadoFalha;
let questaoAtual;
const studentId = '12345678-1234-4234-9234-123456789abc';
const questao = { id: 'q1', area: 'Matemática', assunto: 'Geometria', alternativaCorreta: 'A', alternativas: [{ letra: 'A', texto: 'Resposta' }] };
globalThis.fetch = async (url, opcoes = {}) => {
    const rota = new URL(url).pathname;
    if (rota.endsWith('/students')) {
        if (cadastroFalha) throw new Error('offline');
        if (cadastroPendente) await cadastroPendente;
        return Response.json({ student: { id: studentId } });
    }
    if (rota.endsWith('/results')) {
        requisicoes.push(JSON.parse(opcoes.body));
        if (resultadoFalha) throw new Error('offline');
        return Response.json({ success: true });
    }
    if (rota.endsWith('/questions')) return Response.json({ questions: [questaoAtual] });
    return Response.json({ status: 'ok' });
};
for (const metodo of ['ocultarErro', 'mostrarCarregando', 'ocultarCarregando', 'mostrarTela', 'atualizarTimer', 'exibirFeedback', 'renderizarRelatorio', 'renderizarRevisaoQuestoes', 'atualizarIdentificacaoAluno']) UI[metodo] = () => {};
UI.renderizarQuestao = ({ onSelecionarAlternativa }) => onSelecionarAlternativa('A');
UI.atualizarStatusSincronizacao = estado => { feedback = estado; };
await import('../js/app.js');
await eventos.get('DOMContentLoaded')();

beforeEach(t => {
    t.mock.method(console, 'warn', () => {});
    memoria.clear();
    requisicoes = [];
    cadastroFalha = false;
    cadastroPendente = null;
    resultadoFalha = false;
    feedback = null;
    questaoAtual = questao;
    salvarDadosAluno({ nome: 'Aluno Teste', turma: '3A', matricula: '123' });
});

async function concluirSimulado() {
    await eventos.get('btn-iniciar-simulado:click')();
    eventos.get('btn-confirmar-resposta:click')();
    await eventos.get('btn-proxima-questao:click')();
}

test('guarda a tentativa mesmo quando a confirmação do cadastro falha', async () => {
    cadastroFalha = true;
    await concluirSimulado();
    const fila = obterResultadosPendentes();
    assert.equal(fila.length, 1);
    assert.equal(fila[0].payload.respostas[0].questaoId, 'q1');
    assert.ok(fila[0].payload.createdAt);
    assert.equal(feedback.mensagem, MENSAGENS.pontuacaoPendente);
    assert.equal(typeof feedback.onTentarSincronizar, 'function');
});

test('reconexão envia a tentativa guardada sem exigir outro simulado', async () => {
    cadastroFalha = true;
    await concluirSimulado();
    const original = obterResultadosPendentes()[0].payload;
    cadastroFalha = false;
    await eventos.get('online')();
    assert.equal(obterResultadosPendentes().length, 0);
    assert.equal(requisicoes[0].idempotencyKey, original.idempotencyKey);
    assert.equal(requisicoes[0].createdAt, original.createdAt);
    assert.deepEqual(requisicoes[0].answers, original.respostas);
    assert.equal(feedback.status, 'synced');
});

test('reenvios preservam a tentativa e não duplicam a fila', async () => {
    resultadoFalha = true;
    await concluirSimulado();
    const original = obterResultadosPendentes()[0].payload;
    await feedback.onTentarSincronizar();
    assert.equal(obterResultadosPendentes().length, 1);
    resultadoFalha = false;
    await feedback.onTentarSincronizar();
    assert.equal(obterResultadosPendentes().length, 0);
    assert.ok(requisicoes.every(item => item.createdAt === original.createdAt));
    assert.ok(requisicoes.every(item => item.idempotencyKey === original.idempotencyKey));
});

test('não promete uma gravação local que falhou', async t => {
    t.mock.method(localStorage, 'setItem', () => { throw new Error('quota'); });
    resultadoFalha = true;
    await concluirSimulado();
    assert.equal(obterResultadosPendentes().length, 0);
    assert.equal(feedback.mensagem, MENSAGENS.pontuacaoNaoGuardada);
    assert.equal(typeof feedback.onTentarSincronizar, 'function');
});

test('mantém na fila tentativas de outra identidade', async () => {
    enfileirarResultadoPendente({ deviceId: 'outro-dispositivo', studentId: 'outro-aluno', idempotencyKey: 'outra-tentativa' });
    await eventos.get('online')();
    assert.equal(obterResultadosPendentes().length, 1);
    assert.equal(requisicoes.length, 0);
});

test('recarregar retoma uma tentativa guardada após falha de cadastro', async () => {
    cadastroFalha = true;
    await concluirSimulado();
    const original = obterResultadosPendentes()[0].payload;
    cadastroFalha = false;
    await eventos.get('DOMContentLoaded')();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(obterResultadosPendentes().length, 0);
    assert.ok(requisicoes.every(item => item.idempotencyKey === original.idempotencyKey));
    assert.ok(requisicoes.every(item => item.createdAt === original.createdAt));
    assert.ok(requisicoes.length > 0);
});

test('pendências antigas usam a data em que foram guardadas', async () => {
    enfileirarResultadoPendente({ ...obterDadosAluno(), idempotencyKey: 'tentativa-antiga', respostas: [] });
    const original = obterResultadosPendentes()[0];
    await eventos.get('online')();
    assert.equal(requisicoes[0].createdAt, original.criadoEm);
    assert.equal(obterResultadosPendentes().length, 0);
});

test('resposta atrasada da inicialização não sobrescreve o cadastro editado', async () => {
    let liberarCadastro;
    cadastroPendente = new Promise(resolve => { liberarCadastro = resolve; });
    await eventos.get('DOMContentLoaded')();
    salvarDadosAluno({ nome: 'Novo Nome', turma: '3B', matricula: '456', studentId: 'novo-aluno' });
    liberarCadastro();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(obterDadosAluno().nome, 'Novo Nome');
    assert.equal(obterDadosAluno().turma, '3B');
    assert.equal(obterDadosAluno().studentId, 'novo-aluno');
});

test('reenvio de uma tentativa antiga preserva respostas mesmo depois de outro simulado', async () => {
    resultadoFalha = true;
    await concluirSimulado();
    const original = obterResultadosPendentes()[0].payload;
    const reenviarAntiga = feedback.onTentarSincronizar;
    questaoAtual = { ...questao, id: 'q2' };
    await concluirSimulado();
    resultadoFalha = false;
    await reenviarAntiga();
    const antiga = requisicoes.filter(item => item.idempotencyKey === original.idempotencyKey).at(-1);
    assert.deepEqual(antiga.answers, original.respostas);
    assert.equal(antiga.createdAt, original.createdAt);
    assert.equal(obterResultadosPendentes().length, 0);
});
