/**
 * PERFORMANCE QUEST - MÓDULO DE INTERFACE DO USUÁRIO (UI)
 * 
 * Gerencia a renderização segura no DOM, transições de tela,
 * modal de ranking, estados de carregamento, erro e sincronização.
 * 
 * NOTA DE SEGURANÇA: Todos os dados externos (API, LocalStorage, entradas de usuário)
 * são inseridos de forma segura (via textContent ou escapeHTML) para prevenir XSS.
 */

import { MENSAGENS } from './mensagens.js';

function permitirRecarregarImagem(img) {
    img.onerror = () => {
        img.hidden = true;
        if (img.nextElementSibling?.className === 'imagem-indisponivel') return;
        const aviso = document.createElement('span');
        aviso.className = 'imagem-indisponivel';
        aviso.textContent = MENSAGENS.imagemIndisponivel;
        const tentar = document.createElement('button');
        tentar.type = 'button';
        tentar.className = 'btn btn-outline';
        tentar.textContent = MENSAGENS.botaoTentarNovamente;
        tentar.onclick = e => {
            e.preventDefault();
            img.src = img.src;
        };
        aviso.appendChild(tentar);
        img.after(aviso);
        img.onload = () => { img.hidden = false; aviso.remove(); };
    };
}

/**
 * Utilitário para escapar caracteres perigosos de HTML
 */
export function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Retorna o rótulo amigável e a classe CSS com base no IPE (Índice de Prioridade de Estudo)
 * @param {number} ipe - Valor entre 0 e 1 (taxa de erro do assunto)
 * @returns {{ texto: string, classe: string }}
 */
export function rotuloPrioridade(ipe) {
    if (ipe >= 0.7) {
        return { texto: 'Prioridade alta', classe: 'badge-error' };
    }
    if (ipe >= 0.4) {
        return { texto: 'Prioridade média', classe: 'badge-warning' };
    }
    return { texto: 'Prioridade baixa', classe: 'badge-success' };
}

