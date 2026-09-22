import test from 'node:test';
import assert from 'node:assert/strict';

// Mock do ambiente de navegador para testes unitários em Node.js
if (!globalThis.window) {
    globalThis.window = {
        PERFORMANCE_QUEST_CONFIG: {
            apiBaseUrl: 'http://localhost:3001/api'
        }
    };
}

if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
    };
}

import {
    corrigirResposta,
    SessaoQuiz,
    calcularIPE,
    sugerirAssuntosPrioritarios,
    gerarResumo
} from '../js/quiz.js';

import {
    salvarDadosAluno,
    obterDadosAluno,
    temCadastroValido,
    limparDadosAluno
} from '../js/storage.js';

import {
    getApiBaseUrl,
    normalizarQuestao
} from '../js/api.js';

import { escapeHTML } from '../js/ui.js';

test('Frontend - Quiz: corrigirResposta avalia acerto e normaliza gabarito', () => {
    const q = { id: 'q1', area: 'Matemática', assunto: 'Geometria', alternativaCorreta: 'C' };
    const res = corrigirResposta(q, 'c', 15);

    assert.equal(res.acertou, true);
    assert.equal(res.alternativaEscolhida, 'C');
    assert.equal(res.alternativaCorreta, 'C');
    assert.equal(res.tempoSegundos, 15);
});

test('Frontend - Quiz: IPE prioriza maior taxa de erro e desempata por tempo médio', () => {
    const desempenho = {
        'Geometria': { total: 4, acertos: 1, tempo: 120 }, // 75% erro, tMedio = 30s
        'Funções': { total: 4, acertos: 1, tempo: 200 },   // 75% erro, tMedio = 50s
        'Estatística': { total: 4, acertos: 3, tempo: 80 }  // 25% erro
    };

    const ipe = calcularIPE(desempenho);
    assert.equal(ipe[0].assunto, 'Funções'); // Maior tempo médio com mesmo erro
    assert.equal(ipe[1].assunto, 'Geometria');
    assert.equal(ipe[2].assunto, 'Estatística');
});

test('Frontend - Storage: gerencia cadastro simples do aluno (nome, turma, matrícula)', () => {
    limparDadosAluno();
    assert.equal(temCadastroValido(), false);

    const aluno = salvarDadosAluno({
        nome: 'André Luiz',
        turma: '3a',
        matricula: '20260123'
    });

    assert.equal(aluno.nome, 'André Luiz');
    assert.equal(aluno.turma, '3A'); // Normalizado para maiúsculas
    assert.equal(aluno.matricula, '20260123');

    const recuperado = obterDadosAluno();
    assert.equal(recuperado.nome, 'André Luiz');
    assert.equal(recuperado.turma, '3A');
    assert.equal(temCadastroValido(), true);
});

test('Frontend - Storage: valida campos obrigatórios do cadastro', () => {
    assert.throws(() => salvarDadosAluno({ nome: 'A', turma: '3A', matricula: '123' }), /nome válido/i);
    assert.throws(() => salvarDadosAluno({ nome: 'André', turma: '', matricula: '123' }), /turma/i);
    assert.throws(() => salvarDadosAluno({ nome: 'André', turma: '3A', matricula: '1' }), /matrícula/i);
});

test('Frontend - API: consome url configurada em config.js', () => {
    assert.equal(getApiBaseUrl(), 'http://localhost:3001/api');
});

test('Frontend - API: normaliza questões de diferentes formatos', () => {
    const raw = {
        id: 101,
        area: 'Ciências Humanas',
        assunto: 'História do Brasil',
        statement: 'Qual o ano da Proclamação?',
        alternatives: [
            { letter: 'A', text: '1889', isCorrect: true },
            { letter: 'B', text: '1822', isCorrect: false }
        ]
    };

    const norm = normalizarQuestao(raw);
    assert.equal(norm.id, '101');
    assert.equal(norm.alternativaCorreta, 'A');
    assert.equal(norm.enunciado, 'Qual o ano da Proclamação?');
    assert.equal(norm.alternativas.length, 2);
});

test('Frontend - UI: escapeHTML previne XSS em dados externos', () => {
    const malicious = '<script>alert("xss")</script>&"\'';
    const escaped = escapeHTML(malicious);

    assert.equal(escaped.includes('<script>'), false);
    assert.equal(escaped, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;&#039;');
});
