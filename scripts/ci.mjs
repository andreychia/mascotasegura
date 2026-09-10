import { spawn } from 'node:child_process';
import { once } from 'node:events';
const base = process.env.APP_URL || 'http://localhost:3100';
const port = new URL(base).port || '80';
const server = spawn(process.execPath, ['scripts/start.mjs'], {
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: port },
});
try {
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw new Error('Server exited.');
    try {
      const r = await fetch(base);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error('Server did not become ready.');
  await new Promise((res, rej) => {
    const test = spawn(process.execPath, ['scripts/integration.mjs'], {
      stdio: 'inherit',
      windowsHide: true,
      env: process.env,
    });
    test.on('error', rej);
    test.on('exit', (code) => (code === 0 ? res() : rej(new Error('Integration tests failed'))));
  });
} finally {
  server.kill('SIGTERM');
}
