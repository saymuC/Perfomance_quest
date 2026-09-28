/**
 * PERFORMANCE QUEST - APLICAÇÃO PRINCIPAL (APP)
 * 
 * Orquestra o ciclo de vida do quiz, cadastro do estudante,
 * comunicação REST com o backend, sincronização de resultados e ranking.
 */

import { criarSessaoQuiz, carregarHistoricoLocal, limparHistoricoLocal, gerarRelatorioCompleto } from './quiz.js';
import { obterDadosAluno, salvarDadosAluno, temCadastroValido, enfileirarResultadoPendente, obterResultadosPendentes, removerResultadoPendente } from './storage.js';
import { obterQuestoesSimulado, enviarResultadoAPI, obterRankingsAPI, verificarSaudeAPI } from './api.js';
import { UI } from './ui.js';

// Estado global da aplicação
const estado = {
    sessaoAtual: null,
    questoes: [],
    indiceAtual: 0,
    alternativaSelecionada: null,
    tempoInicioQuestao: 0,
    intervaloTimer: null,
    historicoTentativa: [],
    resultadoAtual: null,
    turmasConhecidas: new Set(['3A', '3B', '3C', '3º Ano 1', '3º Ano 2'])
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
 * Para o cronômetro e retorna o tempo gasto em segundos
 */
function pararTimer() {
    if (estado.intervaloTimer) {
        clearInterval(estado.intervaloTimer);
        estado.intervaloTimer = null;
    }
    return Math.max(1, Math.round((Date.now() - estado.tempoInicioQuestao) / 1000));
}

/**
 * Carrega e renderiza a questão atual
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
    UI.ocultarErro();

    // Valida se o aluno preencheu a identificação obrigatória
    const aluno = obterDadosAluno();
    if (!aluno) {
        const cardCadastro = document.getElementById('card-identificacao-aluno');
        if (cardCadastro) {
            cardCadastro.scrollIntoView({ behavior: 'smooth' });
            cardCadastro.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.4)';
            setTimeout(() => cardCadastro.style.boxShadow = '', 2000);
        }
        alert('Por favor, preencha sua identificação (Nome, Turma e Matrícula) antes de iniciar o simulado para registrar sua pontuação no ranking.');
        return;
    }

    const selectArea = document.getElementById('filtro-area');
    const selectQtd = document.getElementById('filtro-quantidade');
    const btnIniciar = document.getElementById('btn-iniciar-simulado');

    const area = selectArea ? selectArea.value : 'Todas';
    const quantidade = selectQtd ? parseInt(selectQtd.value, 10) : 5;

    if (btnIniciar) {
        btnIniciar.disabled = true;
        btnIniciar.textContent = '⏳ Carregando...';
    }

    UI.mostrarCarregando('Carregando questões do servidor da API...');

    try {
        const dados = await obterQuestoesSimulado({ area, quantidade });
        UI.atualizarStatusAPI('online');

        const { questoes } = dados;

        if (!questoes || questoes.length === 0) {
            throw new Error('Nenhuma questão disponível para iniciar o simulado.');
        }

        estado.questoes = questoes;
        estado.indiceAtual = 0;
        estado.historicoTentativa = [];
        estado.sessaoAtual = criarSessaoQuiz(questoes);

        UI.ocultarCarregando();
        UI.mostrarTela('quiz');
        carregarQuestaoAtual();
    } catch (err) {
        UI.ocultarCarregando();
        console.error('Erro ao inicializar simulado:', err);

        UI.mostrarErro(
            `Falha ao obter questões: ${err.message}`,
            {
                onTentarNovamente: () => iniciarSimulado()
            }
        );
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
        const resposta = estado.sessaoAtual.registrarResposta(
            questao.id,
            estado.alternativaSelecionada,
            tempoGasto
        );

        estado.historicoTentativa.push({ questao, resposta });

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
async function proximaQuestao() {
    const total = estado.questoes.length;

    if (estado.indiceAtual < total - 1) {
        estado.indiceAtual++;
        carregarQuestaoAtual();
    } else {
        // Finaliza o simulado
        const relatorio = estado.sessaoAtual.finalizar();
        estado.resultadoAtual = relatorio;

        UI.mostrarTela('result');
        UI.renderizarRelatorio(relatorio);
        UI.renderizarRevisaoQuestoes(estado.historicoTentativa);

        // Sincroniza resultado com a API REST
        await sincronizarResultadoAtual(relatorio);
    }
}

/**
 * Envia o resultado do simulado para a API (POST /api/results)
 * e gerencia os estados de sincronização
 */
async function sincronizarResultadoAtual(relatorio) {
    const aluno = obterDadosAluno();
    if (!aluno) return;

    UI.atualizarStatusSincronizacao({
        status: 'pending',
        mensagem: 'Enviando pontuação para o ranking da turma...'
    });

    const payload = {
        nome: aluno.nome,
        turma: aluno.turma,
        matricula: aluno.matricula,
        acertos: relatorio.resumo.acertos,
        total: relatorio.resumo.total,
        taxaAcerto: relatorio.resumo.taxaAcerto,
        tempoTotalSegundos: relatorio.resumo.tempoTotalSegundos,
        respostas: estado.historicoTentativa.map(item => ({
            questaoId: item.questao.id,
            area: item.questao.area,
            assunto: item.questao.assunto,
            alternativaEscolhida: item.resposta.alternativaEscolhida,
            alternativaCorreta: item.resposta.alternativaCorreta,
            acertou: item.resposta.acertou,
            tempoSegundos: item.resposta.tempoSegundos
        }))
    };

    try {
        await enviarResultadoAPI(payload);
        UI.atualizarStatusSincronizacao({
            status: 'synced',
            mensagem: `Pontuação registrada com sucesso no ranking da Turma ${aluno.turma}!`
        });

        // Tenta enviar pendências offline anteriores se houver
        await tentarSincronizarFilaPendente();
    } catch (err) {
        console.warn('Falha ao enviar resultado para a API online:', err);
        enfileirarResultadoPendente(payload);

        UI.atualizarStatusSincronizacao({
            status: 'failed',
            mensagem: 'Servidor indisponível no momento. O resultado foi salvo localmente e será reenviado assim que a conexão restabelecer.',
            onTentarSincronizar: () => sincronizarResultadoAtual(relatorio)
        });
    }
}

/**
 * Tenta enviar resultados que ficaram pendentes na fila offline
 */
async function tentarSincronizarFilaPendente() {
    const fila = obterResultadosPendentes();
    if (!Array.isArray(fila) || fila.length === 0) return;

    for (const item of fila) {
        try {
            await enviarResultadoAPI(item.payload);
            removerResultadoPendente(item.id);
        } catch {
            break; // Se a API continuar fora, interrompe
        }
    }
}

/**
 * Abre e carrega o modal de ranking
 */
async function abrirRanking(turma = null) {
    const modal = document.getElementById('modal-ranking');
    const selectTurma = document.getElementById('ranking-filtro-turma');
    const aluno = obterDadosAluno();

    if (modal) modal.classList.add('active');

    // Turma padrão a consultar
    const turmaAlvo = turma !== null ? turma : (selectTurma ? selectTurma.value : (aluno ? aluno.turma : 'Todas'));

    carregarDadosRanking(turmaAlvo);
}

function fecharRanking() {
    const modal = document.getElementById('modal-ranking');
    if (modal) modal.classList.remove('active');
}

/**
 * Consulta a API e renderiza a tabela de ranking
 */
async function carregarDadosRanking(turmaFiltro = 'Todas') {
    const container = document.getElementById('ranking-conteudo-container');
    const aluno = obterDadosAluno();

    if (container) {
        container.replaceChildren();
        const p = document.createElement('p');
        p.style.color = '#64748b';
        p.style.textAlign = 'center';
        p.style.padding = '1.5rem';
        p.textContent = 'Carregando ranking da API...';
        container.appendChild(p);
    }

    try {
        const classNameParam = (turmaFiltro && turmaFiltro !== 'Todas') ? turmaFiltro : '';
        const dados = await obterRankingsAPI({ className: classNameParam, limit: 30 });

        // Coleta turmas retornadas para alimentar o filtro
        if (Array.isArray(dados)) {
            dados.forEach(item => {
                const t = item.className || item.turma;
                if (t) estado.turmasConhecidas.add(String(t).trim());
            });
        }
        if (aluno && aluno.turma) {
            estado.turmasConhecidas.add(aluno.turma);
        }

        UI.renderizarRanking({
            ranking: dados,
            turmas: Array.from(estado.turmasConhecidas).sort(),
            turmaSelecionada: turmaFiltro,
            alunoAtual: aluno
        });
    } catch (err) {
        console.error('Erro ao consultar ranking:', err);
        if (container) {
            container.replaceChildren();
            const divErro = document.createElement('div');
            divErro.style.textAlign = 'center';
            divErro.style.padding = '1.5rem';

            const pErro = document.createElement('p');
            pErro.style.color = '#dc2626';
            pErro.style.marginBottom = '0.75rem';
            pErro.textContent = `Não foi possível carregar o ranking da API: ${err.message}`;

            const btnRecarregar = document.createElement('button');
            btnRecarregar.className = 'btn btn-outline';
            btnRecarregar.textContent = '🔄 Tentar Novamente';
            btnRecarregar.onclick = () => carregarDadosRanking(turmaFiltro);

            divErro.appendChild(pErro);
            divErro.appendChild(btnRecarregar);
            container.appendChild(divErro);
        }
    }
}

/**
 * Gerenciamento do Cadastro de Aluno
 */
function salvarCadastroAluno(e) {
    if (e) e.preventDefault();

    const inputNome = document.getElementById('input-aluno-nome');
    const inputTurma = document.getElementById('input-aluno-turma');
    const inputMatricula = document.getElementById('input-aluno-matricula');

    try {
        const aluno = salvarDadosAluno({
            nome: inputNome ? inputNome.value : '',
            turma: inputTurma ? inputTurma.value : '',
            matricula: inputMatricula ? inputMatricula.value : ''
        });

        UI.atualizarIdentificacaoAluno(aluno);
        estado.turmasConhecidas.add(aluno.turma);
    } catch (err) {
        alert(err.message);
    }
}

function abrirModalEdicaoAluno() {
    const modal = document.getElementById('modal-aluno');
    const aluno = obterDadosAluno();

    const inputNome = document.getElementById('input-modal-nome');
    const inputTurma = document.getElementById('input-modal-turma');
    const inputMatricula = document.getElementById('input-modal-matricula');

    if (aluno) {
        if (inputNome) inputNome.value = aluno.nome;
        if (inputTurma) inputTurma.value = aluno.turma;
        if (inputMatricula) inputMatricula.value = aluno.matricula;
    }

    if (modal) modal.classList.add('active');
}

function fecharModalEdicaoAluno() {
    const modal = document.getElementById('modal-aluno');
    if (modal) modal.classList.remove('active');
}

function salvarEdicaoModalAluno(e) {
    if (e) e.preventDefault();

    const inputNome = document.getElementById('input-modal-nome');
    const inputTurma = document.getElementById('input-modal-turma');
    const inputMatricula = document.getElementById('input-modal-matricula');

    try {
        const aluno = salvarDadosAluno({
            nome: inputNome ? inputNome.value : '',
            turma: inputTurma ? inputTurma.value : '',
            matricula: inputMatricula ? inputMatricula.value : ''
        });

        UI.atualizarIdentificacaoAluno(aluno);
        estado.turmasConhecidas.add(aluno.turma);
        fecharModalEdicaoAluno();
    } catch (err) {
        alert(err.message);
    }
}

/**
 * Histórico cumulativo local (LocalStorage)
 */
function abrirHistorico() {
    const historico = carregarHistoricoLocal();
    const modal = document.getElementById('modal-history');
    const container = document.getElementById('history-content');

    if (!modal || !container) return;

    container.replaceChildren();

    if (historico.length === 0) {
        const p = document.createElement('p');
        p.style.color = '#64748b';
        p.textContent = 'Nenhuma questão respondida ainda no histórico local.';
        container.appendChild(p);
    } else {
        const relatorio = gerarRelatorioCompleto(historico);

        const statsGrid = document.createElement('div');
        statsGrid.className = 'stats-grid';
        statsGrid.style.marginTop = '1rem';

        [
            { valor: relatorio.resumo.total, label: 'Total Geral' },
            { valor: relatorio.resumo.acertos, label: 'Acertos', cor: '#10b981' },
            { valor: `${relatorio.resumo.taxaAcerto}%`, label: 'Aproveitamento' }
        ].forEach(box => {
            const div = document.createElement('div');
            div.className = 'stat-box';
            const v = document.createElement('div');
            v.className = 'stat-value';
            if (box.cor) v.style.color = box.cor;
            v.textContent = box.valor;
            const l = document.createElement('div');
            l.className = 'stat-label';
            l.textContent = box.label;
            div.appendChild(v);
            div.appendChild(l);
            statsGrid.appendChild(div);
        });

        const h4 = document.createElement('h4');
        h4.style.margin = '1.25rem 0 0.5rem 0';
        h4.textContent = 'Assuntos mais críticos identificados pela IA:';

        container.appendChild(statsGrid);
        container.appendChild(h4);

        if (relatorio.assuntosPrioritarios.length === 0) {
            const p = document.createElement('p');
            p.style.color = '#64748b';
            p.style.fontSize = '0.9rem';
            p.textContent = 'Acumule ao menos 2 questões por assunto para gerar o ranking da IA.';
            container.appendChild(p);
        } else {
            const ul = document.createElement('ul');
            ul.style.paddingLeft = '1.25rem';
            ul.style.fontSize = '0.95rem';
            ul.style.color = '#334155';

            relatorio.assuntosPrioritarios.forEach(item => {
                const li = document.createElement('li');
                li.style.marginBottom = '0.35rem';
                const strong = document.createElement('strong');
                strong.textContent = item.assunto;
                const txt = document.createTextNode(` — Taxa: ${item.taxaAcerto.toFixed(0)}% (IPE: ${(item.ipe * 100).toFixed(0)})`);
                li.appendChild(strong);
                li.appendChild(txt);
                ul.appendChild(li);
            });

            container.appendChild(ul);
        }
    }

    modal.classList.add('active');
}

function handleLimparHistorico() {
    if (confirm('Tem certeza que deseja limpar todo o histórico acumulado no navegador?')) {
        limparHistoricoLocal();
        abrirHistorico();
    }
}

// ========================================================
// INICIALIZAÇÃO DA APLICAÇÃO NO DOM
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializa identificação do aluno se já existir
    const alunoSalvo = obterDadosAluno();
    UI.atualizarIdentificacaoAluno(alunoSalvo);
    if (alunoSalvo && alunoSalvo.turma) {
        estado.turmasConhecidas.add(alunoSalvo.turma);
    }

    // 2. Verifica a saúde da API REST
    verificarSaudeAPI()
        .then(() => UI.atualizarStatusAPI('online'))
        .catch(() => UI.atualizarStatusAPI('offline'));

    // 3. Eventos de Cadastro de Aluno
    const formCadastro = document.getElementById('form-cadastro-aluno');
    if (formCadastro) formCadastro.addEventListener('submit', salvarCadastroAluno);

    const btnAlterarHome = document.getElementById('btn-alterar-cadastro-home');
    if (btnAlterarHome) btnAlterarHome.addEventListener('click', abrirModalEdicaoAluno);

    const btnEditarHeader = document.getElementById('btn-editar-aluno-header');
    if (btnEditarHeader) btnEditarHeader.addEventListener('click', abrirModalEdicaoAluno);

    const formModalAluno = document.getElementById('form-modal-aluno');
    if (formModalAluno) formModalAluno.addEventListener('submit', salvarEdicaoModalAluno);

    const btnFecharModalAluno = document.getElementById('btn-fechar-modal-aluno');
    if (btnFecharModalAluno) btnFecharModalAluno.addEventListener('click', fecharModalEdicaoAluno);

    const btnCancelarModalAluno = document.getElementById('btn-cancelar-modal-aluno');
    if (btnCancelarModalAluno) btnCancelarModalAluno.addEventListener('click', fecharModalEdicaoAluno);

    // 4. Eventos do Quiz
    const btnIniciar = document.getElementById('btn-iniciar-simulado');
    if (btnIniciar) btnIniciar.addEventListener('click', () => iniciarSimulado());

    const btnConfirmar = document.getElementById('btn-confirmar-resposta');
    if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarResposta);

    const btnProxima = document.getElementById('btn-proxima-questao');
    if (btnProxima) btnProxima.addEventListener('click', proximaQuestao);

    const btnNovoSimulado = document.getElementById('btn-novo-simulado');
    if (btnNovoSimulado) {
        btnNovoSimulado.addEventListener('click', () => {
            UI.mostrarTela('home');
        });
    }

    // 5. Eventos do Ranking
    const btnRankingHeader = document.getElementById('btn-abrir-ranking-header');
    if (btnRankingHeader) btnRankingHeader.addEventListener('click', () => abrirRanking());

    const btnRankingHome = document.getElementById('btn-abrir-ranking-home');
    if (btnRankingHome) btnRankingHome.addEventListener('click', () => abrirRanking());

    const btnRankingResult = document.getElementById('btn-abrir-ranking-resultado');
    if (btnRankingResult) {
        btnRankingResult.addEventListener('click', () => {
            const aluno = obterDadosAluno();
            abrirRanking(aluno ? aluno.turma : 'Todas');
        });
    }

    const btnFecharRanking = document.getElementById('btn-fechar-ranking');
    if (btnFecharRanking) btnFecharRanking.addEventListener('click', fecharRanking);

    const btnAtualizarRanking = document.getElementById('btn-atualizar-ranking');
    if (btnAtualizarRanking) {
        btnAtualizarRanking.addEventListener('click', () => {
            const selectTurma = document.getElementById('ranking-filtro-turma');
            carregarDadosRanking(selectTurma ? selectTurma.value : 'Todas');
        });
    }

    const selectTurmaRanking = document.getElementById('ranking-filtro-turma');
    if (selectTurmaRanking) {
        selectTurmaRanking.addEventListener('change', (e) => {
            carregarDadosRanking(e.target.value);
        });
    }

    // 6. Eventos do Histórico Local
    const btnVerHistorico = document.getElementById('btn-ver-historico');
    if (btnVerHistorico) btnVerHistorico.addEventListener('click', abrirHistorico);

    const btnFecharHistorico = document.getElementById('btn-fechar-historico');
    if (btnFecharHistorico) btnFecharHistorico.addEventListener('click', () => {
        const modal = document.getElementById('modal-history');
        if (modal) modal.classList.remove('active');
    });

    const btnLimparHist = document.getElementById('btn-limpar-historico');
    if (btnLimparHist) btnLimparHist.addEventListener('click', handleLimparHistorico);

    const btnFecharErro = document.getElementById('btn-fechar-erro');
    if (btnFecharErro) btnFecharErro.addEventListener('click', () => UI.ocultarErro());

    // 7. Navegação e Acessibilidade por Teclado (RNF01, RNF05)
    window.addEventListener('keydown', (e) => {
        const modalAtivo = document.querySelector('.modal-backdrop.active');
        if (modalAtivo) return;

        // Se o foco estiver em um input de texto, não captura teclas de atalho
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

        const quizAtivo = UI.screens.quiz && UI.screens.quiz.classList.contains('active');
        if (!quizAtivo) return;

        const key = e.key.toUpperCase();

        // Teclas A, B, C, D, E para seleção de alternativas
        if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
            const opcao = document.querySelector(`.alt-option[data-letra="${key}"]`);
            if (opcao && !opcao.classList.contains('locked')) {
                opcao.click();
            }
            return;
        }

        // Tecla Enter para confirmar ou avançar
        if (e.key === 'Enter') {
            const btnConfirmar = document.getElementById('btn-confirmar-resposta');
            const btnProxima = document.getElementById('btn-proxima-questao');

            if (btnConfirmar && btnConfirmar.style.display !== 'none' && !btnConfirmar.disabled) {
                e.preventDefault();
                confirmarResposta();
            } else if (btnProxima && btnProxima.style.display !== 'none') {
                e.preventDefault();
                proximaQuestao();
            }
        }
    });
});