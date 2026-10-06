/**
 * PERFORMANCE QUEST - APLICAÇÃO PRINCIPAL (APP)
 * 
 * Orquestra o ciclo de vida do quiz, cadastro do estudante,
 * comunicação REST com o backend, sincronização de resultados e ranking.
 */

import { criarSessaoQuiz, carregarHistoricoLocal, limparHistoricoLocal, gerarRelatorioCompleto } from './quiz.js';
import { obterDadosAluno, obterIdentificadorDispositivo, novoIdentificador, salvarDadosAluno, enfileirarResultadoPendente, obterResultadosPendentes, removerResultadoPendente } from './storage.js';
import { obterQuestoesSimulado, enviarResultadoAPI, obterRankingsAPI, verificarSaudeAPI, registrarAlunoAPI } from './api.js';
import { UI, rotuloPrioridade } from './ui.js';
import { MENSAGENS } from './mensagens.js';

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
    consultaRanking: 0,
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
        alert(MENSAGENS.identificarAntesSimulado);
        return;
    }

    const selectArea = document.getElementById('filtro-area');
    const selectAno = document.getElementById('filtro-ano');
    const selectQtd = document.getElementById('filtro-quantidade');
    const btnIniciar = document.getElementById('btn-iniciar-simulado');

    const area = selectArea ? selectArea.value : 'Todas';
    const quantidade = selectQtd ? parseInt(selectQtd.value, 10) : 5;

    if (btnIniciar) {
        btnIniciar.disabled = true;
        btnIniciar.textContent = MENSAGENS.carregandoBotao;
    }

    UI.mostrarCarregando(MENSAGENS.carregandoQuestoes);

    try {
        const dados = await obterQuestoesSimulado({ area, quantidade, ano: selectAno?.value || 'all' });

        const { questoes } = dados;

        if (!questoes || questoes.length === 0) {
            throw new Error('Nenhuma questão disponível para iniciar o simulado.');
        }

        estado.questoes = questoes;
        estado.indiceAtual = 0;
        estado.historicoTentativa = [];
        estado.resultadoAtual = null;
        estado.sessaoAtual = criarSessaoQuiz(questoes);

        UI.ocultarCarregando();
        UI.mostrarTela('quiz');
        carregarQuestaoAtual();
    } catch (err) {
        UI.ocultarCarregando();
        console.error('Erro ao inicializar simulado:', err);

        UI.mostrarErro(
            MENSAGENS.erroCarregarQuestoes,
            {
                onTentarNovamente: () => iniciarSimulado()
            }
        );
    } finally {
        if (btnIniciar) {
            btnIniciar.disabled = false;
            btnIniciar.textContent = MENSAGENS.iniciarSimulado;
        }
    }
}

/**
 * Submete e corrige a resposta da questão atual
 */
function confirmarResposta() {
    if (!estado.alternativaSelecionada) {
        alert(MENSAGENS.selecionarAlternativa);
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
        alert(MENSAGENS.erroRegistrarResposta);
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
        const aluno = obterDadosAluno();
        const payload = {
            ...aluno,
            ...relatorio.resumo,
            createdAt: new Date().toISOString(),
            idempotencyKey: novoIdentificador(),
            respostas: estado.historicoTentativa.map(({ resposta }) => ({ ...resposta }))
        };
        estado.resultadoAtual = payload;

        UI.mostrarTela('result');
        UI.renderizarRelatorio(relatorio);
        UI.renderizarRevisaoQuestoes(estado.historicoTentativa);

        // Sincroniza resultado com a API REST
        await sincronizarResultadoAtual(payload);
    }
}

/**
 * Envia o resultado do simulado para a API (POST /api/results)
 * e gerencia os estados de sincronização
 */
async function enviarPontuacao(payload) {
    let aluno = obterDadosAluno();
    if (!aluno || (payload.deviceId && payload.deviceId !== aluno.deviceId) ||
        (payload.studentId && payload.studentId !== aluno.studentId)) {
        throw new Error('A tentativa pertence a outro cadastro.');
    }

    if (!aluno.studentId) {
        const registrado = await registrarAlunoAPI(aluno);
        const atual = obterDadosAluno();
        if (!atual || ['deviceId', 'nome', 'turma', 'matricula'].some(campo => atual[campo] !== aluno[campo])) {
            throw new Error('O cadastro mudou durante o envio.');
        }
        aluno = salvarDadosAluno({ ...atual, studentId: registrado.id });
    }

    await enviarResultadoAPI({ ...payload, deviceId: payload.deviceId || aluno.deviceId, studentId: payload.studentId || aluno.studentId });
    const pendente = obterResultadosPendentes().find(item => item.payload.idempotencyKey === payload.idempotencyKey);
    if (pendente) removerResultadoPendente(pendente.id);
}

