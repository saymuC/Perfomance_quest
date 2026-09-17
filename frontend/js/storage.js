/**
 * Módulo de Armazenamento e Cadastro do Aluno (LocalStorage)
 * 
 * Gerencia os dados de identificação do aluno (nome, turma, matrícula)
 * e fila de sincronização offline de resultados para o ranking.
 */

const CHAVE_ALUNO = 'performance_quest_aluno';
const CHAVE_FILA_SYNC = 'performance_quest_sync_queue';

/**
 * Recupera os dados do aluno cadastrado
 * @returns {{ nome: string, turma: string, matricula: string } | null}
 */
export function obterDadosAluno() {
    try {
        const raw = localStorage.getItem(CHAVE_ALUNO);
        if (!raw) return null;
        const dados = JSON.parse(raw);
        if (dados && dados.nome && dados.turma && dados.matricula) {
            return {
                nome: String(dados.nome).trim(),
                turma: String(dados.turma).trim().toUpperCase(),
                matricula: String(dados.matricula).trim()
            };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Salva ou atualiza os dados cadastrais do aluno
 */
export function salvarDadosAluno({ nome, turma, matricula }) {
    if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
        throw new Error('Informe um nome válido com ao menos 2 caracteres.');
    }
    if (!turma || typeof turma !== 'string' || turma.trim().length === 0) {
        throw new Error('Informe a turma (ex: 3A, 3B, 3º Ano).');
    }
    if (!matricula || typeof matricula !== 'string' || matricula.trim().length < 3) {
        throw new Error('Informe uma matrícula válida (ao menos 3 caracteres).');
    }

    const aluno = {
        nome: nome.trim(),
        turma: turma.trim().toUpperCase(),
        matricula: matricula.trim(),
        atualizadoEm: new Date().toISOString()
    };

    try {
        localStorage.setItem(CHAVE_ALUNO, JSON.stringify(aluno));
    } catch (e) {
        console.warn('Erro ao salvar dados do aluno no LocalStorage:', e);
    }

    return aluno;
}

/**
 * Verifica se há cadastro completo ativo
 */
export function temCadastroValido() {
    return obterDadosAluno() !== null;
}

/**
 * Remove o cadastro local
 */
export function limparDadosAluno() {
    try {
        localStorage.removeItem(CHAVE_ALUNO);
    } catch (e) {
        console.warn('Erro ao remover dados do aluno:', e);
    }
}

/**
 * Enfileira um resultado que falhou ao enviar para a API (Sincronização Offline)
 */
export function enfileirarResultadoPendente(resultado) {
    try {
        const fila = obterResultadosPendentes();
        fila.push({
            id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            criadoEm: new Date().toISOString(),
            payload: resultado
        });
        localStorage.setItem(CHAVE_FILA_SYNC, JSON.stringify(fila));
    } catch (e) {
        console.warn('Erro ao enfileirar resultado para sincronização:', e);
    }
}

export function obterResultadosPendentes() {
    try {
        const raw = localStorage.getItem(CHAVE_FILA_SYNC);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function removerResultadoPendente(id) {
    try {
        const fila = obterResultadosPendentes().filter(item => item.id !== id);
        localStorage.setItem(CHAVE_FILA_SYNC, JSON.stringify(fila));
    } catch (e) {
        console.warn('Erro ao atualizar fila de sincronização:', e);
    }
}

export function limparFilaSincronizacao() {
    try {
        localStorage.removeItem(CHAVE_FILA_SYNC);
    } catch (e) {
        console.warn('Erro ao limpar fila de sincronização:', e);
    }
}
