/**
 * PERFORMANCE QUEST - APLICAÇÃO PRINCIPAL (APP)
 * Conecta os módulos de lógica do backend à camada de apresentação e API.
 */

import { criarSessaoQuiz } from '../../backend/src/sessaoQuiz.js';
import { carregarHistorico, limparHistorico } from '../../backend/src/storage.js';
import { gerarRelatorioCompleto } from '../../backend/src/relatorios.js';
import { obterQuestoesSimulado } from './api.js';
import { UI } from './ui.js';

// Estado global da aplicação
const estado = {
    sessaoAtual: null,
    questoes: [],
    indiceAtual: 0,
    alternativaSelecionada: null,
    tempoInicioQuestao: 0,
    intervaloTimer: null
};

/**
 * Inicia o cronômetro para a questão atual
 */
function iniciarTimer() {
    if (estado.intervaloTimer) clearInterval(estado.intervaloTimer);
    estado.tempoInicioQuestao = Date.now();
    UI.atualizarTimer(0);

    estado.intervaloTimer = setInterval(() => {
        const segundos = Math.floor((Date.now() - estado.tempoInicioQuestao) / 1000);
        UI.atualizarTimer(segundos);
    }, 1000);
}

/**
 * Para o cronômetro e retorna o tempo total gasto na questão em segundos
 */
function pararTimer() {
    if (estado.intervaloTimer) {
        clearInterval(estado.intervaloTimer);
        estado.intervaloTimer = null;
    }
    return Math.max(1, Math.round((Date.now() - estado.tempoInicioQuestao) / 1000));
}

/**
 * Carrega e renderiza uma questão pelo índice
 */
function carregarQuestaoAtual() {
    const questao = estado.questoes[estado.indiceAtual];
    estado.alternativaSelecionada = null;

    UI.renderizarQuestao({
        questao,
        indice: estado.indiceAtual + 1,
        total: estado.questoes.length,
        onSelecionarAlternativa: (letra) => {
            estado.alternativaSelecionada = letra;
        }
    });

    iniciarTimer();
}

/**
 * Inicia uma nova sessão de Simulado
 */
async function iniciarSimulado() {
    const selectArea = document.getElementById('filtro-area');
    const selectQtd = document.getElementById('filtro-quantidade');
    const btnIniciar = document.getElementById('btn-iniciar-simulado');

    const area = selectArea ? selectArea.value : 'Todas';
    const quantidade = selectQtd ? parseInt(selectQtd.value, 10) : 5;

    if (btnIniciar) {
        btnIniciar.disabled = true;
        btnIniciar.textContent = '⏳ Carregando questões...';
    }

    try {
        const { questoes, fonte } = await obterQuestoesSimulado({ area, quantidade });
        UI.atualizarStatusFonte(fonte);

        if (!questoes || questoes.length === 0) {
            alert('Não foi possível carregar as questões. Verifique sua conexão ou tente novamente.');
            return;
        }

        estado.questoes = questoes;
        estado.indiceAtual = 0;
        estado.sessaoAtual = criarSessaoQuiz(questoes);

        UI.mostrarTela('quiz');
        carregarQuestaoAtual();
    } catch (err) {
        console.error('Erro ao inicializar simulado:', err);
        alert('Erro ao inicializar o simulado. Detalhes: ' + err.message);
    } finally {
        if (btnIniciar) {
            btnIniciar.disabled = false;
            btnIniciar.textContent = 'Iniciar Simulado →';
        }
    }
}

/**
 * Submete e corrige a resposta da questão atual
 */
function confirmarResposta() {
    if (!estado.alternativaSelecionada) {
        alert('Por favor, selecione uma alternativa antes de confirmar.');
        return;
    }

    const questao = estado.questoes[estado.indiceAtual];
    const tempoGasto = pararTimer();

    try {
        // O módulo do backend corrige e armazena a tentativa
        const resposta = estado.sessaoAtual.registrarResposta(
            questao.id,
            estado.alternativaSelecionada,
            tempoGasto
        );

        const ehUltima = estado.indiceAtual === estado.questoes.length - 1;

        UI.exibirFeedback({
            acertou: resposta.acertou,
            alternativaCorreta: resposta.alternativaCorreta,
            explicacao: questao.explicacao,
            ehUltimaQuestao: ehUltima
        });
    } catch (err) {
        console.error('Erro ao corrigir resposta:', err);
        alert(err.message);
    }
}

