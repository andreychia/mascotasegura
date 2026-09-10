import { Pool } from 'pg';
const globalDb = globalThis as unknown as { pool?: Pool };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!globalDb.pool) {
    globalDb.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      connectionTimeoutMillis: 5000,
    });
    globalDb.pool.on('error', (error) =>
      console.error('Idle database connection closed:', error.message),
    );
  }
  return globalDb.pool;
}
