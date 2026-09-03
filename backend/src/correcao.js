// Corrige uma resposta e prepara os dados para o historico do aluno.

function obterAlternativaCorreta(questao) {
    return (
        questao.alternativaCorreta ??
        questao.respostaCorreta ??
        questao.gabarito ??
        questao.resposta_correta
    );
}

function alternativaExiste(questao, alternativa) {
    if (!questao.alternativas) {
        return true;
    }

    const alternativas = Array.isArray(questao.alternativas)
        ? questao.alternativas.map(item => {
            if (typeof item === 'string') return item;
            return item.id ?? item.letra ?? item.valor;
        })
        : Object.keys(questao.alternativas);

    return alternativas.some(item => (
        typeof item === 'string' && item.toUpperCase() === alternativa.toUpperCase()
    ));
}

/**
 * Valida e corrige uma resposta do aluno.
 *
 * @param {Object} questao Questao normalizada pela camada de API.
 * @param {string} alternativaMarcada Alternativa escolhida pelo aluno.
 * @param {number} tempoSegundos Tempo gasto para responder em segundos.
 * @returns {Object} Registro pronto para salvar no historico.
 */
export function corrigirResposta(questao, alternativaMarcada, tempoSegundos) {
    if (!questao || typeof questao !== 'object') {
        throw new TypeError('A questao e obrigatoria.');
    }

    if (questao.id === undefined || questao.id === null || questao.id === '') {
        throw new Error('A questao precisa ter um id.');
    }

    if (typeof alternativaMarcada !== 'string' || alternativaMarcada.trim() === '') {
        throw new Error('Selecione uma alternativa valida.');
    }

    if (!Number.isFinite(tempoSegundos) || tempoSegundos < 0) {
        throw new Error('O tempo gasto deve ser um numero maior ou igual a zero.');
    }

    const alternativaCorreta = obterAlternativaCorreta(questao);
    if (typeof alternativaCorreta !== 'string' || alternativaCorreta.trim() === '') {
        throw new Error('A questao nao possui gabarito valido.');
    }

    const escolha = alternativaMarcada.trim();
    const correta = alternativaCorreta.trim();

    if (!alternativaExiste(questao, escolha)) {
        throw new Error('A alternativa marcada nao pertence a questao.');
    }

    return {
        questaoId: questao.id,
        area: questao.area || 'Geral',
        assunto: questao.assunto || 'Geral',
        alternativaEscolhida: escolha,
        alternativaCorreta: correta,
        acertou: escolha.toUpperCase() === correta.toUpperCase(),
        tempoSegundos
    };
}
