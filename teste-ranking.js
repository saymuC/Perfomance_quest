// Teste das funções de banco


import { salvarTentativa } from './backend/src/attempts.js';
import { obterRanking } from './backend/src/repository.js';
import db from './backend/db/connection.js';

async function testar() {
    console.log('🧪 Testando o banco de dados...\n');

    // 1. Inserir um aluno de teste
    const aluno = await db.query(
        `INSERT INTO students (name, class_name, registration) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        ['Carla Teste', '3A', '2026001']
    );
    console.log('✅ Aluno inserido:', aluno.rows[0]);

    // 2. Salvar uma tentativa
    const tentativa = await salvarTentativa({
        studentId: aluno.rows[0].id,
        totalQuestions: 10,
        correctAnswers: 7,
        totalTimeSeconds: 300,
    });
    console.log('✅ Tentativa salva:', tentativa);

    // 3. Obter o ranking
    const ranking = await obterRanking();
    console.log('✅ Ranking:', ranking);

    console.log('\n🎉 Teste concluído com sucesso!');
    process.exit(0);
}

testar().catch((erro) => {
    console.error('❌ Erro no teste:', erro);
    process.exit(1);
});