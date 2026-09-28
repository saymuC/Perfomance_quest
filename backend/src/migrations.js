import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');

export async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(root)).filter(file => file.endsWith('.sql')).sort();
  for (const name of files) {
    const { rowCount } = await pool.query('SELECT 1 FROM public.schema_migrations WHERE name = $1', [name]);
    if (rowCount) continue;

    const sql = await fs.readFile(path.join(root, name), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [721904281]);
      const existing = await client.query('SELECT 1 FROM public.schema_migrations WHERE name = $1', [name]);
      if (!existing.rowCount) {
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [name]);
      }
      await client.query('COMMIT');
      console.log(`Migration aplicada: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