async function sincronizarResultadoAtual(payload) {
    const guardado = enfileirarResultadoPendente(payload);
    if (estado.resultadoAtual === payload) {
        UI.atualizarStatusSincronizacao({ status: 'pending', mensagem: MENSAGENS.salvandoPontuacao });
    }

    try {
        await enviarPontuacao(payload);
        if (estado.resultadoAtual === payload) {
            UI.atualizarStatusSincronizacao({ status: 'synced', mensagem: MENSAGENS.pontuacaoSalva(payload.turma) });
        }
        await tentarSincronizarFilaPendente();
    } catch (err) {
        console.warn('Falha ao enviar resultado para a API online:', err);
        if (estado.resultadoAtual === payload) {
            UI.atualizarStatusSincronizacao({
                status: 'failed',
                mensagem: guardado ? MENSAGENS.pontuacaoPendente : MENSAGENS.pontuacaoNaoGuardada,
                onTentarSincronizar: () => sincronizarResultadoAtual(payload)
            });
        }
    }
}

/**
 * Tenta enviar resultados que ficaram pendentes na fila offline
 */
async function tentarSincronizarFilaPendente() {
    const fila = obterResultadosPendentes();
    if (!Array.isArray(fila) || fila.length === 0) return;
    for (const item of fila) {
        const aluno = obterDadosAluno();
        if (!aluno) return;
        try {
            if ((item.payload.deviceId && item.payload.deviceId !== aluno.deviceId) ||
                (item.payload.studentId && item.payload.studentId !== aluno.studentId)) continue;
            await enviarPontuacao({ ...item.payload, createdAt: item.payload.createdAt || item.criadoEm });
            if (estado.resultadoAtual?.idempotencyKey === item.payload.idempotencyKey) {
                UI.atualizarStatusSincronizacao({ status: 'synced', mensagem: MENSAGENS.pontuacaoSalva(item.payload.turma) });
            }
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

    if (modal) !modal.open && modal.showModal();

    // Turma padrão a consultar
    const turmaAlvo = turma !== null ? turma : (selectTurma ? selectTurma.value : (aluno ? aluno.turma : 'Todas'));

    return carregarDadosRanking(turmaAlvo);
}

function fecharRanking() {
    estado.consultaRanking++;
    const modal = document.getElementById('modal-ranking');
    if (modal) modal.close();
}

/**
 * Consulta a API e renderiza a tabela de ranking
 */
async function carregarDadosRanking(turmaFiltro = 'Todas') {
    const consulta = ++estado.consultaRanking;
    const container = document.getElementById('ranking-conteudo-container');

    if (container) {
        container.replaceChildren();
        const p = document.createElement('p');
        p.style.color = '#64748b';
        p.style.textAlign = 'center';
        p.style.padding = '1.5rem';
        p.textContent = MENSAGENS.carregandoRanking;
        container.appendChild(p);
    }

    try {
        await tentarSincronizarFilaPendente();
        if (consulta !== estado.consultaRanking) return;
        const aluno = obterDadosAluno();
        const classNameParam = (turmaFiltro && turmaFiltro !== 'Todas') ? turmaFiltro : '';
        const dados = await obterRankingsAPI({ className: classNameParam, limit: 30 });
        if (consulta !== estado.consultaRanking) return;

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
        if (consulta !== estado.consultaRanking) return;
        console.error('Erro ao consultar ranking:', err);
        if (container) {
            container.replaceChildren();
            const divErro = document.createElement('div');
            divErro.style.textAlign = 'center';
            divErro.style.padding = '1.5rem';

            const pErro = document.createElement('p');
            pErro.style.color = '#dc2626';
            pErro.style.marginBottom = '0.75rem';
            pErro.textContent = MENSAGENS.erroCarregarRanking;

            const btnRecarregar = document.createElement('button');
            btnRecarregar.className = 'btn btn-outline';
            btnRecarregar.textContent = MENSAGENS.botaoTentarNovamente;
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
async function salvarCadastroAluno(e, prefixo = 'input-aluno', fecharModal = false) {
    if (e) e.preventDefault();

    const inputNome = document.getElementById(`${prefixo}-nome`);
    const inputTurma = document.getElementById(`${prefixo}-turma`);
    const inputMatricula = document.getElementById(`${prefixo}-matricula`);

    try {
        const cadastro = {
            nome: inputNome ? inputNome.value : '',
            turma: inputTurma ? inputTurma.value : '',
            matricula: inputMatricula ? inputMatricula.value : '',
            deviceId: obterIdentificadorDispositivo(),
            studentId: obterDadosAluno()?.studentId
        };
        const remoto = await registrarAlunoAPI(cadastro);
        const aluno = salvarDadosAluno({ ...cadastro, studentId: remoto.id });

        UI.atualizarIdentificacaoAluno(aluno);
        estado.turmasConhecidas.add(aluno.turma);
        if (fecharModal) fecharModalEdicaoAluno();
        await tentarSincronizarFilaPendente();
    } catch (err) {
        alert(err.status === 409 ? MENSAGENS.nomeJaCadastrado : MENSAGENS.erroSalvarCadastro);
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

    if (modal) !modal.open && modal.showModal();
}

function fecharModalEdicaoAluno() {
    const modal = document.getElementById('modal-aluno');
    if (modal) modal.close();
}

function salvarEdicaoModalAluno(e) {
    return salvarCadastroAluno(e, 'input-modal', true);
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
        p.textContent = MENSAGENS.historicoVazio;
        container.appendChild(p);
    } else {
        const relatorio = gerarRelatorioCompleto(historico);

        const statsGrid = document.createElement('div');
        statsGrid.className = 'stats-grid';
        statsGrid.style.marginTop = '1rem';

        [
            { valor: relatorio.resumo.total, label: MENSAGENS.totalGeral },
            { valor: relatorio.resumo.acertos, label: MENSAGENS.acertos, cor: '#10b981' },
            { valor: `${relatorio.resumo.taxaAcerto}%`, label: MENSAGENS.aproveitamento }
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
        h4.textContent = MENSAGENS.assuntosRecomendadosTitulo;

        container.appendChild(statsGrid);
        container.appendChild(h4);

        if (relatorio.assuntosPrioritarios.length === 0) {
            const p = document.createElement('p');
            p.style.color = '#64748b';
            p.style.fontSize = '0.9rem';
            p.textContent = MENSAGENS.semQuestoesRecomendacao;
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
                const prioridade = rotuloPrioridade(item.ipe);
                const txt = document.createTextNode(MENSAGENS.prioridadeHistorico(item, prioridade.texto));
                li.appendChild(strong);
                li.appendChild(txt);
                ul.appendChild(li);
            });

            container.appendChild(ul);
        }
    }

    !modal.open && modal.showModal();
}

function handleLimparHistorico() {
    if (confirm(MENSAGENS.confirmarLimparHistorico)) {
        limparHistoricoLocal();
        abrirHistorico();
    }
}

// ========================================================
// INICIALIZAÇÃO DA APLICAÇÃO NO DOM
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
    UI.inicializarTextos();
    // 1. Inicializa identificação do aluno se já existir
    const alunoSalvo = obterDadosAluno();
    UI.atualizarIdentificacaoAluno(alunoSalvo);
    if (alunoSalvo && alunoSalvo.turma) {
        estado.turmasConhecidas.add(alunoSalvo.turma);
        registrarAlunoAPI(alunoSalvo).then(remoto => {
            const atual = obterDadosAluno();
            if (atual && ['deviceId', 'nome', 'turma', 'matricula'].every(campo => atual[campo] === alunoSalvo[campo])) {
                salvarDadosAluno({ ...atual, studentId: remoto.id });
            }
            return tentarSincronizarFilaPendente();
        }).catch(error => {
            console.warn('Falha ao sincronizar cadastro do aluno na inicialização:', error);
        });
    }

    // 2. Verifica a saúde da API REST
    verificarSaudeAPI().then(() => tentarSincronizarFilaPendente()).catch(err => console.warn('Backend indisponível na inicialização:', err));
    window.addEventListener('online', tentarSincronizarFilaPendente);

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
            return carregarDadosRanking(e.target.value);
        });
    }

    // 6. Eventos do Histórico Local
    const btnVerHistorico = document.getElementById('btn-ver-historico');
    if (btnVerHistorico) btnVerHistorico.addEventListener('click', abrirHistorico);

    const btnFecharHistorico = document.getElementById('btn-fechar-historico');
    if (btnFecharHistorico) btnFecharHistorico.addEventListener('click', () => {
        const modal = document.getElementById('modal-history');
        if (modal) modal.close();
    });

    const btnFecharHistoricoRodape = document.getElementById('btn-fechar-historico-rodape');
    if (btnFecharHistoricoRodape) btnFecharHistoricoRodape.addEventListener('click', () => document.getElementById('modal-history').close());

    const btnLimparHist = document.getElementById('btn-limpar-historico');
    if (btnLimparHist) btnLimparHist.addEventListener('click', handleLimparHistorico);

    const btnFecharErro = document.getElementById('btn-fechar-erro');
    if (btnFecharErro) btnFecharErro.addEventListener('click', () => UI.ocultarErro());

    // 7. Navegação e Acessibilidade por Teclado (RNF01, RNF05)
    window.addEventListener('keydown', (e) => {
        const modalAtivo = document.querySelector('dialog[open]');
        if (modalAtivo) return;

        // Se o foco estiver em um input de texto, não captura teclas de atalho
        if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) return;

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
