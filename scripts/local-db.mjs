// Starts a real, persistent PostgreSQL instance for local development only.
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { Client } from 'pg';
const directory = resolve('.local-db');
mkdirSync(directory, { recursive: true });
const settingsFile = resolve(directory, 'settings.json');
const settings = existsSync(settingsFile)
  ? JSON.parse(readFileSync(settingsFile, 'utf8'))
  : { password: randomBytes(24).toString('hex') };
if (!existsSync(settingsFile))
  writeFileSync(settingsFile, JSON.stringify(settings), { mode: 0o600 });
const connection =
  'postgresql://mascotasegura:' + settings.password + '@127.0.0.1:55432/mascotasegura';
if (!existsSync('.env.local'))
  writeFileSync(
    '.env.local',
    'DATABASE_URL=' + connection + '\nAPP_URL=http://localhost:3100\nCOOKIE_SECURE=false\n',
    { mode: 0o600 },
  );
const data = resolve(directory, 'data');
let postgres;
if (process.platform === 'win32') {
  // The upstream wrapper calls os.userInfo(), unavailable in some Windows service accounts.
  // Invoke the same bundled binaries directly on Windows.
  const binaries = await import('@embedded-postgres/windows-x64');
  let child;
  const options = {
    user: 'mascotasegura',
    password: settings.password,
    host: '127.0.0.1',
    port: 55432,
    database: 'postgres',
    connectionTimeoutMillis: 1000,
  };
  postgres = {
    async initialise() {
      const passwordFile = resolve(directory, 'init-password');
      writeFileSync(passwordFile, settings.password, { mode: 0o600 });
      try {
        const r = spawnSync(
          binaries.initdb,
          [
            '-D',
            data,
            '-U',
            'mascotasegura',
            '--pwfile=' + passwordFile,
            '--auth=scram-sha-256',
            '--encoding=UTF8',
            '--locale=C',
          ],
          { stdio: 'inherit', windowsHide: true },
        );
        if (r.error || r.status !== 0) throw r.error || new Error('initdb failed');
      } finally {
        unlinkSync(passwordFile);
      }
    },
    async start() {
      if (existsSync(resolve(data, 'postmaster.pid')))
        throw new Error(
          'La base local ya está iniciada. Usa esa terminal o detenla antes de volver a iniciar.',
        );
      child = spawn(binaries.postgres, ['-D', data, '-h', '127.0.0.1', '-p', '55432'], {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      });
      let startupError;
      child.on('error', (e) => {
        startupError = e;
      });
      child.stderr.on('data', (chunk) => {
        if (/FATAL|ERROR/.test(String(chunk))) console.error(String(chunk));
      });
      for (let n = 0; n < 50; n++) {
        if (startupError) throw startupError;
        if (child.exitCode !== null) throw new Error('PostgreSQL exited before becoming ready.');
        const c = new Client(options);
        try {
          await c.connect();
          await c.end();
          return;
        } catch {
          await c.end().catch(() => {});
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      await this.stop();
      throw new Error('PostgreSQL did not become ready.');
    },
    getPgClient() {
      return new Client(options);
    },
    async createDatabase() {
      const c = new Client(options);
      await c.connect();
      try {
        await c.query('CREATE DATABASE mascotasegura');
      } finally {
        await c.end();
      }
    },
    async stop() {
      if (child && child.exitCode === null) {
        const r = spawnSync(binaries.pg_ctl, ['-D', data, 'stop', '-m', 'fast', '-w'], {
          stdio: 'inherit',
          windowsHide: true,
        });
        if (r.status !== 0) throw new Error('No se pudo detener PostgreSQL.');
      }
    },
  };
} else {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  postgres = new EmbeddedPostgres({
    databaseDir: data,
    user: 'mascotasegura',
    password: settings.password,
    port: 55432,
    persistent: true,
    authMethod: 'scram-sha-256',
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-h', '127.0.0.1'],
  });
}
if (!existsSync(resolve(data, 'PG_VERSION'))) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
await client.connect();
const result = await client.query("SELECT 1 FROM pg_database WHERE datname='mascotasegura'");
await client.end();
if (!result.rowCount) await postgres.createDatabase('mascotasegura');
const migrated = spawnSync(process.execPath, ['scripts/migrate.mjs'], {
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, DATABASE_URL: connection },
});
if (migrated.status !== 0) {
  await postgres.stop();
  process.exit(1);
}
console.log('PostgreSQL listo en 127.0.0.1:55432. Datos persistentes en .local-db/.');
console.log('Abre otra terminal y ejecuta npm run dev. Ctrl+C detiene esta base local.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60000);
