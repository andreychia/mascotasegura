import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(7690281)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir(new URL('../db/', import.meta.url)))
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    const sql = await readFile(new URL('../db/' + name, import.meta.url), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [
      name,
    ]);
    if (rows[0]) {
      if (rows[0].checksum !== checksum)
        throw new Error('La migración aplicada fue modificada: ' + name);
      continue;
    }
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
      name,
      checksum,
    ]);
    console.log('Migración aplicada:', name);
  }
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
