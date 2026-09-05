// ============================================================================
// ETAPA 1: CORREÇÃO DO ENDPOINT, NORMALIZAÇÃO E MAPEAMENTO DO PAYLOAD
// ============================================================================

/**
 * Mapeia e formata as áreas do conhecimento para o padrão oficial do projeto.
 */
function formatarArea(areaBruta) {
  if (!areaBruta) return 'Geral';

  const areaLimpa = String(areaBruta).toLowerCase().trim();

  const mapaAreas = {
    'matematica': 'Matemática',
    'linguagens': 'Linguagens',
    'ciencias-humanas': 'Ciências Humanas',
    'ciencias-natureza': 'Ciências da Natureza'
  };

  return mapaAreas[areaLimpa] || areaBruta;
}

/**
 * Normaliza um objeto de questão bruto para o schema padronizado.
 */
export function padronizarQuestao(q) {
  const ano = q.exam_year || q.year || 2023;
  const indexOuId = q.index !== undefined ? q.index : q.id;

  if (indexOuId === undefined || indexOuId === null) {
    return null; // ID inválido -> Descarte
  }

  const idValido = `${ano}-${indexOuId}`;
  const enunciadoValido = q.context || q.alternatives_introduction || q.enunciado || '';

  let alternativasValidas = [];
  if (Array.isArray(q.alternatives)) {
    alternativasValidas = q.alternatives.map(alt => ({
      letter: alt.letter || alt.id || '',
      text: alt.text || alt.texto || ''
    }));
  } else if (Array.isArray(q.alternativas)) {
    alternativasValidas = q.alternativas.map(alt => ({
      letter: alt.letter || alt.letra || '',
      text: alt.text || alt.texto || ''
    }));
  }

  const gabaritoValido = q.correctAlternative || q.gabarito || q.respostaCorreta || q.resposta_correta || q.correta;

  return {
    id: idValido,
    area: formatarArea(q.discipline || q.area || q.disciplina),
    assunto: q.topic || q.assunto || 'Conhecimentos Gerais',
    enunciado: enunciadoValido,
    alternativas: alternativasValidas,
    correta: gabaritoValido
  };
}

/**
 * Busca questões no endpoint correto da API.
 */
export async function buscarQuestoesAPI(ano = 2023, limite = 10) {
  const URL_API_ENEM = `https://api.enem.dev/v1/exams/${ano}/questions?limit=${limite}`;

  try {
    const resposta = await fetch(URL_API_ENEM);
    if (!resposta.ok) throw new Error(`Status HTTP: ${resposta.status}`);

    const dados = await resposta.json();
    const listaBruta = Array.isArray(dados) ? dados : (dados.questions || []);

    return listaBruta
      .map(padronizarQuestao)
      .filter(q => q !== null && q.enunciado && q.alternativas.length > 0);

  } catch (erro) {
    console.warn('Falha no consumo da API:', erro.message);
    return [];
  }
}

// ============================================================================
// ETAPA 2: MECANISMO APRIMORADO DE FALLBACK LOCAL
// ============================================================================

/**
 * Carrega e padroniza as questões do backup local (questoes.json).
 */
async function carregarFallbackLocal() {
  try {
    const respostaLocal = await fetch(new URL('./questoes.json', import.meta.url));
    const dadosLocais = await respostaLocal.json();
    
    return dadosLocais
      .map(padronizarQuestao)
      .filter(q => q !== null && q.enunciado && q.alternativas.length > 0);
  } catch (erro) {
    console.error('Erro ao ler arquivo de fallback local (questoes.json):', erro.message);
    return [];
  }
}

// ============================================================================
// ETAPA 3: BALANCEAMENTO POR ÁREAS DO CONHECIMENTO (RF03) E DEDUPLICAÇÃO
// ============================================================================

/**
 * Remove questões com IDs repetidos da lista.
 */
function removerDuplicatas(questoes) {
  const vistos = new Set();
  return questoes.filter(q => {
    if (vistos.has(q.id)) return false;
    vistos.add(q.id);
    return true;
  });
}

/**
 * Algoritmo Fisher-Yates para embaralhar arrays de forma aleatória.
 */
function embaralhar(array) {
  const lista = [...array];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

/**
 * Distribui as questões proporcionalmente entre as 4 áreas do ENEM.
 */
function balancearPorAreas(questoes, totalDesejado = 10) {
  const areasOficiais = ['Matemática', 'Linguagens', 'Ciências Humanas', 'Ciências da Natureza'];
  
  // Agrupa as questões disponíveis por área
  const porArea = {
    'Matemática': [],
    'Linguagens': [],
    'Ciências Humanas': [],
    'Ciências da Natureza': [],
    'Outras': []
  };

  questoes.forEach(q => {
    if (porArea[q.area]) {
      porArea[q.area].push(q);
    } else {
      porArea['Outras'].push(q);
    }
  });

  const quizFinal = [];
  const metaPorArea = Math.floor(totalDesejado / areasOficiais.length); // Ex: 2 por área para um quiz de 10

  // 1. Pega a cota proporcional de cada área oficial
  areasOficiais.forEach(area => {
    const disponiveis = embaralhar(porArea[area]);
    const selecionadas = disponiveis.slice(0, metaPorArea);
    quizFinal.push(...selecionadas);
    porArea[area] = disponiveis.slice(metaPorArea); // Deixa o restante guardado na reserva
  });

  // 2. Preenche vagas restantes se faltar questões em alguma área
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

/**
 * Função principal integrando Busca -> Fallback -> Deduplicação -> Balanceamento
 */
export async function carregarEPrepararQuiz(quantidadeDesejada = 10, ano = 2023) {
  // 1. Busca inicial na API
  let questoesFinais = await buscarQuestoesAPI(ano, quantidadeDesejada * 2); // Pede margem para balancear

  // 2. Aciona o Fallback se faltar questões
  if (questoesFinais.length < quantidadeDesejada) {
    console.warn(`[Fallback] API retornou saldo insuficiente. Mesclando com arquivo local...`);
    const questoesLocal = await carregarFallbackLocal();
    questoesFinais = [...questoesFinais, ...questoesLocal];
  }

  // 3. Deduplicação de IDs
  const semDuplicatas = removerDuplicatas(questoesFinais);

  // 4. Seleção Equilibrada pelas 4 áreas
  return balancearPorAreas(semDuplicatas, quantidadeDesejada);
}