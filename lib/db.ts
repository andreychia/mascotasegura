import { Pool } from 'pg';
import { getConnectionString } from '@netlify/database';
const globalDb = globalThis as unknown as { pool?: Pool };
export function db() {
  const connectionString = process.env.DATABASE_URL || getConnectionString();
  if (!connectionString) throw new Error('Database connection is not configured');
  if (!globalDb.pool) {
    globalDb.pool = new Pool({
      connectionString,
      max: 8,
      connectionTimeoutMillis: 5000,
    });
    globalDb.pool.on('error', (error) =>
      console.error('Idle database connection closed:', error.message),
    );
  }
  return globalDb.pool;
}