export const UI = {
    // Referências dinâmicas aos elementos principais
    screens: {
        get home() { return typeof document !== 'undefined' ? document.getElementById('screen-home') : null; },
        get quiz() { return typeof document !== 'undefined' ? document.getElementById('screen-quiz') : null; },
        get result() { return typeof document !== 'undefined' ? document.getElementById('screen-result') : null; }
    },

    get loadingOverlay() { return typeof document !== 'undefined' ? document.getElementById('app-loading-overlay') : null; },
    get loadingText() { return typeof document !== 'undefined' ? document.getElementById('loading-overlay-text') : null; },
    get errorBanner() { return typeof document !== 'undefined' ? document.getElementById('app-error-banner') : null; },

    /**
     * Alterna entre as telas da aplicação
     */
    mostrarTela(nomeTela) {
        Object.entries(this.screens).forEach(([chave, elemento]) => {
            if (elemento) {
                elemento.classList.toggle('active', chave === nomeTela);
            }
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Exibe o overlay de carregamento global
     */
    mostrarCarregando(mensagem = 'Carregando...') {
        if (this.loadingOverlay) {
            if (this.loadingText) this.loadingText.textContent = mensagem;
            this.loadingOverlay.style.display = 'flex';
        }
    },

    /**
     * Oculta o overlay de carregamento global
     */
    ocultarCarregando() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    },

    /**
     * Exibe banner de erro de forma segura com ações de recuperação
     */
    mostrarErro(mensagem, { onTentarNovamente = null } = {}) {
        if (!this.errorBanner) return;

        const messageEl = document.getElementById('error-banner-message');
        const actionsEl = document.getElementById('error-banner-actions');

        if (messageEl) {
            messageEl.textContent = mensagem || MENSAGENS.erroGenericoDesc;
        }

        if (actionsEl) {
            actionsEl.replaceChildren(); // Limpa ações anteriores com segurança

            if (onTentarNovamente) {
                const btnRetry = document.createElement('button');
                btnRetry.className = 'btn btn-outline';
                btnRetry.style.fontSize = '0.8rem';
                btnRetry.style.padding = '0.3rem 0.75rem';
                btnRetry.textContent = MENSAGENS.botaoTentarNovamente;
                btnRetry.addEventListener('click', () => {
                    this.ocultarErro();
                    onTentarNovamente();
                });
                actionsEl.appendChild(btnRetry);
            }
        }

        this.errorBanner.style.display = 'flex';
    },

    /**
     * Oculta o banner de erro
     */
    ocultarErro() {
        if (this.errorBanner) {
            this.errorBanner.style.display = 'none';
        }
    },

    /**
     * Atualiza a identificação do aluno no header e no card da tela inicial
     */
    atualizarIdentificacaoAluno(aluno) {
        const headerContainer = document.getElementById('header-aluno-container');
        const headerTexto = document.getElementById('header-aluno-texto');
        const cadastradoView = document.getElementById('aluno-cadastrado-view');
        const formCadastro = document.getElementById('form-cadastro-aluno');
        const cardNome = document.getElementById('card-aluno-nome');
        const cardTurma = document.getElementById('card-aluno-turma');
        const cardMatricula = document.getElementById('card-aluno-matricula');

        if (aluno && aluno.nome) {
            // Header
            if (headerContainer && headerTexto) {
                headerTexto.textContent = `${aluno.nome} (${aluno.turma})`;
                headerContainer.style.display = 'inline-flex';
            }

            // Home Card
            if (cadastradoView) cadastradoView.style.display = 'block';
            if (formCadastro) formCadastro.style.display = 'none';
            if (cardNome) cardNome.textContent = aluno.nome;
            if (cardTurma) cardTurma.textContent = aluno.turma;
            if (cardMatricula) cardMatricula.textContent = aluno.matricula;
        } else {
            if (headerContainer) headerContainer.style.display = 'none';
            if (cadastradoView) cadastradoView.style.display = 'none';
            if (formCadastro) formCadastro.style.display = 'block';
        }
    },

    /**
     * Renderiza a questão atual no Quiz de forma 100% segura (sem innerHTML perigoso)
     */
    renderizarQuestao({ questao, indice, total, onSelecionarAlternativa }) {
        const areaBadge = document.getElementById('quiz-area-badge');
        const assuntoBadge = document.getElementById('quiz-assunto-badge');
        const counterText = document.getElementById('quiz-counter');
        const progressFill = document.getElementById('quiz-progress-fill');
        const questionText = document.getElementById('quiz-question-text');
        const alternativesContainer = document.getElementById('quiz-alternatives');
        const feedbackBanner = document.getElementById('quiz-feedback');
        const btnConfirmar = document.getElementById('btn-confirmar-resposta');
        const btnProxima = document.getElementById('btn-proxima-questao');

        // Resetar botões e feedback
        if (feedbackBanner) {
            feedbackBanner.className = 'feedback-banner';
            feedbackBanner.replaceChildren();
        }
        if (btnConfirmar) {
            btnConfirmar.style.display = 'inline-flex';
            btnConfirmar.disabled = true;
        }
        if (btnProxima) {
            btnProxima.style.display = 'none';
        }

        // Metadados seguros
        if (areaBadge) areaBadge.textContent = questao.area || 'ENEM';
        if (assuntoBadge) assuntoBadge.textContent = questao.assunto || 'Geral';
        if (counterText) counterText.textContent = `Questão ${indice} de ${total}`;
        if (progressFill) {
            const porcentagem = Math.round(((indice - 1) / total) * 100);
            progressFill.style.width = `${porcentagem}%`;
        }

        // Enunciado (seguro com textContent)
        if (questionText) {
            questionText.replaceChildren();
            const enunciado = String(questao.enunciado || 'Enunciado não disponível.')
                .replace(/\\n/g, '\n');
            const imagemMarkdown = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
            let inicio = 0;
            let imagem;

            while ((imagem = imagemMarkdown.exec(enunciado))) {
                questionText.append(document.createTextNode(enunciado.slice(inicio, imagem.index)));
                const img = document.createElement('img');
                img.src = imagem[1];
                img.alt = 'Imagem da questão';
                img.loading = 'lazy';
                permitirRecarregarImagem(img);
                questionText.append(img);
                inicio = imagemMarkdown.lastIndex;
            }

            questionText.append(document.createTextNode(enunciado.slice(inicio)));
        }

        // Alternativas criadas com elementos DOM seguros
        if (alternativesContainer) {
            alternativesContainer.replaceChildren();

            (questao.alternativas || []).forEach(alt => {
                const optEl = document.createElement('label');
                optEl.className = 'alt-option';
                optEl.dataset.letra = alt.letra || alt.id;
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'alternativa';
                radio.value = alt.letra || alt.id;
                optEl.appendChild(radio);

                const letterSpan = document.createElement('span');
                letterSpan.className = 'alt-letter';
                letterSpan.textContent = alt.letra || alt.id;
                optEl.appendChild(letterSpan);

                if (alt.texto) {
                    const textSpan = document.createElement('span');
                    textSpan.className = 'alt-text';
                    textSpan.textContent = alt.texto;
                    optEl.appendChild(textSpan);
                }

                if (alt.imagem) {
                    const img = document.createElement('img');
                    img.className = 'alt-image';
                    img.src = alt.imagem;
                    img.alt = `Imagem da alternativa ${alt.letra || alt.id}`;
                    img.loading = 'lazy';
                    permitirRecarregarImagem(img);
                    optEl.appendChild(img);
                }

                const hintSpan = document.createElement('span');
                hintSpan.className = 'alt-key-hint';
                hintSpan.textContent = `Tecla ${alt.letra || alt.id}`;

                optEl.appendChild(hintSpan);

                radio.addEventListener('change', () => {
                    if (optEl.classList.contains('locked')) return;

                    document.querySelectorAll('.alt-option').forEach(el => el.classList.remove('selected'));
                    optEl.classList.add('selected');

                    if (btnConfirmar) btnConfirmar.disabled = false;
                    if (onSelecionarAlternativa) onSelecionarAlternativa(alt.letra || alt.id);
                });

                alternativesContainer.appendChild(optEl);
            });
        }
    },

    /**
     * RF06 & RN03: Exibe o feedback imediato da resposta corrigida de forma segura
     */
    exibirFeedback({ acertou, alternativaCorreta, explicacao, ehUltimaQuestao }) {
        const feedbackBanner = document.getElementById('quiz-feedback');
        const btnConfirmar = document.getElementById('btn-confirmar-resposta');
        const btnProxima = document.getElementById('btn-proxima-questao');

        // Bloqueia as opções para cumprir RN03
        document.querySelectorAll('.alt-option').forEach(el => {
            el.classList.add('locked');
            el.querySelector('input').disabled = true;
            const letra = el.dataset.letra;
            if (letra === alternativaCorreta) {
                el.classList.add('correct');
            } else if (el.classList.contains('selected') && !acertou) {
                el.classList.add('incorrect');
            }
        });

        if (feedbackBanner) {
            feedbackBanner.className = `feedback-banner show ${acertou ? 'correct' : 'incorrect'}`;
            feedbackBanner.replaceChildren();

            const titleDiv = document.createElement('div');
            titleDiv.className = 'feedback-title';
            titleDiv.textContent = acertou ? '✓ Parabéns, resposta correta!' : '✕ Resposta incorreta';

            const expDiv = document.createElement('div');
            expDiv.className = 'feedback-explanation';

            const gabaritoStrong = document.createElement('strong');
            gabaritoStrong.textContent = `Gabarito oficial: Alternativa ${alternativaCorreta}.`;
            expDiv.appendChild(gabaritoStrong);

            const pExp = document.createElement('p');
            pExp.style.marginTop = '4px';
            pExp.textContent = explicacao || 'Confira o enunciado e a alternativa correta para revisar o raciocínio desta questão.';
            expDiv.appendChild(pExp);

            feedbackBanner.appendChild(titleDiv);
            feedbackBanner.appendChild(expDiv);
        }

        if (btnConfirmar) btnConfirmar.style.display = 'none';
        if (btnProxima) {
            btnProxima.style.display = 'inline-flex';
            btnProxima.replaceChildren();
            const btnText = document.createTextNode(ehUltimaQuestao ? 'Ver Diagnóstico Completo → ' : 'Próxima Questão → ');
            const kbd = document.createElement('kbd');
            kbd.className = 'kbd-hint';
            kbd.textContent = 'Enter ↵';
            btnProxima.appendChild(btnText);
            btnProxima.appendChild(kbd);
            btnProxima.focus();
        }
    },

    /**
     * Atualiza o cronômetro da questão atual
     */
    atualizarTimer(segundos) {
        const timerEl = document.getElementById('quiz-timer-text');
        if (!timerEl) return;
        const mins = Math.floor(segundos / 60);
        const secs = segundos % 60;
        timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    },

    /**
     * Atualiza o card de status de sincronização pós-quiz
     */
    atualizarStatusSincronizacao({ status, mensagem = '', onTentarSincronizar = null } = {}) {
        const card = document.getElementById('result-sync-card');
        const iconEl = document.getElementById('sync-icon');
        const textEl = document.getElementById('sync-status-texto');
        const btnRetry = document.getElementById('btn-tentar-sincronizar');

        if (!card || !textEl) return;

        card.className = 'sync-card';
        if (btnRetry) btnRetry.style.display = 'none';

        if (status === 'synced') {
            card.classList.add('synced');
            if (iconEl) iconEl.textContent = '🟢';
            textEl.textContent = mensagem || MENSAGENS.pontuacaoSalva();
        } else if (status === 'failed') {
            card.classList.add('failed');
            if (iconEl) iconEl.textContent = '🔴';
            textEl.textContent = mensagem || MENSAGENS.pontuacaoPendente;
            if (btnRetry && onTentarSincronizar) {
                btnRetry.style.display = 'inline-flex';
                btnRetry.onclick = onTentarSincronizar;
            }
        } else if (status === 'pending') {
            card.classList.add('pending');
            if (iconEl) iconEl.textContent = '⏳';
            textEl.textContent = mensagem || MENSAGENS.salvandoPontuacao;
        }
    },

    /**
     * Renderiza o relatório final do quiz
     */
    renderizarRelatorio(relatorio) {
        const { resumo, assuntosPrioritarios, desempenhoPorArea, desempenhoPorAssunto } = relatorio;

        const totalEl = document.getElementById('resumo-total');
        const acertosEl = document.getElementById('resumo-acertos');
        const taxaEl = document.getElementById('resumo-taxa');
        const tempoEl = document.getElementById('resumo-tempo');
        const mensagemEl = document.getElementById('resumo-mensagem');

        if (totalEl) totalEl.textContent = resumo.total;
        if (acertosEl) acertosEl.textContent = resumo.acertos;
        if (taxaEl) taxaEl.textContent = `${resumo.taxaAcerto}%`;
        if (tempoEl) {
            const mins = Math.floor((resumo.tempoTotalSegundos || 0) / 60);
            const secs = (resumo.tempoTotalSegundos || 0) % 60;
            tempoEl.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        }
        if (mensagemEl) mensagemEl.textContent = resumo.mensagem;

        // Destaque IA: Top 3 Assuntos Prioritários (IPE)
        const priorityContainer = document.getElementById('ai-priority-container');
        if (priorityContainer) {
            priorityContainer.replaceChildren();

            if (!assuntosPrioritarios || assuntosPrioritarios.length === 0) {
                const p = document.createElement('p');
                p.style.color = '#64748b';
                p.style.fontSize = '0.95rem';
                p.style.marginTop = '0.5rem';
                p.textContent = MENSAGENS.semQuestoesRecomendacao;
                priorityContainer.appendChild(p);
            } else {
                assuntosPrioritarios.forEach((item, idx) => {
                    const div = document.createElement('div');
                    div.className = 'priority-item';

                    const header = document.createElement('div');
                    header.className = 'priority-header';

                    const subjSpan = document.createElement('span');
                    subjSpan.className = 'priority-subject';
                    subjSpan.textContent = `#${idx + 1} ${item.assunto}`;

                    const prioridade = rotuloPrioridade(item.ipe);
                    const badgeIpe = document.createElement('span');
                    badgeIpe.className = `badge ${prioridade.classe}`;
                    badgeIpe.textContent = prioridade.texto;

                    header.appendChild(subjSpan);
                    header.appendChild(badgeIpe);

                    const metric = document.createElement('div');
                    metric.className = 'priority-metric';
                    metric.textContent = `Taxa de acerto: ${item.taxaAcerto.toFixed(0)}% (${item.acertos}/${item.total} acertos) • Tempo médio: ${Math.round(item.tempoMedio)}s/questão`;

                    const tip = document.createElement('p');
                    tip.style.fontSize = '0.85rem';
                    tip.style.color = '#475569';
                    tip.style.marginTop = '2px';
                    tip.textContent = MENSAGENS.dicaEstudo;

                    div.appendChild(header);
                    div.appendChild(metric);
                    div.appendChild(tip);
                    priorityContainer.appendChild(div);
                });
            }
        }

        // Mesma apresentação para áreas e todos os assuntos respondidos.
        for (const [id, desempenho] of [['area-breakdown-container', desempenhoPorArea], ['subject-breakdown-container', desempenhoPorAssunto]]) {
            const areaContainer = document.getElementById(id);
            if (!areaContainer || !desempenho) continue;
            areaContainer.replaceChildren();

            Object.entries(desempenho).forEach(([area, dados]) => {
                const taxaAcerto = dados.total ? Math.round(dados.acertos / dados.total * 100) : 0;
                let badgeClass = 'badge-success';
                let badgeTexto = 'Alto Rendimento';
                let fillColor = '#10b981';

                if (!dados.total) {
                    badgeClass = '';
                    badgeTexto = MENSAGENS.aindaSemRespostas;
                    fillColor = '#94a3b8';
                } else if (taxaAcerto < 50) {
                    badgeClass = 'badge-error';
                    badgeTexto = 'Revisão Prioritária';
                    fillColor = '#ef4444';
                } else if (taxaAcerto < 70) {
                    badgeClass = 'badge-warning';
                    badgeTexto = 'Rendimento Regular';
                    fillColor = '#f59e0b';
                }

                const areaItem = document.createElement('div');
                areaItem.className = 'area-item';

                const info = document.createElement('div');
                info.className = 'area-info';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = area;

                const detailsDiv = document.createElement('div');
                detailsDiv.style.display = 'flex';
                detailsDiv.style.alignItems = 'center';
                detailsDiv.style.gap = '0.5rem';

                const badge = document.createElement('span');
                badge.className = `badge ${badgeClass}`;
                badge.style.fontSize = '0.7rem';
                badge.textContent = badgeTexto;

                const percentSpan = document.createElement('span');
                percentSpan.textContent = `${taxaAcerto}% (${dados.acertos}/${dados.total})`;

                detailsDiv.appendChild(badge);
                detailsDiv.appendChild(percentSpan);
                info.appendChild(nameSpan);
                info.appendChild(detailsDiv);

                const track = document.createElement('div');
                track.className = 'area-track';
                track.setAttribute('aria-hidden', 'true');
                const fill = document.createElement('div');
                fill.className = 'area-fill';
                fill.style.width = `${taxaAcerto}%`;
                fill.style.background = fillColor;
                track.appendChild(fill);

                areaItem.appendChild(info);
                areaItem.appendChild(track);
                areaContainer.appendChild(areaItem);
            });
        }
    },

    /**
     * RF10: Renderiza o gabarito detalhado questão por questão de forma 100% segura
     */
    renderizarRevisaoQuestoes(tentativaDetalhada = []) {
        const container = document.getElementById('revisao-questoes-container');
        const tagResumo = document.getElementById('revisao-resumo-tag');
        if (!container) return;

        if (tagResumo) {
            const acertos = tentativaDetalhada.filter(item => item.resposta && item.resposta.acertou).length;
            tagResumo.textContent = `${acertos}/${tentativaDetalhada.length} Acertos`;
        }

        container.replaceChildren();

        if (tentativaDetalhada.length === 0) {
            const p = document.createElement('p');
            p.style.color = '#64748b';
            p.style.fontSize = '0.9rem';
            p.textContent = 'Nenhuma questão respondida para revisão.';
            container.appendChild(p);
            return;
        }

        tentativaDetalhada.forEach((item, index) => {
            const { questao, resposta } = item;
            const acertou = resposta && resposta.acertou;

            const div = document.createElement('div');
            div.className = `revisao-item ${acertou ? 'correct-item' : 'incorrect-item'}`;

            // Header
            const header = document.createElement('div');
            header.className = 'revisao-header';

            const headerLeft = document.createElement('div');
            headerLeft.style.display = 'flex';
            headerLeft.style.gap = '0.4rem';
            headerLeft.style.alignItems = 'center';
            headerLeft.style.flexWrap = 'wrap';

            const strongQ = document.createElement('strong');
            strongQ.textContent = `Questão ${index + 1}`;

            const badgeArea = document.createElement('span');
            badgeArea.className = 'badge badge-primary';
            badgeArea.textContent = questao.area || 'ENEM';

            const badgeAssunto = document.createElement('span');
            badgeAssunto.className = 'badge badge-warning';
            badgeAssunto.textContent = questao.assunto || 'Geral';

            headerLeft.appendChild(strongQ);
            headerLeft.appendChild(badgeArea);
            headerLeft.appendChild(badgeAssunto);

            if (questao.ano) {
                const badgeAno = document.createElement('span');
                badgeAno.className = 'badge';
                badgeAno.style.background = '#f1f5f9';
                badgeAno.textContent = `ENEM ${questao.ano}`;
                headerLeft.appendChild(badgeAno);
            }

            const badgeStatus = document.createElement('span');
            badgeStatus.className = `badge ${acertou ? 'badge-success' : 'badge-error'}`;
            badgeStatus.textContent = `${acertou ? '✓ Acertou' : '✕ Errou'} (${resposta.tempoSegundos || 0}s)`;

            header.appendChild(headerLeft);
            header.appendChild(badgeStatus);

            // Enunciado
            const enunciado = document.createElement('div');
            enunciado.className = 'revisao-enunciado';
            enunciado.textContent = questao.enunciado || '';

            // Respostas
            const respDiv = document.createElement('div');
            respDiv.className = 'revisao-respostas';

            const suaResp = document.createElement('div');
            const strongSua = document.createElement('strong');
            strongSua.textContent = 'Sua resposta: ';
            const txtSua = document.createTextNode(`Alternativa ${resposta.alternativaEscolhida} `);
            const spanStatus = document.createElement('span');
            spanStatus.style.color = acertou ? '#10b981' : '#ef4444';
            spanStatus.style.fontWeight = '600';
            spanStatus.textContent = acertou ? '(Correta)' : '(Incorreta)';

            suaResp.appendChild(strongSua);
            suaResp.appendChild(txtSua);
            suaResp.appendChild(spanStatus);
            respDiv.appendChild(suaResp);

            if (!acertou) {
                const corretaDiv = document.createElement('div');
                const strongCorreta = document.createElement('strong');
                strongCorreta.textContent = 'Gabarito Oficial: ';
                const txtCorreta = document.createTextNode(`Alternativa ${resposta.alternativaCorreta}`);
                corretaDiv.appendChild(strongCorreta);
                corretaDiv.appendChild(txtCorreta);
                respDiv.appendChild(corretaDiv);
            }

            div.appendChild(header);
            div.appendChild(enunciado);
            div.appendChild(respDiv);

            if (questao.explicacao) {
                const expDiv = document.createElement('div');
                expDiv.className = 'revisao-explicacao';
                const strongExp = document.createElement('strong');
                strongExp.textContent = '💡 Explicação Pedagógica: ';
                const txtExp = document.createTextNode(questao.explicacao);
                expDiv.appendChild(strongExp);
                expDiv.appendChild(txtExp);
                div.appendChild(expDiv);
            }

            container.appendChild(div);
        });
    },

    /**
     * Renderiza o modal de ranking com tabela e cards responsivos
     * Seguro contra XSS (nomes de alunos são inseridos via textContent)
     */
    renderizarRanking({ ranking = [], turmas = [], turmaSelecionada = 'Todas', alunoAtual = null, onFiltrarTurma = null } = {}) {
        const container = document.getElementById('ranking-conteudo-container');
        const selectTurma = document.getElementById('ranking-filtro-turma');
        if (!container) return;

        // Atualiza o select de turmas se fornecido
        if (selectTurma && turmas.length > 0) {
            const valorAtual = selectTurma.value;
            selectTurma.replaceChildren();

            const optGeral = document.createElement('option');
            optGeral.value = 'Todas';
            optGeral.textContent = 'Todas as Turmas (Ranking Geral)';
            selectTurma.appendChild(optGeral);

            turmas.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = `Turma ${t}`;
                selectTurma.appendChild(opt);
            });

            selectTurma.value = turmaSelecionada || valorAtual || 'Todas';
        }

        container.replaceChildren();

        if (!Array.isArray(ranking) || ranking.length === 0) {
            const emptyP = document.createElement('p');
            emptyP.style.color = '#64748b';
            emptyP.style.textAlign = 'center';
            emptyP.style.padding = '2rem 1rem';
            emptyP.textContent = MENSAGENS.rankingVazio;
            container.appendChild(emptyP);
            return;
        }

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'ranking-table-wrapper';

        const table = document.createElement('table');
        table.className = 'ranking-table';

        // Cabeçalho da tabela
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        ['#', 'Estudante', 'Turma', 'Acertos', 'Aproveitamento', 'Tempo Total'].forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        // Corpo da tabela
        const tbody = document.createElement('tbody');

        ranking.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const pos = idx + 1;

            const nomeAluno = item.studentName || item.name || item.nome || 'Anônimo';
            const turmaAluno = item.className || item.turma || '-';
            const studentId = item.studentId || '';
            const acertos = item.score !== undefined ? item.score : (item.acertos || 0);
            const total = item.totalQuestions || item.total || 0;
            const percentual = item.percentual !== undefined ? item.percentual : (item.percentage !== undefined ? item.percentage : (item.taxaAcerto || 0));
            const tempo = item.totalTimeSeconds !== undefined ? item.totalTimeSeconds : (item.tempoSegundos || 0);

            // Destaque para o aluno atual
            if (alunoAtual && studentId && String(alunoAtual.studentId) === String(studentId)) {
                tr.className = 'current-student-row';
            }

            // Coluna Posição
            const tdPos = document.createElement('td');
            const spanPos = document.createElement('span');
            let posClass = 'rank-pos-other';
            let posIcon = `${pos}º`;
            if (pos === 1) { posClass = 'rank-pos-1'; posIcon = '🥇 1º'; }
            else if (pos === 2) { posClass = 'rank-pos-2'; posIcon = '🥈 2º'; }
            else if (pos === 3) { posClass = 'rank-pos-3'; posIcon = '🥉 3º'; }
            spanPos.className = `rank-pos ${posClass}`;
            spanPos.textContent = posIcon;
            tdPos.appendChild(spanPos);

            // Coluna Estudante (protegido contra XSS)
            const tdNome = document.createElement('td');
            tdNome.textContent = nomeAluno;
            if (alunoAtual && studentId && String(alunoAtual.studentId) === String(studentId)) {
                const badgeVoce = document.createElement('span');
                badgeVoce.className = 'badge badge-primary';
                badgeVoce.style.marginLeft = '6px';
                badgeVoce.style.fontSize = '0.7rem';
                badgeVoce.textContent = 'Você';
                tdNome.appendChild(badgeVoce);
            }

            // Coluna Turma
            const tdTurma = document.createElement('td');
            tdTurma.textContent = turmaAluno;

            // Coluna Acertos
            const tdAcertos = document.createElement('td');
            tdAcertos.textContent = total > 0 ? `${acertos}/${total}` : `${acertos}`;

            // Coluna Aproveitamento
            const tdPerc = document.createElement('td');
            const strongPerc = document.createElement('strong');
            strongPerc.textContent = `${Math.round(percentual)}%`;
            strongPerc.style.color = percentual >= 70 ? '#059669' : (percentual >= 50 ? '#d97706' : '#dc2626');
            tdPerc.appendChild(strongPerc);

            // Coluna Tempo
            const tdTempo = document.createElement('td');
            const mins = Math.floor(tempo / 60);
            const secs = tempo % 60;
            tdTempo.textContent = mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;

            tr.appendChild(tdPos);
            tr.appendChild(tdNome);
            tr.appendChild(tdTurma);
            tr.appendChild(tdAcertos);
            tr.appendChild(tdPerc);
            tr.appendChild(tdTempo);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        container.appendChild(tableWrapper);
    }
};
