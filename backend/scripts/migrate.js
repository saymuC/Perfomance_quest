import { Pool } from 'pg';
import { runMigrations } from '../src/migrations.js';

if (!process.env.DATABASE_URL) {
  console.error('Configure DATABASE_URL no arquivo .env antes de executar as migrations.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
});

try {
  await runMigrations(pool);
  console.log('Banco Supabase pronto.');
} catch (error) {
  console.error('Falha ao aplicar migrations:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
