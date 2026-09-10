import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { db } from './db';
import { tokenHash } from './security';
export const cookieName = 'mascotasegura_session';
export async function currentOwner() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const { rows } = await db().query(
    'SELECT o.id, o.email FROM sessions s JOIN owners o ON o.id=s.owner_id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [tokenHash(token)],
  );
  return rows[0] as { id: string; email: string } | undefined;
}
export async function startSession(ownerId: string) {
  const token = randomBytes(32).toString('base64url');
  await db().query(
    "INSERT INTO sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '14 days')",
    [tokenHash(token), ownerId],
  );
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure:
      process.env.COOKIE_SECURE === 'true' || process.env.APP_URL?.startsWith('https://') === true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}
