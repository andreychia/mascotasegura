import { NextResponse } from 'next/server';
import { currentOwner } from '@/lib/auth';
import { updatePet } from '@/lib/data';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { idSchema, petSchema } from '@/lib/validation';
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Tu sesión terminó. Inicia sesión otra vez.');
    const id = idSchema.parse((await ctx.params).id);
    const p = petSchema.parse(await readJson(request));
    const pet = await updatePet(id, owner.id, p);
    if (!pet) throw new HttpError(404, 'No encontramos esa mascota en tu cuenta.');
    return NextResponse.json(pet);
  } catch (e) {
    return failure(e);
  }
}
