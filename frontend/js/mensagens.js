/**
 * Textos e mensagens da interface do usuário (UX Writing em pt-BR)
 * Centraliza mensagens amigáveis voltadas para estudantes do ensino médio.
 * Sem termos técnicos de infraestrutura ou códigos de erro.
 */

export const MENSAGENS = {
    // Carregamento
    carregandoQuestoes: 'Carregando questões...',
    carregandoRanking: 'Carregando ranking...',
    carregandoGeral: 'Carregando...',

    // Erros amigáveis
    erroCarregarQuestoes: 'Não conseguimos carregar as questões agora. Tente novamente em instantes.',
    erroCarregarRanking: 'Não foi possível carregar o ranking agora. Tente novamente em instantes.',
    erroRegistrarResposta: 'Não foi possível registrar sua resposta. Tente novamente.',
    erroGenericoTitulo: '⚠️ Algo não saiu como esperado',
    erroGenericoDesc: 'Não conseguimos carregar o conteúdo agora. Tente novamente em instantes.',
    botaoTentarNovamente: '🔄 Tentar novamente',

    // Feedback de salvamento no ranking
    salvandoPontuacao: 'Salvando sua pontuação no ranking...',
    pontuacaoSalva: (turma) => turma ? `Pontuação registrada com sucesso no ranking da Turma ${turma}!` : 'Pontuação registrada com sucesso no ranking da turma!',
    pontuacaoPendente: 'Não conseguimos salvar no ranking agora, mas sua pontuação está guardada. Vamos tentar de novo automaticamente.',

    // Diagnóstico e Recomendações
    semQuestoesRecomendacao: 'Responda pelo menos 2 questões do mesmo assunto para receber recomendações de estudo.',
    dicaEstudo: '💡 Dica de estudo: Dedique seus próximos momentos de revisão para reforçar a teoria e resolver mais exercícios desse assunto.',
    assuntosRecomendadosTitulo: 'Assuntos recomendados para estudo:',

    // Histórico e Ranking
    confirmarLimparHistorico: 'Tem certeza de que deseja limpar seu histórico de simulados salvos neste aparelho?',
    historicoVazio: 'Nenhuma questão respondida ainda no seu histórico.',
    rankingVazio: 'Nenhum resultado registrado para esta turma ainda. Seja o primeiro a completar o simulado!'
};
