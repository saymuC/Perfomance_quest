// Módulo de Diagnóstico e Estatísticas (IA)

/**
 * Calcula o desempenho por assunto
 * @param {Array} historico - Lista de respostas do aluno 
 * @returns {object} Objetos com acertos, erros e total por assunto
 */

export function calcularDesempenhoPorAssunto(historico) {
    const desempenho = {};

    historico.forEach(resposta => {
        const assunto = resposta.assunto || 'Geral';
        if (!desempenho[assunto]) {
            desempenho[assunto] = {total: 0, acertos: 0, tempo: 0};
            }

            desempenho[assunto].total++;
            if (resposta.acertou) desempenho[assunto].acertos++;
            const tempo = resposta.tempoSegundos ?? resposta.tempo ?? 0;
            desempenho[assunto].tempo += tempo;
    });


    /** 
     * calcula o índice de prioridade de estudo (IPE)
     * Fórmula: IPE = (1 - (acertos / total)) * (1 + tempoMedio / 10)
     *  @param {Object} desempenho - Objeto com dados por assunto     
     *@returns {Array} Lista de assuntos com seus IPEs 
      */


    return desempenho;

 } 

/**
 * Calcula acertos e porcentagem para cada area do ENEM.
 * @param {Array} historico - Lista de respostas do aluno
 * @returns {Object} Desempenho agrupado por area
 */
export function calcularDesempenhoPorArea(historico) {
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

    historico.forEach(resposta => {
        const area = resposta.area || 'Geral';
        if (!desempenho[area]) {
            desempenho[area] = { total: 0, acertos: 0, taxaAcerto: 0 };
        }

        desempenho[area].total++;
        if (resposta.acertou) desempenho[area].acertos++;
    });

    Object.values(desempenho).forEach(dados => {
        dados.taxaAcerto = dados.total > 0
            ? Math.round((dados.acertos / dados.total) * 100)
            : 0;
    });

    return desempenho;
}
     export function calcularIPE(desempenho) {
        const resultados = [];
        for (const [assunto, dados] of Object.entries(desempenho)) {
            const { total, acertos, tempo} = dados;
            const taxaErros =  total > 0 ? 1 - (acertos / total) : 1;
            const tempoMedio = total > 0 ? tempo / total : 0;
            // O IPE representa somente a taxa de erros. O tempo e usado
            // exclusivamente como criterio de desempate no ranking.
            const ipe = taxaErros;

            resultados.push({
                assunto,
                ipe,
                total,
                acertos,
                taxaAcerto: total > 0 ? (acertos / total) * 100 : 0,
                tempoMedio
            });
        }

        resultados.sort((a, b) => {
            if (b.taxaAcerto !== a.taxaAcerto) {
                return b.ipe - a.ipe;
            }

            // Apenas assuntos com a mesma taxa de acerto sao desempatados
            // pelo tempo medio; o mais demorado vem primeiro.
            if (b.tempoMedio !== a.tempoMedio) {
                return b.tempoMedio - a.tempoMedio;
            }

            return a.assunto.localeCompare(b.assunto);
        });
        return resultados;
  
    } 
     
    /**
     * Sugere os N assuntos com maior prioridade de estudo
     * @param {Array} historico - lista de respostas do aluno 
     * @param {number} quantidade - quantos assuntos sugerir (padrão: 3)
     * @returns {Array} Lista de assuntos prioritários
     */

    export function sugerirAssuntosPrioritarios(historico, quantidade = 3) {
        if (!historico || historico.length === 0 ) return [];

        const desempenho = calcularDesempenhoPorAssunto(historico);
        const ranking = calcularIPE(desempenho);
        return ranking
            .filter(item => item.total >= 2)
            .slice(0, quantidade);
    }
