// Gerenciamento do LocalStorage 

// Chave única para salvar os dados do navegador
const CHAVE_HISTORICO = 'performance_quest_historico';

/** 
 * salva um novo conjunto de respostas no historico 
 * @param {Array} novasrespostas - Lista de respostas do aluno
 */

export function salvarHistorico(novasRespostas) {
    try { 
        // 1. Pegara o historico que já existe
        const historicoExistente = carregarHistorico();

        // 2. Juntará o existente com o novo 
        const historicoAtualizado = [...historicoExistente, ...novasRespostas];
        
        // 3. Salvará o historico atualizado no localStorage
        localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historicoAtualizado));

        console.log('Historico atualizado com sucesso!');

    } catch (error) { 
        console.error('Erro ao salvar o historico:', error);

    }
} 

    /**
     * Carregar tddo o historico salvo
     * @returns {Array} Lista de respostas do aluno
     */

    export function carregarHistorico() {
        try{
            const dados = localStorage.getItem(CHAVE_HISTORICO);
            return dados ? JSON.parse(dados) : [];

        } catch (erro) {
            console.error('Erro ao carregar o histórico:', erro);
            return [];
        }
    }

    /**
     * Limpa todo o histórico (somente para fazer testes)
     */

    export function limparHistorico() {
        localStorage.removeItem(CHAVE_HISTORICO);
        console.log('Histórico limpo!');
    }
