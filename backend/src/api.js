import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração de caminhos absolutos no Node.js (necessário para o Fallback)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export function padronizarQuestao(q) {
  const ano = q.exam_year || q.year || 2023;
  const indexOuId = q.index !== undefined ? q.index : q.id;

  if (indexOuId === undefined || indexOuId === null) return null;

  let alternativasValidas = [];
  const fonteAlternativas = q.alternatives || q.alternativas || [];
  
  alternativasValidas = fonteAlternativas.map(alt => ({
    letra: alt.letter || alt.letra || alt.id || '', // Adaptado para o corretor
    texto: alt.text || alt.texto || alt.valor || '' // Adaptado para o corretor
  }));

  return {
    id: `${ano}-${indexOuId}`,
    area: formatarArea(q.discipline || q.area || q.disciplina),
    assunto: q.topic || q.assunto || 'Geral', // RF04
    enunciado: q.context || q.alternatives_introduction || q.enunciado || '',
    alternativas: alternativasValidas,
    gabarito: q.correctAlternative || q.gabarito || q.respostaCorreta || q.correta || '', // Compatibilidade com correcao.js
    imagens: q.images || q.imagens || [], // RF05
    justificativa: q.justification || q.justificativa || '' // RF06
  };
}

// Filtro rigoroso: descarta se faltar enunciado, gabarito ou se alternativas estiverem incompletas
function validarQuestaoRigida(q) {
  if (!q || !q.enunciado || !q.gabarito || q.alternativas.length === 0) return false;
  const alternativasValidas = q.alternativas.every(a => a.letra.trim() !== '' && a.texto.trim() !== '');
  return alternativasValidas;
}

export async function buscarQuestoesAPI(ano = 2023, limite = 10) {
  const URL_API_ENEM = `https://api.enem.dev/v1/exams/${ano}/questions?limit=${limite}`;

  try {
    const resposta = await fetch(URL_API_ENEM);
    if (!resposta.ok) throw new Error(`Status HTTP: ${resposta.status}`);

    const dados = await resposta.json();
    const listaBruta = Array.isArray(dados) ? dados : (dados.questions || []);

    return listaBruta
      .map(padronizarQuestao)
      .filter(validarQuestaoRigida);
  } catch (erro) {
    console.warn('Falha no consumo da API:', erro.message);
    return [];
  }
}

async function carregarFallbackLocal() {
  try {
    // Uso do File System (fs) para garantir a leitura no backend (Node.js)
    const caminhoArquivo = path.join(__dirname, 'questoes.json');
    const arquivoBruto = await fs.readFile(caminhoArquivo, 'utf-8');
    const dadosLocais = JSON.parse(arquivoBruto);
    
    return dadosLocais
      .map(padronizarQuestao)
      .filter(validarQuestaoRigida);
  } catch (erro) {
    console.error('Erro ao ler arquivo de fallback local:', erro.message);
    return [];
  }
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

export async function carregarEPrepararQuiz(quantidadeDesejada = 10, ano = 2023) {
  let questoesFinais = await buscarQuestoesAPI(ano, quantidadeDesejada * 2);

  if (questoesFinais.length < quantidadeDesejada) {
    console.warn(`[Fallback] API retornou saldo insuficiente. Mesclando com arquivo local...`);
    const questoesLocal = await carregarFallbackLocal();
    questoesFinais = [...questoesFinais, ...questoesLocal];
  }

  const semDuplicatas = removerDuplicatas(questoesFinais);
  return balancearPorAreas(semDuplicatas, quantidadeDesejada);
}