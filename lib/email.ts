import 'server-only';
import { tokenHash } from './security';

export const recoveryEmailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.RESET_EMAIL_FROM);

function appUrl() {
  const value =
    process.env.CONTEXT === 'branch-deploy'
      ? process.env.DEPLOY_PRIME_URL
      : process.env.APP_URL || process.env.URL;
  return new URL(value || 'http://localhost:3100').origin;
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESET_EMAIL_FROM;
  if (!apiKey || !from) throw new Error('Password recovery email is not configured');
  const resetUrl = `${appUrl()}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
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
