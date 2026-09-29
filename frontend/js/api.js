/**
 * Módulo de Integração com a API REST do Backend
 * 
 * Consome EXCLUSIVAMENTE a API configurada em window.PERFORMANCE_QUEST_CONFIG.apiBaseUrl
 * (conforme especificado na arquitetura do README.md).
 */

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
 * Normaliza as denominações de áreas da base para as 4 áreas canônicas do ENEM
 */
export function normalizarArea(disciplina) {
    if (!disciplina) return 'Geral';
    const disc = String(disciplina).toLowerCase();
    if (disc.includes('matematica') || disc.includes('matemática')) return 'Matemática';
    if (disc.includes('linguagens')) return 'Linguagens';
    if (disc.includes('ciencias-humanas') || disc.includes('humanas')) return 'Ciências Humanas';
    if (disc.includes('ciencias-natureza') || disc.includes('natureza')) return 'Ciências da Natureza';
    return disciplina;
}

/**
 * Infere o assunto pedagógico detalhado com base no enunciado para o algoritmo IPE
 */
export function inferirAssunto(area, textoCompleto = '') {
    const texto = String(textoCompleto).toLowerCase();

    if (area === 'Matemática') {
        if (/geometria|tri[aâ]ngulo|quadrado|ret[aâ]ngulo|esfera|cilindro|cone|volume|área|aresta|per[ií]metro/i.test(texto)) return 'Geometria e Medidas';
        if (/fun[cç][aã]o|f\(x\)|gr[aá]fico|par[aá]bola|v[eé]rtice|linear|quadr[aá]tica|exponencial/i.test(texto)) return 'Funções e Álgebra';
        if (/probabilidade|porcentagem|estat[ií]stica|m[eé]dia|mediana|moda|gr[aá]fico de barras/i.test(texto)) return 'Estatística e Probabilidade';
        if (/raz[aã]o|propor[cç][aã]o|regra de tr[eê]s|escala/i.test(texto)) return 'Razão, Proporção e Escala';
        return 'Matemática Geral';
    }
    if (area === 'Ciências da Natureza') {
        if (/ecologia|cadeia alimentar|ecossistema|biodiversidade|polui[cç][aã]o|desmatamento|bioma|sustent/i.test(texto)) return 'Ecologia e Meio Ambiente';
        if (/calor|temperatura|termo|onda|frequ[eê]ncia|som|luz|[oó]ptica|eletricidade|circuito|pot[eê]ncia/i.test(texto)) return 'Física e Energia';
        if (/rea[cç][aã]o|[aá]tomo|mol[eé]cula|[aá]cido|base|solu[cç][aã]o|estequiometria|qu[ií]mica/i.test(texto)) return 'Química e Transformações';
        if (/c[eé]lula|dna|gen[eé]tica|evolu[cç][aã]o|fisiologia|v[ií]rus|bact[eé]ria/i.test(texto)) return 'Biologia Celular e Genética';
        return 'Ciências da Natureza Geral';
    }
    if (area === 'Ciências Humanas') {
        if (/vargas|rep[uú]blica|imp[eé]rio|ditadura|escravid[aã]o|colonial|guerra|revolu[cç][aã]o|brasil/i.test(texto)) return 'História do Brasil';
        if (/cidadania|filosof|ética|democracia|sociedade|direitos|cultura|locke|habermas|kant/i.test(texto)) return 'Cidadania e Filosofia';
        if (/clima|relevo|popula[cç][aã]o|urbaniza[cç][aã]o|globaliza[cç][aã]o|migra[cç][aã]o|geopol[ií]tica/i.test(texto)) return 'Geografia e Sociedade';
        return 'Ciências Humanas Geral';
    }
    if (area === 'Linguagens') {
        if (/fun[cç][aã]o da linguagem|publicit[aá]rio|g[eê]nero textual|cr[oô]nica|not[ií]cia|editorial|interpreta/i.test(texto)) return 'Interpretação Textual';
        if (/varia[cç][aã]o lingu[ií]stica|norma culta|sotaque|coloquial|dialeto/i.test(texto)) return 'Variação Linguística';
        if (/modernismo|romantismo|poema|poesia|literatura|machado de assis|drummond/i.test(texto)) return 'Literatura Brasileira';
        return 'Linguagens e Comunicação';
    }
    return 'Conhecimentos Gerais';
}

/**
 * Normaliza uma questão para o formato padrão consumido pelo quiz
 */