/**
 * Avança para a próxima questão ou finaliza o simulado
 */
function proximaQuestao() {
    const total = estado.questoes.length;

    if (estado.indiceAtual < total - 1) {
        estado.indiceAtual++;
        carregarQuestaoAtual();
    } else {
        // Finaliza o quiz e gera o relatório completo da tentativa
        const relatorio = estado.sessaoAtual.finalizar();
        UI.mostrarTela('result');
        UI.renderizarRelatorio(relatorio);
    }
}

/**
 * Exibe o modal com o histórico cumulativo salvo no LocalStorage
 */
function abrirHistorico() {
    const historico = carregarHistorico();
    const modal = document.getElementById('modal-history');
    const container = document.getElementById('history-content');

    if (!modal || !container) return;

    if (historico.length === 0) {
        container.innerHTML = '<p style="color: #64748b;">Nenhuma questão respondida ainda no histórico local.</p>';
    } else {
        const relatorio = gerarRelatorioCompleto(historico);
        container.innerHTML = `
            <div class="stats-grid" style="margin-top: 1rem;">
                <div class="stat-box">
                    <div class="stat-value">${relatorio.resumo.total}</div>
                    <div class="stat-label">Total Geral</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value" style="color: #10b981;">${relatorio.resumo.acertos}</div>
                    <div class="stat-label">Acertos</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${relatorio.resumo.taxaAcerto}%</div>
                    <div class="stat-label">Aproveitamento</div>
                </div>
            </div>

            <h4 style="margin: 1.25rem 0 0.5rem 0;">Assuntos mais críticos identificados pela IA:</h4>
            ${relatorio.assuntosPrioritarios.length === 0 ? '<p style="color:#64748b;font-size:0.9rem;">Acumule ao menos 2 questões por assunto para o ranking IA.</p>' : `
                <ul style="padding-left: 1.25rem; font-size: 0.95rem; color: #334155;">
                    ${relatorio.assuntosPrioritarios.map(item => `
                        <li style="margin-bottom: 0.35rem;">
                            <strong>${item.assunto}</strong> — Taxa: ${item.taxaAcerto.toFixed(0)}% (IPE: ${(item.ipe * 100).toFixed(0)})
                        </li>
                    `).join('')}
                </ul>
            `}
        `;
    }

    modal.classList.add('active');
}

function fecharHistorico() {
    const modal = document.getElementById('modal-history');
    if (modal) modal.classList.remove('active');
}

function handleLimparHistorico() {
    if (confirm('Tem certeza que deseja limpar todo o histórico acumulado no navegador?')) {
        limparHistorico();
        abrirHistorico();
    }
}

// Inicialização dos eventos do DOM
document.addEventListener('DOMContentLoaded', () => {
    // Botão iniciar
    const btnIniciar = document.getElementById('btn-iniciar-simulado');
    if (btnIniciar) btnIniciar.addEventListener('click', iniciarSimulado);

    // Botão confirmar resposta
    const btnConfirmar = document.getElementById('btn-confirmar-resposta');
    if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarResposta);

    // Botão próxima questão / finalizar
    const btnProxima = document.getElementById('btn-proxima-questao');
    if (btnProxima) btnProxima.addEventListener('click', proximaQuestao);

    // Botão novo simulado (da tela de resultado)
    const btnNovoSimulado = document.getElementById('btn-novo-simulado');
    if (btnNovoSimulado) {
        btnNovoSimulado.addEventListener('click', () => {
            UI.mostrarTela('home');
        });
    }

    // Modal de Histórico
    const btnVerHistorico = document.getElementById('btn-ver-historico');
    if (btnVerHistorico) btnVerHistorico.addEventListener('click', abrirHistorico);

    const btnFecharHistorico = document.getElementById('btn-fechar-historico');
    if (btnFecharHistorico) btnFecharHistorico.addEventListener('click', fecharHistorico);

    const btnLimparHist = document.getElementById('btn-limpar-historico');
    if (btnLimparHist) btnLimparHist.addEventListener('click', handleLimparHistorico);
});
