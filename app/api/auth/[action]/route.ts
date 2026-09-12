import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  bumpAuthAttempt,
  clearAuthAttempt,
  createOwner,
  deleteSession,
  ownerByEmail,
  type SubscriptionStatus,
} from '@/lib/data';
import { authSchema } from '@/lib/validation';
import { hashPassword, verifyPassword, tokenHash } from '@/lib/security';
import { cookieName, isSuperAdminEmail, startSession } from '@/lib/auth';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { billingConfigured, subscriptionAllowsAccess } from '@/lib/billing';
export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    const { action } = await ctx.params;
    if (action === 'logout') {
      const jar = await cookies();
      const token = jar.get(cookieName)?.value;
      if (token) await deleteSession(tokenHash(token));
      jar.delete(cookieName);
      return NextResponse.json({ ok: true });
    }
    if (!['login', 'register'].includes(action)) throw new HttpError(404, 'Página no encontrada.');
    const input = authSchema.parse(await readJson(request));
    const key = tokenHash(action + ':' + input.email);
    const attempts = await bumpAuthAttempt(key);
    if (attempts > 10)
      throw new HttpError(429, 'Demasiados intentos. Espera 15 minutos para volver a intentarlo.');
    let ownerId: string;
    let subscriptionStatus: SubscriptionStatus = 'active';
    let accountStatus: 'active' | 'inactive' = 'active';
    if (action === 'register') {
      ownerId = randomUUID();
      const hash = await hashPassword(input.password);
      subscriptionStatus = billingConfigured() ? 'inactive' : 'active';
      const created = await createOwner({
        id: ownerId,
        email: input.email,
        passwordHash: hash,
        subscriptionStatus,
      });
      if (!created)
        throw new HttpError(
          409,
          'No se pudo crear la cuenta con ese correo. Si ya tienes una, inicia sesión.',
        );
    } else {
      const owner = await ownerByEmail(input.email);
      const dummyHash = '00000000000000000000000000000000:' + '00'.repeat(64);
      const valid = await verifyPassword(input.password, owner?.passwordHash || dummyHash);
      if (!owner || !valid) throw new HttpError(401, 'El correo o la contraseña no son correctos.');
      ownerId = owner.id;
      subscriptionStatus = owner.subscriptionStatus;
      accountStatus = owner.accountStatus;
    }
    await startSession(ownerId);
    await clearAuthAttempt(key);
    return NextResponse.json({
      ok: true,
      accountInactive: accountStatus === 'inactive',
      subscriptionRequired:
        !isSuperAdminEmail(input.email) && !subscriptionAllowsAccess(subscriptionStatus),
    });
  } catch (e) {
    return failure(e);
  }
}
