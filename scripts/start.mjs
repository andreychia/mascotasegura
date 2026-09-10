import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const target = resolve('.next/standalone');
if (!existsSync(resolve(target, 'server.js')))
  throw new Error('Ejecuta npm run build antes de npm start.');
cpSync('.next/static', resolve(target, '.next/static'), { recursive: true });
if (existsSync('public')) cpSync('public', resolve(target, 'public'), { recursive: true });
const child = spawn(process.execPath, [resolve(target, 'server.js')], {
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
    PORT: process.env.PORT || '3100',
  },
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code || 0;
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
