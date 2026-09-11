import { NextResponse } from 'next/server';
import { currentOwner } from '@/lib/auth';
import { createSubscriptionCheckout, subscriptionAllowsAccess } from '@/lib/billing';
import { checkOrigin, failure, HttpError } from '@/lib/http';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para continuar con la suscripción.');
    if (subscriptionAllowsAccess(owner.subscriptionStatus))
      throw new HttpError(409, 'Tu suscripción ya está activa.');
    return NextResponse.json({ url: await createSubscriptionCheckout(owner) });
  } catch (error) {
    return failure(error);
  }
}
