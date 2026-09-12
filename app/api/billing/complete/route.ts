import { NextResponse } from 'next/server';
import { currentOwner } from '@/lib/auth';
import { confirmCheckout } from '@/lib/billing';
import { failure, HttpError } from '@/lib/http';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para confirmar la suscripción.');
    const preapprovalId = z
      .string()
      .min(8)
      .max(160)
      .regex(/^[a-zA-Z0-9-]+$/)
      .parse(new URL(request.url).searchParams.get('preapproval_id'));
    const status = await confirmCheckout(owner.id, preapprovalId);
    return NextResponse.redirect(
      new URL(`/?subscription=${status === 'active' ? 'active' : 'pending'}`, request.url),
      303,
    );
  } catch (error) {
    return failure(error);
  }
}
