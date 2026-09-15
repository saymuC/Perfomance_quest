/**
 * Módulo de Integração com a API REST do Backend
 * 
 * Consome EXCLUSIVAMENTE a API configurada em window.PERFORMANCE_QUEST_CONFIG.apiBaseUrl
 * (conforme especificado na nova arquitetura do README.md).
 */

const FALLBACK_PATH = './data/questoes_fallback.json';

/**
 * Retorna a URL base da API configurada
 */
export function getApiBaseUrl() {
    const config = window.PERFORMANCE_QUEST_CONFIG;
    if (config && typeof config.apiBaseUrl === 'string' && config.apiBaseUrl.trim() !== '') {
        return config.apiBaseUrl.replace(/\/+$/, '');
    }
    return 'http://localhost:3001/api';
}

/**
 * Normaliza uma questão para o formato esperado pelo frontend
 */
export function normalizarQuestao(q) {
    if (!q || typeof q !== 'object') {
        throw new Error('Questão em formato inválido recebida da API.');
    }

    const id = String(q.id || Math.random().toString(36).slice(2, 8));
    const area = q.area || 'Geral';
    const assunto = q.assunto || 'Tópico Geral';

    // Enunciado
    const enunciado = q.enunciado || q.statement || q.texto || q.context || 'Enunciado não disponível.';

    // Alternativas padronizadas: [{ letra: 'A', texto: '...' }]
    let alternativas = [];
    const altsArray = q.alternativas || q.alternatives;
    if (Array.isArray(altsArray)) {
        alternativas = altsArray.map(alt => {
            if (typeof alt === 'string') {
                return { letra: alt, texto: alt, id: alt };
            }
            const letra = String(alt.letra || alt.letter || alt.id || '').toUpperCase();
            const texto = alt.texto || alt.text || '';
            const isCorrect = Boolean(alt.isCorrect || alt.correta);
            return { letra, texto, id: letra, isCorrect };
        });
    } else if (altsArray && typeof altsArray === 'object') {
        alternativas = Object.entries(altsArray).map(([key, val]) => ({
            letra: String(key).toUpperCase(),
            texto: typeof val === 'string' ? val : (val.text || val.texto || ''),
            id: String(key).toUpperCase()
        }));
    }

    const gabarito = String(
        q.alternativaCorreta ||
        q.correctAlternative ||
        q.respostaCorreta ||
        q.gabarito ||
        (alternativas.find(a => a.isCorrect)?.letra) ||
        'A'
    ).toUpperCase();

    return {
        id,
        ano: q.ano || q.year || 2023,
        area,
        assunto,
        enunciado,
        alternativas,
        alternativaCorreta: gabarito,
        explicacao: q.explicacao || q.justification || `Gabarito oficial do ENEM: Alternativa ${gabarito}.`
    };
}

/**
 * Verifica o status de saúde da API (GET /api/health)
 */
export async function verificarSaudeAPI() {
    const baseUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return await res.json();
    } catch (e) {
        clearTimeout(timeout);
        throw new Error(`API offline ou inacessível em ${baseUrl}: ${e.message}`);
    }
}

/**
 * Obtém questões através da API configurada (GET /api/questions)
 */
export async function obterQuestoesSimulado({ area = 'Todas', quantidade = 10, ano = 2023 } = {}) {
    const baseUrl = getApiBaseUrl();
    const query = new URLSearchParams({
        area: area || 'Todas',
        quantity: String(quantidade || 10),
        year: String(ano || 2023)
    });

    const url = `${baseUrl}/questions?${query.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 segundos

    let response;
    try {
        response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
    } catch (err) {
        clearTimeout(timeout);
        const mensagemErro = err.name === 'AbortError'
            ? 'Tempo limite esgotado ao conectar com a API.'
            : `Falha de rede ao conectar com a API em ${baseUrl}.`;
        const erro = new Error(mensagemErro);
        erro.tipo = 'CONEXAO_FALHOU';
        erro.url = baseUrl;
        throw erro;
    }

    if (!response.ok) {
        const erro = new Error(`A API retornou erro HTTP ${response.status} (${response.statusText}).`);
        erro.status = response.status;
        erro.tipo = 'RESPOSTA_INVALIDA';
        throw erro;
    }

    const data = await response.json();
    const listaBruta = Array.isArray(data) ? data : (data.questions || data.questoes || []);

    if (!Array.isArray(listaBruta) || listaBruta.length === 0) {
        const erro = new Error('A API não retornou questões para os filtros selecionados.');
        erro.tipo = 'SEM_QUESTOES';
        throw erro;
    }

    const questoes = listaBruta.map(normalizarQuestao);

    return {
        questoes,
        fonte: 'api',
        totalDisponivel: questoes.length
    };
}

/**
 * Carrega a base de contingência local quando solicitado explicitamente
 */
export async function carregarQuestoesFallbackLocal() {
    const resposta = await fetch(FALLBACK_PATH);
    if (!resposta.ok) {
        throw new Error(`Falha ao carregar arquivo de contingência: ${resposta.statusText}`);
    }
    const data = await resposta.json();
    return {
        questoes: data.map(normalizarQuestao),
        fonte: 'fallback',
        totalDisponivel: data.length
    };
}

/**
 * Envia o resultado concluído para persistência no banco e ranking (POST /api/results)
 */
export async function enviarResultadoAPI(resultado) {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/results`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const payload = {
        // Campos em português e inglês para compatibilidade total com o backend
        studentName: resultado.nome,
        name: resultado.nome,
        className: resultado.turma,
        turma: resultado.turma,
        registrationNumber: resultado.matricula,
        matricula: resultado.matricula,
        score: resultado.acertos,
        acertos: resultado.acertos,
        totalQuestions: resultado.total,
        total: resultado.total,
        percentage: resultado.taxaAcerto,
        taxaAcerto: resultado.taxaAcerto,
        totalTimeSeconds: resultado.tempoTotalSegundos,
        tempoSegundos: resultado.tempoTotalSegundos,
        answers: resultado.respostas || [],
        createdAt: new Date().toISOString()
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
            throw new Error(`Erro do servidor ao registrar resultado (${res.status}).`);
        }

        return await res.json().catch(() => ({ sucesso: true }));
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

/**
 * Consulta o ranking geral ou por turma (GET /api/rankings)
 */
export async function obterRankingsAPI({ className = '', limit = 20 } = {}) {
    const baseUrl = getApiBaseUrl();
    const params = new URLSearchParams();
    if (className && className !== 'Todas') {
        params.append('className', className);
    }
    if (limit) {
        params.append('limit', String(limit));
    }

    const qs = params.toString() ? `?${params.toString()}` : '';
    const url = `${baseUrl}/rankings${qs}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
            throw new Error(`Erro ${res.status} ao consultar ranking.`);
        }

        const data = await res.json();
        const lista = Array.isArray(data) ? data : (data.rankings || data.ranking || []);
        return lista;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}
