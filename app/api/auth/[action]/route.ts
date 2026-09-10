import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { authSchema } from '@/lib/validation';
import { hashPassword, verifyPassword, tokenHash } from '@/lib/security';
import { cookieName, startSession } from '@/lib/auth';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    const { action } = await ctx.params;
    if (action === 'logout') {
      const jar = await cookies();
      const token = jar.get(cookieName)?.value;
      if (token) await db().query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
      jar.delete(cookieName);
      return NextResponse.json({ ok: true });
    }
    if (!['login', 'register'].includes(action)) throw new HttpError(404, 'Página no encontrada.');
    const input = authSchema.parse(await readJson(request));
    const key = tokenHash(action + ':' + input.email);
    const { rows: attempts } = await db().query(
      `INSERT INTO auth_attempts(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_attempts.expires_at<now() THEN 1 ELSE auth_attempts.attempts+1 END,
      expires_at=CASE WHEN auth_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE auth_attempts.expires_at END RETURNING attempts`,
      [key],
    );
    if (attempts[0].attempts > 10)
      throw new HttpError(429, 'Demasiados intentos. Espera 15 minutos para volver a intentarlo.');
    let ownerId: string;
    if (action === 'register') {
      ownerId = randomUUID();
      const hash = await hashPassword(input.password);
      const result = await db().query(
        'INSERT INTO owners(id,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id',
        [ownerId, input.email, hash],
      );
      if (!result.rowCount)
        throw new HttpError(
          409,
          'No se pudo crear la cuenta con ese correo. Si ya tienes una, inicia sesión.',
        );
    } else {
      const { rows } = await db().query('SELECT id,password_hash FROM owners WHERE email=$1', [
        input.email,
      ]);
      const dummyHash = '00000000000000000000000000000000:' + '00'.repeat(64);
      const valid = await verifyPassword(input.password, rows[0]?.password_hash || dummyHash);
      if (!rows[0] || !valid)
        throw new HttpError(401, 'El correo o la contraseña no son correctos.');
      ownerId = rows[0].id;
    }
    await startSession(ownerId);
    await db().query('DELETE FROM auth_attempts WHERE key=$1', [key]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
