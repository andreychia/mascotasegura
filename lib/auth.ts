import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { createSession, ownerFromSession } from './data';
import { tokenHash } from './security';
export const cookieName = 'mascotasegura_session';
export function isSuperAdminEmail(email?: string | null) {
  const configured = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(configured && email?.trim().toLowerCase() === configured);
}
export async function currentOwner() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const owner = await ownerFromSession(tokenHash(token));
  return owner ? { ...owner, isAdmin: isSuperAdminEmail(owner.email) } : owner;
}
export async function startSession(ownerId: string) {
  const token = randomBytes(32).toString('base64url');
  await createSession(tokenHash(token), ownerId);
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure:
      process.env.COOKIE_SECURE === 'true' || process.env.APP_URL?.startsWith('https://') === true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}
