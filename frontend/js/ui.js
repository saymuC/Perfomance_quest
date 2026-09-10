/**
 * PERFORMANCE QUEST - MÓDULO DE INTERFACE DO USUÁRIO (UI)
 * Gerencia a renderização dos componentes no DOM e transições de tela.
 */

export const UI = {
    // Referências aos elementos principais
    screens: {
        home: document.getElementById('screen-home'),
        quiz: document.getElementById('screen-quiz'),
        result: document.getElementById('screen-result')
    },

    statusBadge: document.getElementById('api-status-badge'),

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
     * Atualiza o indicador de status da fonte de dados (Online API / Fallback Local)
     */
    atualizarStatusFonte(fonte) {
        if (!this.statusBadge) return;
        if (fonte === 'api') {
            this.statusBadge.className = 'badge badge-success';
            this.statusBadge.innerHTML = '● Conectado: api.enem.dev';
        } else {
            this.statusBadge.className = 'badge badge-warning';
            this.statusBadge.innerHTML = '▲ Modo Contingência Local';
        }
    },

    /**
     * Renderiza a questão atual no Quiz
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
            feedbackBanner.innerHTML = '';
        }
        if (btnConfirmar) {
            btnConfirmar.style.display = 'inline-flex';
            btnConfirmar.disabled = true;
        }
        if (btnProxima) {
            btnProxima.style.display = 'none';
        }

        // Metadados
        if (areaBadge) areaBadge.textContent = questao.area || 'ENEM';
        if (assuntoBadge) assuntoBadge.textContent = questao.assunto || 'Geral';
        if (counterText) counterText.textContent = `Questão ${indice} de ${total}`;
        if (progressFill) {
            const porcentagem = Math.round(((indice - 1) / total) * 100);
            progressFill.style.width = `${porcentagem}%`;
        }

        // Enunciado
        if (questionText) {
            questionText.textContent = questao.enunciado || 'Enunciado não disponível.';
        }

        // Alternativas
        if (alternativesContainer) {
            alternativesContainer.innerHTML = '';

            (questao.alternativas || []).forEach(alt => {
                const optEl = document.createElement('div');
                optEl.className = 'alt-option';
                optEl.dataset.letra = alt.letra || alt.id;

                optEl.innerHTML = `
                    <span class="alt-letter">${alt.letra || alt.id}</span>
                    <span class="alt-text">${alt.texto || ''}</span>
                `;

                optEl.addEventListener('click', () => {
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
     * RF06 & RN03: Exibe o feedback imediato da resposta corrigida
     */
    exibirFeedback({ acertou, alternativaCorreta, explicacao, ehUltimaQuestao }) {
        const feedbackBanner = document.getElementById('quiz-feedback');
        const btnConfirmar = document.getElementById('btn-confirmar-resposta');
        const btnProxima = document.getElementById('btn-proxima-questao');

        // Bloqueia as opções para cumprir RN03 (não permite alterar após submeter)
        document.querySelectorAll('.alt-option').forEach(el => {
            el.classList.add('locked');
            const letra = el.dataset.letra;
            if (letra === alternativaCorreta) {
                el.classList.add('correct');
            } else if (el.classList.contains('selected') && !acertou) {
                el.classList.add('incorrect');
            }
        });

        // Exibe o banner explicativo
        if (feedbackBanner) {
            feedbackBanner.className = `feedback-banner show ${acertou ? 'correct' : 'incorrect'}`;
            feedbackBanner.innerHTML = `
                <div class="feedback-title">
                    <span>${acertou ? '✓ Resposta Correta!' : '✕ Resposta Incorreta!'}</span>
                </div>
                <div class="feedback-explanation">
                    <strong>Gabarito oficial: Alternativa ${alternativaCorreta}.</strong>
                    ${explicacao ? `<p style="margin-top: 4px;">${explicacao}</p>` : ''}
                </div>
            `;
        }

        if (btnConfirmar) btnConfirmar.style.display = 'none';
        if (btnProxima) {
            btnProxima.style.display = 'inline-flex';
            btnProxima.textContent = ehUltimaQuestao ? 'Ver Diagnóstico Completo →' : 'Próxima Questão →';
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
     * RF08, RF09 e RF10: Renderiza a tela de resultados com os 3 assuntos prioritários
     */
    renderizarRelatorio(relatorio) {
        const { resumo, assuntosPrioritarios, desempenhoPorArea } = relatorio;

        // Resumo estatístico
        const totalEl = document.getElementById('resumo-total');
        const acertosEl = document.getElementById('resumo-acertos');
        const taxaEl = document.getElementById('resumo-taxa');
        const mensagemEl = document.getElementById('resumo-mensagem');

        if (totalEl) totalEl.textContent = resumo.total;
        if (acertosEl) acertosEl.textContent = resumo.acertos;
        if (taxaEl) taxaEl.textContent = `${resumo.taxaAcerto}%`;
        if (mensagemEl) mensagemEl.textContent = resumo.mensagem;

        // Destaque IA: Top 3 Assuntos Prioritários (IPE)
        const priorityContainer = document.getElementById('ai-priority-container');
        if (priorityContainer) {
            if (!assuntosPrioritarios || assuntosPrioritarios.length === 0) {
                priorityContainer.innerHTML = `
                    <p style="color: #64748b; font-size: 0.95rem; margin-top: 0.5rem;">
                        Responda a mais questões de um mesmo assunto para que o algoritmo de IA identifique com precisão seus 3 pontos prioritários de estudo (mínimo de 2 respostas por assunto).
                    </p>
                `;
            } else {
                priorityContainer.innerHTML = assuntosPrioritarios.map((item, idx) => `
                    <div class="priority-item">
                        <div class="priority-header">
                            <span class="priority-subject">#${idx + 1} ${item.assunto}</span>
                            <span class="badge badge-error">IPE: ${(item.ipe * 100).toFixed(0)}</span>
                        </div>
                        <div class="priority-metric">
                            Taxa de acerto: <strong>${item.taxaAcerto.toFixed(0)}%</strong> (${item.acertos}/${item.total} acertos) • 
                            Tempo médio: <strong>${Math.round(item.tempoMedio)}s</strong>/questão
                        </div>
                        <p style="font-size: 0.85rem; color: #475569; margin-top: 2px;">
                            💡 <em>Recomendação IA:</em> Dedique seus próximos ciclos de revisão focado na teoria e resolução de exercícios desse tema.
                        </p>
                    </div>
                `).join('');
            }
        }

        // Desempenho por Área do ENEM
        const areaContainer = document.getElementById('area-breakdown-container');
        if (areaContainer && desempenhoPorArea) {
            areaContainer.innerHTML = Object.entries(desempenhoPorArea).map(([area, dados]) => `
                <div class="area-item">
                    <div class="area-info">
                        <span>${area}</span>
                        <span>${dados.taxaAcerto}% (${dados.acertos}/${dados.total})</span>
                    </div>
                    <div class="area-track">
                        <div class="area-fill" style="width: ${dados.taxaAcerto}%;"></div>
                    </div>
                </div>
            `).join('');
        }
    }
};
