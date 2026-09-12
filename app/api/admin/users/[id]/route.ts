import { NextResponse } from 'next/server';
import { currentOwner } from '@/lib/auth';
import {
  deleteOwnerCompletely,
  ownerAdminDetails,
  setOwnerAccountStatus,
  type AccountStatus,
} from '@/lib/data';
import { cancelSubscriptionBeforeDeletion } from '@/lib/billing';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { idSchema } from '@/lib/validation';
import { z } from 'zod';

async function authorize(targetId: string) {
  const owner = await currentOwner();
  if (!owner?.isAdmin) throw new HttpError(403, 'Acceso exclusivo del administrador.');
  if (owner.id === targetId)
    throw new HttpError(409, 'No puedes modificar ni eliminar tu propia cuenta administrativa.');
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const id = idSchema.parse((await ctx.params).id);
    await authorize(id);
    const { accountStatus } = z
      .object({ accountStatus: z.enum(['active', 'inactive']) })
      .strict()
      .parse(await readJson(request));
    if (!(await setOwnerAccountStatus(id, accountStatus as AccountStatus)))
      throw new HttpError(404, 'Usuario no encontrado.');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const id = idSchema.parse((await ctx.params).id);
    await authorize(id);
    const target = await ownerAdminDetails(id);
    if (!target) throw new HttpError(404, 'Usuario no encontrado.');
    await cancelSubscriptionBeforeDeletion(target.mercadoPagoSubscriptionId);
    await deleteOwnerCompletely(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
