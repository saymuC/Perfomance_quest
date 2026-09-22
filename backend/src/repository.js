// Lógica de ranking
import db from '../db/connection.js';

/**
 * Retorna o ranking, opcionalmente filtrado por turma
 * @param {string} className - Nome da turma (opcional)
 * @param {number} limit - Quantidade de resultados 
 * @returns {Array} Lista de alunos ordenada por desempenho
 */
async function obterRanking(className = null, limit = 20) {
    let query = `
    SELECT
    s.name,
    s.class_name,
    MAX(qa.percentage) as best_percentage,
    SUM(qa.correct_answers) as total_correct,
    MIN(qa.total_time_seconds) as best_time,
    MAX(qa.created_at) as last_attempt
    FROM students s
    JOIN quiz_attempts qa ON s.id = qa.student_id`;

    const params = [];

    if (className) {
        query += ` WHERE s.class_name = $1`;
        params.push(className);
    }

    query += `
    GROUP BY s.id, s.name, s.class_name
    ORDER BY
         best_percentage DESC,
         total_correct DESC,
         best_time ASC,
         last_attempt ASC
         LIMIT $${params.length + 1}`;
    params.push(limit);

    const resultado = await db.query(query, params);
    return resultado.rows;
}

export { obterRanking };