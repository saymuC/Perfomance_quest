// Módulo de Consumo da API Pública do ENEM e Backup Local (Fallback)

/**
 * Busca as questões da API do ENEM com contingência local
 * @returns {Promise<Array>} Lista de questões oficiais ou de contingência
 */
export async function carregarQuestoes() {
  const URL_API_ENEM = 'https://api.enem.dev/v1/exams';

  try {
    // 1. Tenta buscar da API pública
    const resposta = await fetch(URL_API_ENEM);

    if (!resposta.ok) {
      throw new Error(`Erro na API do ENEM (Status: ${resposta.status})`);
    }

    const questoesAPI = await resposta.json();
    console.log('Questões carregadas com sucesso via API do ENEM!');
    return questoesAPI;

  } catch (erro) {
    // 2. FALLBACK: Se a API falhar ou ficar sem internet, carrega do JSON local
    console.warn('API indisponível. Carregando questões do backup local...', erro.message);

    try {
      const respostaLocal = await fetch(new URL('./questoes.json', import.meta.url));
      const questoesLocais = await respostaLocal.json();
      console.log('Backup local carregado com sucesso!');
      return questoesLocais;

    } catch (erroLocal) {
      console.error('Erro crítico ao carregar backup local:', erroLocal);
      return [];
    }
  }
}