export function normalizarQuestao(q) {
    if (!q || typeof q !== 'object') {
        throw new Error('Questão em formato inválido recebida da API.');
    }

    const id = String(q.id || Math.random().toString(36).slice(2, 8));
    const area = normalizarArea(q.area || 'Geral');
    const enunciado = q.enunciado || q.statement || q.texto || q.context || 'Enunciado não disponível.';

    // Infere assunto mais específico se o assunto for genérico ou igual à área
    let assunto = q.assunto;
    if (!assunto || assunto === q.area || assunto.includes('Tecnologias') || assunto === 'Geral') {
        assunto = inferirAssunto(area, `${q.titulo || ''} ${enunciado}`);
    }

    // Alternativas padronizadas: [{ letra: 'A', texto: '...', id: 'A', isCorrect: false }]
    let alternativas = [];
    const altsArray = q.alternativas || q.alternatives;
    if (Array.isArray(altsArray)) {
        alternativas = altsArray.map(alt => {
            if (typeof alt === 'string') {
                return { letra: alt, texto: alt, id: alt, isCorrect: false };
            }
            const letra = String(alt.letra || alt.letter || alt.id || '').toUpperCase();
            const texto = alt.texto || alt.text || '';
            const imagem = alt.imagem || alt.file || null;
            const isCorrect = Boolean(alt.isCorrect || alt.correta);
            return { letra, texto, imagem, id: letra, isCorrect };
        });
    } else if (altsArray && typeof altsArray === 'object') {
        alternativas = Object.entries(altsArray).map(([key, val]) => ({
            letra: String(key).toUpperCase(),
            texto: typeof val === 'string' ? val : (val.text || val.texto || ''),
            imagem: typeof val === 'object' ? (val.imagem || val.file || null) : null,
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
        imagens: q.imagens || q.images || [],
        alternativas,
        alternativaCorreta: gabarito,
        explicacao: q.explicacao || q.justification || `Gabarito oficial do ENEM: Alternativa ${gabarito}.`
    };
}

/**
 * Algoritmo Fisher-Yates para embaralhamento de arrays
 */
export function embaralhar(array) {
    const lista = [...array];
    for (let i = lista.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
}

/**
 * Distribui as questões equilibradamente entre as 4 áreas oficiais do ENEM
 */
export function balancearQuestoesPorArea(questoes, quantidadeDesejada = 10) {
    const areas = ['Matemática', 'Ciências da Natureza', 'Ciências Humanas', 'Linguagens'];
    const porArea = {
        'Matemática': [],
        'Ciências da Natureza': [],
        'Ciências Humanas': [],
        'Linguagens': []
    };

    questoes.forEach(q => {
        if (porArea[q.area]) {
            porArea[q.area].push(q);
        }
    });

    const selecionadas = [];
    const metaPorArea = Math.max(1, Math.floor(quantidadeDesejada / areas.length));

    areas.forEach(area => {
        const disponiveis = embaralhar(porArea[area] || []);
        selecionadas.push(...disponiveis.slice(0, metaPorArea));
    });

    // Se faltarem questões para atingir a meta, completa com o restante
    if (selecionadas.length < quantidadeDesejada) {
        const idsUsados = new Set(selecionadas.map(q => q.id));
        const restantes = embaralhar(questoes.filter(q => !idsUsados.has(q.id)));
        for (const q of restantes) {
            if (selecionadas.length >= quantidadeDesejada) break;
            selecionadas.push(q);
        }
    }

    return embaralhar(selecionadas).slice(0, quantidadeDesejada);
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
        area: 'Todas',
        quantity: '200'
    });
    if (ano) query.append('year', String(ano));

    const url = `${baseUrl}/questions?${query.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

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
        const erro = new Error('A API não retornou questões.');
        erro.tipo = 'SEM_QUESTOES';
        throw erro;
    }

    const todasNormalizadas = listaBruta.map(normalizarQuestao);

    let selecionadas = [];
    if (area && area !== 'Todas') {
        const filtradas = todasNormalizadas.filter(q => q.area === area);
        selecionadas = embaralhar(filtradas).slice(0, quantidade);
    } else {
        selecionadas = balancearQuestoesPorArea(todasNormalizadas, quantidade);
    }

    if (selecionadas.length === 0) {
        throw new Error(`Nenhuma questão disponível para a área "${area}".`);
    }

    return {
        questoes: selecionadas,
        fonte: 'api',
        totalDisponivel: todasNormalizadas.length
    };
}

/**
 * Envia o resultado concluído para persistência no banco e ranking (POST /api/results)
 */
export async function registrarAlunoAPI(aluno) {
    const response = await fetch(`${getApiBaseUrl()}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            deviceId: aluno.deviceId,
            studentName: aluno.nome,
            className: aluno.turma,
            registrationNumber: aluno.matricula
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || `Erro ${response.status} ao registrar aluno.`);
        error.status = response.status;
        throw error;
    }
    return data.student;
}

export async function enviarResultadoAPI(resultado) {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/results`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const payload = {
        // Campos em conformidade com o endpoint POST /api/results do backend
        studentName: resultado.nome,
        name: resultado.nome,
        className: resultado.turma,
        turma: resultado.turma,
        registrationNumber: resultado.matricula,
        matricula: resultado.matricula,
        deviceId: resultado.deviceId,
        studentId: resultado.studentId,
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
