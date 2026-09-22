/**
 * Módulo de Lógica do Quiz e Diagnóstico Local (Client-Side)
 * 
 * Permite que a aplicação frontend execute de forma 100% autônoma
 * em hosts estáticos (Vercel, GitHub Pages, Netlify), sem importar
 * arquivos locais do diretório backend/.
 */

const CHAVE_HISTORICO = 'performance_quest_historico';

/**
 * Valida e corrige uma resposta escolhida pelo estudante
 */
export function corrigirResposta(questao, alternativaMarcada, tempoSegundos) {
    if (!questao || typeof questao !== 'object') {
        throw new TypeError('A questão é obrigatória.');
    }

    if (!questao.id) {
        throw new Error('A questão precisa ter um identificador.');
    }

    if (typeof alternativaMarcada !== 'string' || alternativaMarcada.trim() === '') {
        throw new Error('Selecione uma alternativa válida.');
    }

    const tempo = Number.isFinite(tempoSegundos) && tempoSegundos >= 0 ? tempoSegundos : 0;
    const alternativaCorreta = questao.alternativaCorreta || questao.respostaCorreta || questao.gabarito || 'A';

    const escolha = alternativaMarcada.trim().toUpperCase();
    const correta = String(alternativaCorreta).trim().toUpperCase();

    return {
        questaoId: String(questao.id),
        area: questao.area || 'Geral',
        assunto: questao.assunto || 'Geral',
        alternativaEscolhida: escolha,
        alternativaCorreta: correta,
        acertou: escolha === correta,
        tempoSegundos: tempo
    };
}

/**
 * Gerencia o estado de uma sessão ativa de simulado
 */
export class SessaoQuiz {
    constructor(questoes) {
        if (!Array.isArray(questoes) || questoes.length === 0) {
            throw new Error('O simulado precisa ter ao menos uma questão.');
        }

        this.questoes = new Map();
        this.respostas = [];
        this.finalizada = false;

        questoes.forEach(q => {
            const id = String(q.id || Math.random().toString(36).slice(2, 7));
            if (!this.questoes.has(id)) {
                this.questoes.set(id, q);
            }
        });
    }

    registrarResposta(questaoId, alternativaMarcada, tempoSegundos) {
        if (this.finalizada) {
            throw new Error('A sessão do quiz já foi finalizada.');
        }

        const id = String(questaoId);
        const questao = this.questoes.get(id);
        if (!questao) {
            throw new Error('A questão informada não pertence a este simulado.');
        }

        if (this.respostas.some(r => String(r.questaoId) === id)) {
            throw new Error('Esta questão já foi respondida nesta sessão.');
        }

        const resultado = corrigirResposta(questao, alternativaMarcada, tempoSegundos);
        this.respostas.push(resultado);
        return resultado;
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
            throw new Error('A sessão do quiz já foi finalizada.');
        }

        if (this.respostas.length !== this.questoes.size) {
            throw new Error('Responda todas as questões antes de finalizar.');
        }

        this.finalizada = true;
        salvarHistoricoLocal(this.respostas);
        return gerarRelatorioCompleto(this.respostas);
    }
}

export function criarSessaoQuiz(questoes) {
    return new SessaoQuiz(questoes);
}

/**
 * Calcula desempenho agrupado pelas 4 grandes áreas do ENEM
 */
export function calcularDesempenhoPorArea(respostas = []) {
    const areasPadrao = [
        'Linguagens',
        'Matemática',
        'Ciências Humanas',
        'Ciências da Natureza'
    ];

    const desempenho = {};
    areasPadrao.forEach(area => {
        desempenho[area] = { total: 0, acertos: 0, taxaAcerto: 0 };
    });

    respostas.forEach(r => {
        const area = r.area || 'Geral';
        if (!desempenho[area]) {
            desempenho[area] = { total: 0, acertos: 0, taxaAcerto: 0 };
        }
        desempenho[area].total++;
        if (r.acertou) desempenho[area].acertos++;
    });

    Object.values(desempenho).forEach(d => {
        d.taxaAcerto = d.total > 0 ? Math.round((d.acertos / d.total) * 100) : 0;
    });

    return desempenho;
}

/**
 * Calcula desempenho agrupado por assunto
 */
