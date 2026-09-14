import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { currentOwner } from '@/lib/auth';
import { createPet, listOwnerPets } from '@/lib/data';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { petSchema } from '@/lib/validation';
import { accountAllowsAccess, subscriptionAllowsAccess } from '@/lib/billing';
export async function GET() {
  try {
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para ver tus mascotas.');
    if (!accountAllowsAccess(owner.accountStatus))
      throw new HttpError(403, 'Tu cuenta está inactiva.');
    if (
      !owner.isAdmin &&
      !subscriptionAllowsAccess(owner.subscriptionStatus, owner.subscriptionExpiresAt)
    )
      throw new HttpError(402, 'Activa tu suscripción para ver tus mascotas.');
    const pets = await listOwnerPets(owner.id);
    return NextResponse.json(pets, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Tu sesión terminó. Inicia sesión otra vez.');
    if (!accountAllowsAccess(owner.accountStatus))
      throw new HttpError(403, 'Tu cuenta está inactiva.');
    if (
      !owner.isAdmin &&
      !subscriptionAllowsAccess(owner.subscriptionStatus, owner.subscriptionExpiresAt)
    )
      throw new HttpError(402, 'Activa tu suscripción para registrar mascotas.');
    const p = petSchema.parse(await readJson(request));
    const id = randomUUID();
    return NextResponse.json(await createPet(id, owner.id, p), { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
