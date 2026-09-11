/**
 * Módulo de Integração com API Externa (api.enem.dev) e Fallback Local
 * Atende aos requisitos RF01, RF02, RF03 e RF04.
 */

const FALLBACK_PATH = './data/questoes_fallback.json';
const API_BASE_URL = 'https://api.enem.dev/v1';

/**
 * Mapeia as disciplinas retornadas pela API pública para as 4 grandes áreas do ENEM
 */
export function normalizarArea(disciplina) {
    if (!disciplina) return 'Geral';
    const disc = String(disciplina).toLowerCase();

    if (disc.includes('matematica')) return 'Matemática';
    if (disc.includes('linguagens')) return 'Linguagens';
    if (disc.includes('ciencias-humanas') || disc.includes('humanas')) return 'Ciências Humanas';
    if (disc.includes('ciencias-natureza') || disc.includes('natureza')) return 'Ciências da Natureza';

    return 'Geral';
}

/**
 * RF04: Algoritmo de IA Heurística para categorizar cada pergunta por assunto/tópico
 */
export function inferirAssunto(area, textoCompleto = '') {
    const texto = textoCompleto.toLowerCase();

    if (area === 'Matemática') {
        if (/geometria|tri[aâ]ngulo|quadrado|ret[aâ]ngulo|esfera|cilindro|cone|volume|área|aresta|per[ií]metro/i.test(texto)) {
            return 'Geometria e Medidas';
        }
        if (/fun[cç][aã]o|f\(x\)|gr[aá]fico|par[aá]bola|v[eé]rtice|linear|quadr[aá]tica|exponencial/i.test(texto)) {
            return 'Funções e Álgebra';
        }
        if (/probabilidade|porcentagem|estat[ií]stica|m[eé]dia|mediana|moda|gr[aá]fico de barras/i.test(texto)) {
            return 'Estatística e Probabilidade';
        }
        if (/raz[aã]o|propor[cç][aã]o|regra de tr[eê]s|escala/i.test(texto)) {
            return 'Razão, Proporção e Escala';
        }
        return 'Matemática Geral';
    }

    if (area === 'Ciências da Natureza') {
        if (/ecologia|cadeia alimentar|ecossistema|biodiversidade|polui[cç][aã]o|desmatamento|bioma|sustent/i.test(texto)) {
            return 'Ecologia e Meio Ambiente';
        }
        if (/calor|temperatura|termo|onda|frequ[eê]ncia|som|luz|[oó]ptica|eletricidade|circuito|pot[eê]ncia/i.test(texto)) {
            return 'Física e Energia';
        }
        if (/rea[cç][aã]o|[aá]tomo|mol[eé]cula|[aá]cido|base|solu[cç][aã]o|estequiometria|qu[ií]mica/i.test(texto)) {
            return 'Química e Transformações';
        }
        if (/c[eé]lula|dna|gen[eé]tica|evolu[cç][aã]o|fisiologia|v[ií]rus|bact[eé]ria/i.test(texto)) {
            return 'Biologia Celular e Genética';
        }
        return 'Ciências da Natureza Geral';
    }

    if (area === 'Ciências Humanas') {
        if (/vargas|rep[uú]blica|imp[eé]rio|ditadura|escravid[aã]o|colonial|guerra|revolu[cç][aã]o|brasil/i.test(texto)) {
            return 'História do Brasil';
        }
        if (/cidadania|filosof|ética|democracia|sociedade|direitos|cultura|locke|habermas|kant/i.test(texto)) {
            return 'Cidadania e Filosofia';
        }
        if (/clima|relevo|popula[cç][aã]o|urbaniza[cç][aã]o|globaliza[cç][aã]o|migra[cç][aã]o|geopol[ií]tica/i.test(texto)) {
            return 'Geografia e Sociedade';
        }
        return 'Ciências Humanas Geral';
    }

    if (area === 'Linguagens') {
        if (/fun[cç][aã]o da linguagem|publicit[aá]rio|g[eê]nero textual|cr[oô]nica|not[ií]cia|editorial|interpreta/i.test(texto)) {
            return 'Interpretação Textual';
        }
        if (/varia[cç][aã]o lingu[ií]stica|norma culta|sotaque|coloquial|dialeto/i.test(texto)) {
            return 'Variação Linguística';
        }
        if (/modernismo|romantismo|poema|poesia|literatura|machado de assis|drummond/i.test(texto)) {
            return 'Literatura Brasileira';
        }
        return 'Linguagens e Comunicação';
    }

    return 'Conhecimentos Gerais';
}

/**
 * Normaliza uma questão proveniente da api.enem.dev para o padrão do backend
 */
export function normalizarQuestaoAPI(rawQuestion) {
    const area = normalizarArea(rawQuestion.discipline);
    const enunciadoCompleto = [
        rawQuestion.context,
        rawQuestion.alternativesIntroduction
    ].filter(Boolean).join('\n\n');

    const assunto = inferirAssunto(area, `${rawQuestion.title || ''} ${enunciadoCompleto}`);

    const alternativas = (rawQuestion.alternatives || []).map(alt => ({
        id: String(alt.letter).toUpperCase(),
        letra: String(alt.letter).toUpperCase(),
        texto: alt.text || '',
        isCorrect: Boolean(alt.isCorrect)
    }));

    const gabarito = rawQuestion.correctAlternative ||
        alternativas.find(a => a.isCorrect)?.letra || 'A';

    return {
        id: `enem-${rawQuestion.year || 2023}-${rawQuestion.index || Math.random().toString(36).slice(2, 7)}`,
        ano: rawQuestion.year || 2023,
        area,
        assunto,
        enunciado: enunciadoCompleto || 'Sem enunciado disponível.',
        alternativas,
        alternativaCorreta: String(gabarito).toUpperCase(),
        explicacao: `Gabarito oficial do ENEM: Alternativa ${gabarito}.`
    };
}

/**
 * Carrega a base de dados de contingência (offline fallback)
 */
export async function carregarQuestoesFallback() {
    const resposta = await fetch(FALLBACK_PATH);
    if (!resposta.ok) {
        throw new Error(`Falha ao carregar arquivo de contingência: ${resposta.statusText}`);
    }
    return await resposta.json();
}

/**
 * RF01 e RF02: Obtém as questões para o simulado.
 * Tenta a API externa primeiro; se houver qualquer erro de rede ou conexão,
 * recorre imediatamente ao arquivo de fallback.
 */
export async function obterQuestoesSimulado({ area = null, quantidade = 5, ano = 2023 } = {}) {
    let questoes = [];
    let fonte = 'api';

    try {
        const url = `${API_BASE_URL}/exams/${ano}/questions?limit=50`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();

        if (Array.isArray(data.questions) && data.questions.length > 0) {
            questoes = data.questions.map(normalizarQuestaoAPI);
        } else {
            throw new Error('Formato inesperado na resposta da API');
        }
    } catch (err) {
        console.warn('API externa indisponível ou erro de conexão. Ativando contingência local...', err.message);
        questoes = await carregarQuestoesFallback();
        fonte = 'fallback';
    }

    // Filtragem opcional por área do conhecimento
    if (area && area !== 'Todas') {
        const filtradas = questoes.filter(q => q.area === area);
        if (filtradas.length >= 2) {
            questoes = filtradas;
        }
    }

    // Embaralhar aleatoriamente
    const embaralhadas = [...questoes].sort(() => Math.random() - 0.5);
    const selecionadas = embaralhadas.slice(0, Math.min(quantidade, embaralhadas.length));

    return {
        questoes: selecionadas,
        fonte,
        totalDisponivel: questoes.length
    };
}
