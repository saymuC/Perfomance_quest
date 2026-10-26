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
const botoes = new Map(['btn-iniciar-simulado', 'btn-confirmar-resposta', 'btn-proxima-questao', 'ranking-filtro-turma', 'form-cadastro-aluno', 'form-modal-aluno'].map(id => [id, {
    style: {}, addEventListener: (evento, callback) => eventos.set(`${id}:${evento}`, callback)
}]));
globalThis.document = {
    getElementById: id => botoes.get(id) ?? null,
    querySelectorAll: () => [],
    querySelector: () => null,
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

test('envia a tentativa da identidade original após troca do cadastro', async () => {
    enfileirarResultadoPendente({ deviceId: 'outro-dispositivo', studentId: 'outro-aluno', idempotencyKey: 'outra-tentativa' });
    const atual = obterDadosAluno();
    await eventos.get('online')();
    assert.equal(obterResultadosPendentes().length, 0);
    assert.equal(requisicoes[0].studentId, 'outro-aluno');
    assert.equal(requisicoes[0].deviceId, 'outro-dispositivo');
    assert.deepEqual(obterDadosAluno(), atual);
});

test('rejeição permanente não bloqueia outras tentativas nem se repete automaticamente', async t => {
    const { sincronizarPendencias } = await import('../js/sync.js');
    let enviosRuins = 0;
    t.mock.method(globalThis, 'fetch', async (url, opcoes) => {
        const payload = JSON.parse(opcoes.body);
        if (payload.idempotencyKey === 'ruim') {
            enviosRuins++;
            return Response.json({ error: 'Invalid result' }, { status: 400 });
        }
        return Response.json({ success: true });
    });
    for (const idempotencyKey of ['ruim', 'boa']) enfileirarResultadoPendente({ studentId, deviceId: 'dispositivo', idempotencyKey });
    await sincronizarPendencias();
    assert.equal(obterResultadosPendentes().length, 1);
    assert.equal(obterResultadosPendentes()[0].requerAtencao, true);
    await sincronizarPendencias();
    assert.equal(enviosRuins, 1);
    await sincronizarPendencias(undefined, true);
    assert.equal(enviosRuins, 2);
});

test('tentativa confirmada continua enviável sem cadastro local', async () => {
    const { limparDadosAluno } = await import('../js/storage.js');
    enfileirarResultadoPendente({ studentId, deviceId: 'original', idempotencyKey: 'preservada' });
    limparDadosAluno();
    await eventos.get('online')();
    assert.equal(obterResultadosPendentes().length, 0);
    assert.equal(requisicoes[0].deviceId, 'original');
});

test('limite de envios mantém a tentativa disponível para nova reconexão', async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Rate limit' }, { status: 429 }));
    enfileirarResultadoPendente({ studentId, deviceId: 'original', idempotencyKey: 'limitada' });
    await eventos.get('online')();
    assert.equal(obterResultadosPendentes().length, 1);
    assert.equal(obterResultadosPendentes()[0].requerAtencao, undefined);
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

test('ranking ignora a resposta atrasada do filtro anterior', async t => {
    const respostas = new Map();
    t.mock.method(globalThis, 'fetch', url => new Promise(resolve => respostas.set(new URL(url).searchParams.get('className'), resolve)));
    const renderizados = [];
    t.mock.method(UI, 'renderizarRanking', dados => renderizados.push(dados));
    const antiga = eventos.get('ranking-filtro-turma:change')({ target: { value: '3A' } });
    await new Promise(resolve => setImmediate(resolve));
    const atual = eventos.get('ranking-filtro-turma:change')({ target: { value: '3B' } });
    await new Promise(resolve => setImmediate(resolve));
    respostas.get('3B')(Response.json([{ className: '3B' }]));
    await atual;
    respostas.get('3A')(Response.json([{ className: '3A' }]));
    await antiga;
    assert.deepEqual(renderizados.map(item => item.turmaSelecionada), ['3B']);
});

test('os dois formulários usam mensagem amigável para nome duplicado', async t => {
    const alertas = [];
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'HTTP backend 409' }, { status: 409 }));
    globalThis.alert = mensagem => alertas.push(mensagem);
    for (const formulario of ['form-cadastro-aluno', 'form-modal-aluno']) {
        await eventos.get(`${formulario}:submit`)({ preventDefault() {} });
    }
    assert.deepEqual(alertas, [MENSAGENS.nomeJaCadastrado, MENSAGENS.nomeJaCadastrado]);
});

test('atalhos de alternativas funcionam com foco no radio e não capturam digitação', t => {
    let cliques = 0;
    const radio = { tagName: 'INPUT', type: 'radio', focus() {} };
    const opcao = { classList: { contains: () => false }, click() { cliques++; }, querySelector: () => radio };
    botoes.set('screen-quiz', { classList: { contains: () => true } });
    t.after(() => { botoes.delete('screen-quiz'); delete document.activeElement; });
    t.mock.method(document, 'querySelector', seletor => seletor === 'dialog[open]' ? null : opcao);
    document.activeElement = radio;
    eventos.get('keydown')({ key: 'b' });
    assert.equal(cliques, 1);
    document.activeElement = { tagName: 'INPUT', type: 'text' };
    eventos.get('keydown')({ key: 'a' });
    assert.equal(cliques, 1);
});

test('histórico informa a retenção e só apaga pendências após confirmação explícita', async t => {
    const criarElemento = () => ({ style: {}, children: [], appendChild(filho) { this.children.push(filho); }, replaceChildren() { this.children = []; } });
    const container = criarElemento();
    const modal = { open: false, showModal() { this.open = true; } };
    botoes.set('history-content', container);
    botoes.set('modal-history', modal);
    botoes.set('btn-ver-historico', { addEventListener: (nome, callback) => eventos.set(`historico:${nome}`, callback) });
    t.after(() => { for (const id of ['history-content', 'modal-history', 'btn-ver-historico']) botoes.delete(id); });
    document.createElement = criarElemento;
    let recargas = 0;
    window.location = { reload() { recargas++; } };
    globalThis.confirm = () => false;
    await eventos.get('DOMContentLoaded')();
    await new Promise(resolve => setImmediate(resolve));
    enfileirarResultadoPendente({ idempotencyKey: 'preservar' });
    eventos.get('historico:click')();
    assert.ok(container.children.some(item => item.textContent === MENSAGENS.retencaoDados));
    const apagar = container.children.at(-1);
    assert.equal(apagar.textContent, MENSAGENS.apagarDadosAparelho);
    apagar.onclick();
    assert.equal(obterResultadosPendentes().length, 1);
    globalThis.confirm = mensagem => { assert.equal(mensagem, MENSAGENS.confirmarApagarDados); return true; };
    apagar.onclick();
    assert.equal(obterResultadosPendentes().length, 0);
    assert.equal(obterDadosAluno(), null);
    assert.equal(recargas, 1);
});
