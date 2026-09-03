// Geração de relatórios e gráficos 

import { carregarHistorico} from './storage.js';
import {
    calcularDesempenhoPorArea,
    sugerirAssuntosPrioritarios
} from './diagnostico.js';

/**
 * Calcula o resumo do geral desempenho do aluno 
 * @returns {Object} Resumo com total de questões e taxa de acerto
 */

 export function gerarResumo(respostas = carregarHistorico()) {
    const historico = respostas;

    if (historico.length === 0) {
        return {
            total: 0,
            acertos: 0,
            taxaAcerto: 0,
            mensagem: "Nenhuma questão respondida ainda." 
        };

    }

    const total = historico.length;
    const acertos = historico.filter(resposta => resposta.acertou).length;
    const taxaAcerto = Math.round((acertos / total) * 100);

    return {
        total,
        acertos,
        taxaAcerto,
        mensagem: taxaAcerto >= 70 ? 'Parabéns! Seu desempenho está muito bom!'
        : 'Continue praticando! Você está no caminho certo.'
    };
 }

  /** 
   * Gera o relatório completo de desempenho 
   * @returns {Object} Relatório com resumo, desempenho por assunto e prioridades
   */

  export function gerarRelatorioCompleto(respostas = carregarHistorico()) {
    const historico = respostas;

    if (historico.length === 0) {
        return {
            resumo: {
                total: 0,
                acertos: 0,
                taxaAcerto: 0,
                mensagem: 'Nenhuma questão respondida ainda.'

            },

            assuntosPrioritarios: [],
            desempenhoPorAssunto: {},
            desempenhoPorArea: calcularDesempenhoPorArea([])
        };
    }
    
         // 1. Calcula o resumo 
         const resumo = gerarResumo(historico);

         // 2. Pega os 3 assuntos prioritários (usando a IA)
         const assuntosPrioritarios = sugerirAssuntosPrioritarios(historico, 3);
         const desempenhoPorArea = calcularDesempenhoPorArea(historico);
         
         // 3. Calcula o desempenho ṕor assunto 
         const desempenhoPorAssunto = {};
         historico.forEach(resposta => {
            const assunto = resposta.assunto || 'Geral';
            if (!desempenhoPorAssunto[assunto]) {
                desempenhoPorAssunto[assunto] = { total: 0, acertos: 0};
            }
            desempenhoPorAssunto[assunto].total++;
            if (resposta.acertou) desempenhoPorAssunto[assunto].acertos++;

         });

         // 4. Monta o relatório final
         return {
            resumo,
            assuntosPrioritarios,
            desempenhoPorAssunto,
            desempenhoPorArea

         };
      }
    
