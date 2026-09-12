import { NextResponse } from 'next/server';
import { consumePasswordReset } from '@/lib/data';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { hashPassword, tokenHash } from '@/lib/security';
import { resetPasswordSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = resetPasswordSchema.parse(await readJson(request));
    const changed = await consumePasswordReset(
      tokenHash(input.token),
      await hashPassword(input.password),
    );
    if (!changed)
      throw new HttpError(400, 'El enlace venció o ya fue utilizado. Solicita uno nuevo.');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
