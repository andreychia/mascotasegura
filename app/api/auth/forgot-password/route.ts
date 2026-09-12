import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  bumpAuthAttempt,
  createPasswordReset,
  ownerByEmail,
  revokePasswordReset,
} from '@/lib/data';
import { recoveryEmailConfigured, sendPasswordResetEmail } from '@/lib/email';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { tokenHash } from '@/lib/security';
import { forgotPasswordSchema } from '@/lib/validation';

const genericMessage =
  'Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!recoveryEmailConfigured())
      throw new HttpError(503, 'La recuperación por correo todavía no está disponible.');
    const { email } = forgotPasswordSchema.parse(await readJson(request));
    const attempts = await bumpAuthAttempt(tokenHash(`password-reset:${email}`));
    if (attempts > 5) return NextResponse.json({ ok: true, message: genericMessage });
    const owner = await ownerByEmail(email);
    if (!owner) return NextResponse.json({ ok: true, message: genericMessage });
    const token = randomBytes(32).toString('base64url');
    const resetTokenHash = tokenHash(token);
    await createPasswordReset(
      owner.id,
      resetTokenHash,
      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    );
    try {
      await sendPasswordResetEmail(email, token);
    } catch (error) {
      await revokePasswordReset(resetTokenHash);
      console.error(
        'Password recovery email failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
    return NextResponse.json({ ok: true, message: genericMessage });
  } catch (error) {
    return failure(error);
  }
}
