import { NextResponse } from 'next/server';
import { currentOwner } from '@/lib/auth';
import { confirmCheckout } from '@/lib/billing';
import { failure, HttpError } from '@/lib/http';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para confirmar la suscripción.');
    const sessionId = z
      .string()
      .startsWith('cs_')
      .parse(new URL(request.url).searchParams.get('session_id'));
    await confirmCheckout(owner.id, sessionId);
    return NextResponse.redirect(new URL('/?subscription=active', request.url), 303);
  } catch (error) {
    return failure(error);
  }
}
