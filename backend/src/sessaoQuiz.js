import { corrigirResposta } from './correcao.js';
import { salvarHistorico } from './storage.js';
import { gerarRelatorioCompleto } from './relatorios.js';

// Controla uma tentativa completa do quiz.
export class SessaoQuiz {
    constructor(questoes) {
        if (!Array.isArray(questoes)) {
            throw new TypeError('As questoes do quiz devem ser uma lista.');
        }

        this.questoes = new Map();
        this.respostas = [];
        this.finalizada = false;

        questoes.forEach(questao => {
            if (!questao || questao.id === undefined || questao.id === null || questao.id === '') {
                throw new Error('Todas as questoes precisam ter um id.');
            }

            const id = String(questao.id);
            if (this.questoes.has(id)) {
                throw new Error(`A questao ${questao.id} esta duplicada.`);
            }

            this.questoes.set(id, questao);
        });
    }

    registrarResposta(questaoId, alternativaMarcada, tempoSegundos) {
        if (this.finalizada) {
            throw new Error('A sessao do quiz ja foi finalizada.');
        }

        const id = String(questaoId);
        const questao = this.questoes.get(id);
        if (!questao) {
            throw new Error('A questao informada nao pertence a esta sessao.');
        }

        if (this.respostas.some(resposta => String(resposta.questaoId) === id)) {
            throw new Error('Esta questao ja foi respondida.');
        }

        const resposta = corrigirResposta(questao, alternativaMarcada, tempoSegundos);
        this.respostas.push(resposta);
        return resposta;
    }

    obterProgresso() {
        const total = this.questoes.size;
        const respondidas = this.respostas.length;

        return {
            questaoAtual: total === 0 ? 0 : Math.min(respondidas + 1, total),
            total,
            respondidas
        };
    }

    obterRespostas() {
        return [...this.respostas];
    }

    finalizar() {
        if (this.finalizada) {
            throw new Error('A sessao do quiz ja foi finalizada.');
        }

        if (this.respostas.length !== this.questoes.size) {
            throw new Error('Responda todas as questoes antes de finalizar.');
        }

        salvarHistorico(this.respostas);
        this.finalizada = true;
        return gerarRelatorioCompleto();
    }
}

export function criarSessaoQuiz(questoes) {
    return new SessaoQuiz(questoes);
}
