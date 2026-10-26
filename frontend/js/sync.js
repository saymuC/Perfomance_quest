import { obterDadosAluno, salvarDadosAluno, obterResultadosPendentes, atualizarResultadoPendente, removerResultadoPendente } from './storage.js';
import { registrarAlunoAPI, enviarResultadoAPI } from './api.js';

const rejeicaoPermanente = erro => erro.status >= 400 && erro.status < 500 && ![408, 429].includes(erro.status);

export async function enviarPontuacao(payload) {
    const pendente = obterResultadosPendentes().find(item => item.payload.idempotencyKey === payload.idempotencyKey);
    try {
        const tentativa = { ...payload };
        const atual = obterDadosAluno();
        // Uma confirmação já salva na fila prevalece sobre uma cópia antiga em memória.
        if (pendente?.payload.studentId) tentativa.studentId = pendente.payload.studentId;
        if (!tentativa.studentId) {
            const mesmoDispositivo = atual && tentativa.deviceId === atual.deviceId;
            const cadastro = mesmoDispositivo ? atual : tentativa;
            if (!cadastro.deviceId || !cadastro.nome || !cadastro.turma || !cadastro.matricula) {
                throw Object.assign(new Error('Tentativa sem identificação completa.'), { status: 400 });
            }
            tentativa.studentId = cadastro.studentId || (await registrarAlunoAPI(cadastro)).id;
            tentativa.deviceId = cadastro.deviceId;
            const agora = obterDadosAluno();
            if (mesmoDispositivo && agora && ['deviceId', 'nome', 'turma', 'matricula'].every(campo => agora[campo] === cadastro[campo])) {
                salvarDadosAluno({ ...agora, studentId: tentativa.studentId });
            }
            if (pendente) atualizarResultadoPendente(pendente.id, { payload: tentativa });
        }
        await enviarResultadoAPI(tentativa);
        if (pendente) removerResultadoPendente(pendente.id);
    } catch (erro) {
        if (pendente && (pendente.requerAtencao || rejeicaoPermanente(erro))) {
            atualizarResultadoPendente(pendente.id, { requerAtencao: rejeicaoPermanente(erro) });
        }
        throw erro;
    }
}

export async function sincronizarPendencias(onSincronizado, incluirRejeitadas = false) {
    for (const item of obterResultadosPendentes()) {
        if (item.requerAtencao && !incluirRejeitadas) continue;
        try {
            await enviarPontuacao({ ...item.payload, createdAt: item.payload.createdAt || item.criadoEm });
            onSincronizado?.(item.payload);
        } catch (erro) {
            console.warn('Falha ao sincronizar tentativa:', erro);
            if (!rejeicaoPermanente(erro)) break;
        }
    }
}