export function calcularDesempenhoPorAssunto(respostas = []) {
    const desempenho = {};

    respostas.forEach(r => {
        const assunto = r.assunto || 'Geral';
        if (!desempenho[assunto]) {
            desempenho[assunto] = { total: 0, acertos: 0, tempo: 0 };
        }
        desempenho[assunto].total++;
        if (r.acertou) desempenho[assunto].acertos++;
        desempenho[assunto].tempo += (r.tempoSegundos || 0);
    });

    return desempenho;
}

/**
 * Calcula o Índice de Prioridade de Estudo (IPE) para cada assunto.
 * Fórmula: IPE = Taxa de Erro = 1 - (acertos / total)
 * Critério de desempate: maior tempo médio gasto por questão (RN01)
 */
export function calcularIPE(desempenhoPorAssunto) {
    const resultados = [];

    for (const [assunto, dados] of Object.entries(desempenhoPorAssunto)) {
        const { total, acertos, tempo } = dados;
        const taxaErros = total > 0 ? 1 - (acertos / total) : 1;
        const tempoMedio = total > 0 ? tempo / total : 0;

        resultados.push({
            assunto,
            ipe: taxaErros,
            total,
            acertos,
            taxaAcerto: total > 0 ? (acertos / total) * 100 : 0,
            tempoMedio
        });
    }

    resultados.sort((a, b) => {
        if (b.ipe !== a.ipe) {
            return b.ipe - a.ipe; // Maior taxa de erro primeiro
        }
        if (b.tempoMedio !== a.tempoMedio) {
            return b.tempoMedio - a.tempoMedio; // Desempata pelo mais demorado
        }
        return a.assunto.localeCompare(b.assunto);
    });

    return resultados;
}

/**
 * Sugere os N assuntos prioritários com base no IPE (RN01: mín. 2 questões)
 */
export function sugerirAssuntosPrioritarios(respostas = [], quantidade = 3) {
    if (!Array.isArray(respostas) || respostas.length === 0) return [];
    const desempenho = calcularDesempenhoPorAssunto(respostas);
    const ranking = calcularIPE(desempenho);
    return ranking.filter(item => item.total >= 2).slice(0, quantidade);
}

/**
 * Gera resumo estatístico de uma lista de respostas
 */
export function gerarResumo(respostas = []) {
    if (!Array.isArray(respostas) || respostas.length === 0) {
        return {
            total: 0,
            acertos: 0,
            taxaAcerto: 0,
            tempoTotalSegundos: 0,
            mensagem: 'Nenhuma questão respondida ainda.'
        };
    }

    const total = respostas.length;
    const acertos = respostas.filter(r => r.acertou).length;
    const taxaAcerto = Math.round((acertos / total) * 100);
    const tempoTotalSegundos = respostas.reduce((acc, r) => acc + (r.tempoSegundos || 0), 0);

    let mensagem = 'Continue praticando! Você está no caminho certo.';
    if (taxaAcerto >= 80) {
        mensagem = 'Excelente resultado! Seu domínio dos conteúdos do ENEM está ótimo!';
    } else if (taxaAcerto >= 60) {
        mensagem = 'Bom desempenho! Revise os tópicos recomendados abaixo para aumentar sua pontuação.';
    }

    return {
        total,
        acertos,
        taxaAcerto,
        tempoTotalSegundos,
        mensagem
    };
}

/**
 * Gera relatório analítico completo
 */
export function gerarRelatorioCompleto(respostas = []) {
    return {
        resumo: gerarResumo(respostas),
        assuntosPrioritarios: sugerirAssuntosPrioritarios(respostas, 3),
        desempenhoPorAssunto: calcularDesempenhoPorAssunto(respostas),
        desempenhoPorArea: calcularDesempenhoPorArea(respostas)
    };
}

/**
 * Persistência local (LocalStorage) de histórico do aluno
 */
export function salvarHistoricoLocal(novasRespostas = []) {
    try {
        const existente = carregarHistoricoLocal();
        const atualizado = [...existente, ...novasRespostas];
        localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(atualizado));
    } catch (e) {
        console.warn('Não foi possível gravar histórico no LocalStorage:', e);
    }
}

export function carregarHistoricoLocal() {
    try {
        const dados = localStorage.getItem(CHAVE_HISTORICO);
        return dados ? JSON.parse(dados) : [];
    } catch {
        return [];
    }
}

export function limparHistoricoLocal() {
    try {
        localStorage.removeItem(CHAVE_HISTORICO);
    } catch (e) {
        console.warn('Erro ao limpar histórico local:', e);
    }
}
