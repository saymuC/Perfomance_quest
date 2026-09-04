// Módulo de Consumo, Higienização e Seleção do Quiz (RF01 a RF04)

/**
 * RF04: Padroniza os campos para que o Frontend sempre receba a mesma estrutura
 */
function padronizarQuestao(q) {
  return {
    id: q.id || Math.random(),
    area: q.area || q.disciplina || 'Geral',
    assunto: q.assunto || q.topic || 'Conhecimentos Gerais',
    enunciado: q.enunciado || q.title || '',
    alternativas: q.alternativas || q.options || [],
    correta: q.correta !== undefined ? q.correta : q.correctAlternative
  };
}

/**
 * Algoritmo para embaralhar o array (Fisher-Yates)
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
 * RF01, RF02, RF03 e RF04: Busca, trata erro, padroniza e sorteia o quiz
 * @param {number} quantidade Total de questões para o quiz (padrão: 10)
 */
export async function carregarEPrepararQuiz(quantidade = 10) {
  const URL_API_ENEM = 'https://api.enem.dev/v1/exams';
  let questoesBrutas = [];

  // 1. RF01 & RF02: Tenta a API; se falhar, vai pro Fallback Local
  try {
    const resposta = await fetch(URL_API_ENEM);
    if (!resposta.ok) throw new Error(`Status HTTP: ${resposta.status}`);
    questoesBrutas = await resposta.json();
    console.log('Questões obtidas via API do ENEM!');
  } catch (erro) {
    console.warn('API indisponível. Carregando backup local...', erro.message);
    try {
      const respostaLocal = await fetch(new URL('./questoes.json', import.meta.url));
      questoesBrutas = await respostaLocal.json();
    } catch (erroLocal) {
      console.error('Erro crítico no backup local:', erroLocal);
      return [];
    }
  }

  // 2. RF04: Padronização de campos e filtro de segurança (garante área, assunto, alternativas e gabarito)
  const questoesValidas = questoesBrutas
    .map(padronizarQuestao)
    .filter(q => q.enunciado && q.alternativas.length > 0 && q.correta !== undefined);

  // 3. RF03: Embaralha para não repetir e limita a quantidade desejada para o quiz
  const quizSorteado = embaralhar(questoesValidas).slice(0, quantidade);

  return quizSorteado;
}