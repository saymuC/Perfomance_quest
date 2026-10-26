/**
 * Módulo de Armazenamento e Cadastro do Aluno (LocalStorage)
 * 
 * Gerencia os dados de identificação do aluno (nome, turma, matrícula)
 * e fila de sincronização offline de resultados para o ranking.
 */

const CHAVE_ALUNO = 'performance_quest_aluno';
const CHAVE_FILA_SYNC = 'performance_quest_sync_queue';
const CHAVE_DISPOSITIVO = 'performance_quest_device_id';

export function novoIdentificador() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

export function obterIdentificadorDispositivo() {
    let id = localStorage.getItem(CHAVE_DISPOSITIVO);
    if (!id) {
        id = novoIdentificador();
        localStorage.setItem(CHAVE_DISPOSITIVO, id);
    }
    return id;
}

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
            const deviceId = dados.deviceId || obterIdentificadorDispositivo();
            if (!dados.deviceId) localStorage.setItem(CHAVE_ALUNO, JSON.stringify({ ...dados, deviceId }));
            return {
                nome: String(dados.nome).trim(),
                turma: String(dados.turma).trim().toUpperCase(),
                matricula: String(dados.matricula).trim(),
                deviceId: dados.deviceId || obterIdentificadorDispositivo(),
                studentId: dados.studentId || null
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
export function salvarDadosAluno({ nome, turma, matricula, deviceId, studentId } = {}) {
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
        deviceId: deviceId || obterIdentificadorDispositivo(),
        studentId: studentId || obterDadosAluno()?.studentId || null,
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
 * Guarda a tentativa antes do envio e evita duplicatas nos reenvios.
 */
export function enfileirarResultadoPendente(resultado) {
    try {
        const fila = obterResultadosPendentes();
        if (resultado.idempotencyKey && fila.some(item => item.payload.idempotencyKey === resultado.idempotencyKey)) return true;
        fila.push({
            id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            criadoEm: new Date().toISOString(),
            payload: resultado
        });
        localStorage.setItem(CHAVE_FILA_SYNC, JSON.stringify(fila));
        return true;
    } catch (e) {
        console.warn('Erro ao enfileirar resultado para sincronização:', e);
        return false;
    }
}

export function obterResultadosPendentes() {
    try {
        const raw = localStorage.getItem(CHAVE_FILA_SYNC);
        const fila = raw ? JSON.parse(raw) : [];
        return Array.isArray(fila) ? fila : [];
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

// Atualiza a confirmação da identidade e evita repetir rejeições permanentes.
export function atualizarResultadoPendente(id, alteracoes) {
    const fila = obterResultadosPendentes().map(item => item.id === id ? { ...item, ...alteracoes } : item);
    localStorage.setItem(CHAVE_FILA_SYNC, JSON.stringify(fila));
}

const CHAVE_ATIVIDADE = 'performance_quest_ultima_atividade';
const PRAZO_INATIVIDADE = 30 * 24 * 60 * 60 * 1000;

export function registrarAtividadeLocal() {
    try { localStorage.setItem(CHAVE_ATIVIDADE, String(Date.now())); }
    catch (erro) { console.warn('Falha ao registrar atividade local:', erro); }
}

export function aplicarRetencaoLocal() {
    try {
        const ultima = Number(localStorage.getItem(CHAVE_ATIVIDADE));
        const expirou = ultima > 0 && Date.now() - ultima >= PRAZO_INATIVIDADE;
        if (expirou) {
            localStorage.removeItem(CHAVE_ALUNO);
            localStorage.removeItem('performance_quest_historico');
            if (!obterResultadosPendentes().length) localStorage.removeItem(CHAVE_DISPOSITIVO);
        }
        // Cadastros anteriores à política recebem o prazo a partir da primeira visita.
        registrarAtividadeLocal();
        return expirou;
    } catch (erro) {
        console.warn('Falha ao aplicar retenção local:', erro);
        return false;
    }
}

export function limparDadosLocais() {
    for (const chave of [CHAVE_ALUNO, CHAVE_FILA_SYNC, CHAVE_DISPOSITIVO, CHAVE_ATIVIDADE, 'performance_quest_historico']) {
        localStorage.removeItem(chave);
    }
}
