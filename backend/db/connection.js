// Conexão com o PostgreSQL

import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// Cria um pool de conexões com o banco
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Testa a conexão na inicialização
pool.query('SELECT NOW()')
    .then(() => console.log('Conectado ao PostgreSQL'))
    .catch((erro) => console.error(' Erro ao conectar ao PostgreSQL:', erro.message));

export default {
    query: (text, params) => pool.query(text, params),
    pool,
};