import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { currentOwner } from '@/lib/auth';
import { createYapePayment, latestYapePayment, type YapePayment } from '@/lib/data';
import { subscriptionAllowsAccess } from '@/lib/billing';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { yapePaymentSchema } from '@/lib/validation';

export async function GET() {
  try {
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para consultar tu pago.');
    return NextResponse.json(await latestYapePayment(owner.id), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para registrar tu pago.');
    if (owner.accountStatus === 'inactive') throw new HttpError(403, 'Tu cuenta está inactiva.');
    if (subscriptionAllowsAccess(owner.subscriptionStatus, owner.subscriptionExpiresAt))
      throw new HttpError(409, 'Tu suscripción ya está activa.');
    const pending = await latestYapePayment(owner.id);
    if (pending?.status === 'pending')
      throw new HttpError(409, 'Ya tienes un pago de Yape pendiente de revisión.');
    const { operationNumber } = yapePaymentSchema.parse(await readJson(request));
    const payment: YapePayment = {
      id: randomUUID(),
      ownerId: owner.id,
      email: owner.email,
      operationNumber,
      amount: 14.9,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };
    if (!(await createYapePayment(payment)))
      throw new HttpError(409, 'Ese número de operación ya fue registrado.');
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
