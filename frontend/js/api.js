/**
 * Módulo de Integração com API Externa (api.enem.dev) e Fallback Local
 * Atende aos requisitos RF01 a RF06, alinhado com o schema da branch main.
 */

const FALLBACK_PATH = './data/questoes_fallback.json';
const API_BASE_URL = 'https://api.enem.dev/v1';

export function normalizarArea(disciplina) {
    if (!disciplina) return 'Geral';
    const disc = String(disciplina).toLowerCase();

    if (disc.includes('matematica')) return 'Matemática';
    if (disc.includes('linguagens')) return 'Linguagens';
    if (disc.includes('ciencias-humanas') || disc.includes('humanas')) return 'Ciências Humanas';
    if (disc.includes('ciencias-natureza') || disc.includes('natureza')) return 'Ciências da Natureza';

    return 'Geral';
}

export function inferirAssunto(area, textoCompleto = '') {
    const texto = textoCompleto.toLowerCase();

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

export function normalizarQuestaoAPI(rawQuestion) {
    // Evita dupla normalização caso o fallback já esteja no formato correto
    if (rawQuestion.alternativaCorreta && rawQuestion.enunciado) {
        return rawQuestion;
    }

    const area = normalizarArea(rawQuestion.discipline);
    const enunciadoCompleto = [rawQuestion.context, rawQuestion.alternativesIntroduction].filter(Boolean).join('\n\n');
    const assunto = inferirAssunto(area, `${rawQuestion.title || ''} ${enunciadoCompleto}`);

    const alternativas = (rawQuestion.alternatives || []).map(alt => ({
        letra: String(alt.letter).toUpperCase(),
        texto: alt.text || '',
        isCorrect: Boolean(alt.isCorrect)
    }));

    const gabaritoBruto = rawQuestion.correctAlternative || alternativas.find(a => a.isCorrect)?.letra || 'A';
    const alternativaCorreta = String(gabaritoBruto).toUpperCase();

    return {
        id: `enem-${rawQuestion.year || 2023}-${rawQuestion.index || Math.random().toString(36).slice(2, 7)}`,
        ano: rawQuestion.year || 2023,
        area,
        assunto,
        enunciado: enunciadoCompleto || 'Sem enunciado disponível.',
        alternativas,
        alternativaCorreta, // Atualizado conforme feedback
        imagens: rawQuestion.images || [],
        explicacao: rawQuestion.justification || `Gabarito oficial do ENEM: Alternativa ${alternativaCorreta}.` // Atualizado conforme feedback
    };
}

// Filtro rigoroso exigido no feedback
function validarQuestaoRigida(q) {
    if (!q || !q.id || !q.enunciado || !q.alternativaCorreta || !q.area || !q.assunto) return false;
    if (!Array.isArray(q.alternativas) || q.alternativas.length === 0) return false;
    return true;
}

export async function carregarQuestoesFallback() {
    const resposta = await fetch(FALLBACK_PATH);
    if (!resposta.ok) throw new Error(`Falha ao carregar arquivo de contingência: ${resposta.statusText}`);
    return await resposta.json();
}

function removerDuplicatas(questoes) {
    const vistos = new Set();
    return questoes.filter(q => {
        if (vistos.has(q.id)) return false;
        vistos.add(q.id);
        return true;
    });
}

function embaralhar(array) {
    const lista = [...array];
    for (let i = lista.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
}

function balancearPorAreas(questoes, totalDesejado = 10) {
    const areasOficiais = ['Matemática', 'Linguagens', 'Ciências Humanas', 'Ciências da Natureza'];
    const porArea = { 'Matemática': [], 'Linguagens': [], 'Ciências Humanas': [], 'Ciências da Natureza': [], 'Outras': [] };

    questoes.forEach(q => {
        if (porArea[q.area]) porArea[q.area].push(q);
        else porArea['Outras'].push(q);
    });

    const quizFinal = [];
    const metaPorArea = Math.floor(totalDesejado / areasOficiais.length);

    areasOficiais.forEach(area => {
        const disponiveis = embaralhar(porArea[area]);
        quizFinal.push(...disponiveis.slice(0, metaPorArea));
        porArea[area] = disponiveis.slice(metaPorArea);
    });

    if (quizFinal.length < totalDesejado) {
        const idsJaUsados = new Set(quizFinal.map(q => q.id));
        const sobraGeral = embaralhar(questoes.filter(q => !idsJaUsados.has(q.id)));

        for (const qSobra of sobraGeral) {
            if (quizFinal.length >= totalDesejado) break;
            quizFinal.push(qSobra);
        }
    }

    return embaralhar(quizFinal);
}

export async function obterQuestoesSimulado({ area = null, quantidade = 5, ano = 2023 } = {}) {
    let questoes = [];
    let fonte = 'api';

    try {
        const url = `${API_BASE_URL}/exams/${ano}/questions`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); 

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();

        const listaBruta = Array.isArray(data) ? data : (data.questions || []);
        if (listaBruta.length > 0) {
            questoes = listaBruta.map(normalizarQuestaoAPI);
        } else {
            throw new Error('Formato inesperado na resposta da API');
        }
    } catch (err) {
        console.warn('API externa indisponível ou erro de conexão. Ativando contingência local...', err.message);
        const fallbackData = await carregarQuestoesFallback();
        questoes = fallbackData.map(normalizarQuestaoAPI);
        fonte = 'fallback';
    }

    // Deduplica e valida rigorosamente as questões antes do balanceamento
    let questoesTratadas = removerDuplicatas(questoes).filter(validarQuestaoRigida);

    let selecionadas = [];
    if (area && area !== 'Todas') {
        const filtradas = questoesTratadas.filter(q => q.area === area);
        selecionadas = embaralhar(filtradas).slice(0, quantidade);
    } else {
        selecionadas = balancearPorAreas(questoesTratadas, quantidade);
    }

    return {
        questoes: selecionadas,
        fonte,
        totalDisponivel: questoesTratadas.length
    };
}