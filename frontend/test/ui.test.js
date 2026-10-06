import test from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../js/ui.js';

class Elemento {
    constructor(tag) {
        this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {}; this.eventos = {};
        const classes = new Set();
        this.classList = { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) };
    }
    appendChild(el) { el.parent = this; this.children.push(el); return el; }
    append(...els) { els.forEach(el => this.appendChild(el)); }
    replaceChildren(...els) { this.children = []; this.append(...els); }
    addEventListener(tipo, callback) { this.eventos[tipo] = callback; }
    setAttribute(nome, valor) { this[nome] = valor; }
    querySelector(selector) { return this.children.find(el => selector === 'input' && el.tagName === 'INPUT'); }
    after(el) { el.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, el); }
    get nextElementSibling() { return this.parent.children[this.parent.children.indexOf(this) + 1]; }
    remove() { this.parent.children = this.parent.children.filter(el => el !== this); }
}

const elementos = new Map();
globalThis.document = {
    getElementById: id => elementos.get(id) || null,
    createElement: tag => new Elemento(tag),
    createTextNode: texto => ({ textContent: texto }),
    querySelectorAll: () => elementos.get('quiz-alternatives').children
};

function renderizarAlternativas() {
    elementos.clear();
    elementos.set('quiz-alternatives', new Elemento('div'));
    elementos.set('btn-confirmar-resposta', new Elemento('button'));
    const selecoes = [];
    UI.renderizarQuestao({ questao: { alternativas: [{ letra: 'A', imagem: '/imagem.png' }, { letra: 'B', texto: 'Texto' }] }, indice: 1, total: 1, onSelecionarAlternativa: letra => selecoes.push(letra) });
    return { opcoes: elementos.get('quiz-alternatives').children, selecoes };
}

test('imagem com falha mantém alternativa selecionável e permite recarregar', () => {
    const { opcoes, selecoes } = renderizarAlternativas();
    const imagem = opcoes[0].children.find(el => el.tagName === 'IMG');
    imagem.onerror(); imagem.onerror();
    assert.equal(opcoes.length, 2);
    assert.equal(opcoes[0].children.filter(el => el.className === 'imagem-indisponivel').length, 1);
    opcoes[0].querySelector('input').eventos.change();
    assert.deepEqual(selecoes, ['A']);
    assert.equal(elementos.get('btn-confirmar-resposta').disabled, false);
    imagem.onload();
    assert.equal(imagem.hidden, false);
    assert.equal(opcoes[0].children.filter(el => el.className === 'imagem-indisponivel').length, 0);
});

test('alternativas usam controles nativos e ficam bloqueadas após confirmar', () => {
    const { opcoes } = renderizarAlternativas();
    for (const opcao of opcoes) {
        const radio = opcao.querySelector('input');
        assert.equal(opcao.tagName, 'LABEL');
        assert.equal(radio.type, 'radio');
        assert.equal(radio.name, 'alternativa');
    }
    UI.exibirFeedback({ acertou: true, alternativaCorreta: 'A' });
    assert.ok(opcoes.every(opcao => opcao.querySelector('input').disabled));
});

test('relatório mostra todos os assuntos, inclusive os fora das três prioridades', () => {
    elementos.clear();
    const assuntos = new Elemento('div');
    const areas = new Elemento('div');
    elementos.set('subject-breakdown-container', assuntos);
    elementos.set('area-breakdown-container', areas);
    UI.renderizarRelatorio({ resumo: {}, assuntosPrioritarios: [], desempenhoPorArea: { Linguagens: { total: 0, acertos: 0 } }, desempenhoPorAssunto: {
        Geometria: { total: 2, acertos: 1 }, Álgebra: { total: 1, acertos: 1 }, Ecologia: { total: 1, acertos: 0 }, Literatura: { total: 1, acertos: 1 }
    } });
    assert.equal(assuntos.children.length, 4);
    assert.equal(assuntos.children[0].children[1].children[0].style.width, '50%');
    assert.equal(areas.children[0].children[0].children[1].children[0].textContent, 'Ainda sem respostas');
});
