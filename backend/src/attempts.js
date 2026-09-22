// Lógica de salvar tentativas 

import db from '../db/connection.js';

/**
 * Salva uma tentativa de quiz no banco
 * @param {Object} dados - Dados da tentativa
 * @returns {Object} Tentativa salva 
 */
async function salvarTentativa(dados) {
    const { studentId, totalQuestions, correctAnswers, totalTimeSeconds } = dados;

    // Validar os dados
    if (!studentId || !totalQuestions || correctAnswers === undefined || !totalTimeSeconds) {
        throw new Error('Dados incompletos para salvar a tentativa.');
    }

    // Calcular a porcentagem
    const percentage = (correctAnswers / totalQuestions) * 100;

    // Insere no banco
    const resultado = await db.query(
        `INSERT INTO quiz_attempts
        (student_id, total_questions, correct_answers, percentage, total_time_seconds)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [studentId, totalQuestions, correctAnswers, percentage, totalTimeSeconds]
    );

    return resultado.rows[0];
}

export { salvarTentativa };