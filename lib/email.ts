import 'server-only';
import { createInterface } from 'node:readline';
import { connect, type TLSSocket } from 'node:tls';
import { tokenHash } from './security';

export const recoveryEmailConfigured = () =>
  Boolean(
    (process.env.RESEND_API_KEY && process.env.RESET_EMAIL_FROM) ||
      (process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD),
  );

function appUrl() {
  const value =
    process.env.CONTEXT === 'branch-deploy'
      ? process.env.DEPLOY_PRIME_URL
      : process.env.APP_URL || process.env.URL;
  return new URL(value || 'http://localhost:3100').origin;
}

async function sendWithResend(email: string, token: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESET_EMAIL_FROM;
  if (!apiKey || !from) throw new Error('Password recovery email is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `password-reset/${tokenHash(token)}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Restablece tu contraseña de MascotaSegura',
      text: `Recibimos una solicitud para cambiar tu contraseña de MascotaSegura. Abre este enlace durante los próximos 30 minutos: ${resetUrl}\n\nSi no solicitaste el cambio, ignora este mensaje.`,
      html: `<div style="font-family:Arial,sans-serif;color:#183c3e;line-height:1.6"><h1 style="font-size:24px">Restablece tu contraseña</h1><p>Recibimos una solicitud para cambiar tu contraseña de MascotaSegura.</p><p><a href="${resetUrl}" style="display:inline-block;background:#087f78;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Crear una contraseña nueva</a></p><p>El enlace vence en 30 minutos y solo puede usarse una vez.</p><p style="color:#627775;font-size:13px">Si no solicitaste el cambio, ignora este mensaje.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Email provider rejected request with ${response.status}`);
}

async function openGmailConnection() {
  return new Promise<TLSSocket>((resolve, reject) => {
    const socket = connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com' });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Gmail SMTP connection timed out'));
    }, 15000);
    socket.once('secureConnect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function sendWithGmail(email: string, resetUrl: string) {
  const user = process.env.SMTP_USER?.trim().toLowerCase();
  const password = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user))
    throw new Error('Gmail SMTP is not configured');
  const socket = await openGmailConnection();
  const lines = createInterface({ input: socket, crlfDelay: Infinity })[Symbol.asyncIterator]();
  async function nextLine() {
    return new Promise<IteratorResult<string>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Gmail SMTP response timed out')), 15000);
      lines.next().then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
  }
  async function response(expected: number[]) {
    let line = '';
    let code = 0;
    do {
      const next = await nextLine();
      if (next.done) throw new Error('Gmail SMTP closed the connection');
      line = next.value;
      code = Number(line.slice(0, 3));
    } while (line[3] === '-');
    if (!expected.includes(code)) throw new Error(`Gmail SMTP rejected a command with ${code}`);
  }
  async function command(value: string, expected: number[]) {
    socket.write(value + '\r\n');
    await response(expected);
  }
  try {
    await response([220]);
    await command('EHLO mascotasegura.netlify.app', [250]);
    await command('AUTH LOGIN', [334]);
    await command(Buffer.from(user).toString('base64'), [334]);
    await command(Buffer.from(password).toString('base64'), [235]);
    await command(`MAIL FROM:<${user}>`, [250]);
    await command(`RCPT TO:<${email}>`, [250, 251]);
    await command('DATA', [354]);
    const subject = Buffer.from('Restablece tu contraseña de MascotaSegura').toString('base64');
    const text = `Recibimos una solicitud para cambiar tu contraseña de MascotaSegura. Abre este enlace durante los próximos 30 minutos: ${resetUrl}\n\nSi no solicitaste el cambio, ignora este mensaje.`;
    const html = `<div style="font-family:Arial,sans-serif;color:#183c3e;line-height:1.6"><h1 style="font-size:24px">Restablece tu contraseña</h1><p>Recibimos una solicitud para cambiar tu contraseña de MascotaSegura.</p><p><a href="${resetUrl}" style="display:inline-block;background:#087f78;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Crear una contraseña nueva</a></p><p>El enlace vence en 30 minutos y solo puede usarse una vez.</p><p style="color:#627775;font-size:13px">Si no solicitaste el cambio, ignora este mensaje.</p></div>`;
    const boundary = `mascotasegura-${tokenHash(resetUrl).slice(0, 24)}`;
    const message = [
      `From: MascotaSegura <${user}>`,
      `To: ${email}`,
      `Subject: =?UTF-8?B?${subject}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      text,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      `--${boundary}--`,
      '',
    ]
      .join('\r\n')
      .replace(/\r\n\./g, '\r\n..');
    socket.write(message + '\r\n.\r\n');
    await response([250]);
    await command('QUIT', [221]);
  } finally {
    socket.destroy();
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${appUrl()}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
  if (process.env.RESEND_API_KEY && process.env.RESET_EMAIL_FROM)
    return sendWithResend(email, token, resetUrl);
  return sendWithGmail(email, resetUrl);
}
