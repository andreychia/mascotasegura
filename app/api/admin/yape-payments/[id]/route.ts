import { NextResponse } from 'next/server';
import { currentOwner } from '@/lib/auth';
import { reviewYapePayment } from '@/lib/data';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { idSchema, yapePaymentReviewSchema } from '@/lib/validation';

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await currentOwner();
    if (!owner?.isAdmin) throw new HttpError(403, 'Acceso exclusivo del administrador.');
    const id = idSchema.parse((await ctx.params).id);
    const { status } = yapePaymentReviewSchema.parse(await readJson(request));
    const result = await reviewYapePayment(id, status);
    if (!result) throw new HttpError(409, 'El pago ya fue revisado o no existe.');
    return NextResponse.json({ ok: true, status, ...result });
  } catch (error) {
    return failure(error);
  }
}
