import { NextResponse } from 'next/server';
import { currentOwner } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { idSchema, petSchema } from '@/lib/validation';
import { privateColumns } from '@/lib/pets';
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Tu sesión terminó. Inicia sesión otra vez.');
    const id = idSchema.parse((await ctx.params).id);
    const p = petSchema.parse(await readJson(request));
    const { rows } = await db().query(
      `UPDATE pets SET name=$1,species=$2,breed=$3,sex=$4,color=$5,owner_name=$6,phone=$7,address=$8,district=$9,notes=$10,updated_at=now()
   WHERE id=$11 AND owner_id=$12 RETURNING ${privateColumns}`,
      [
        p.name,
        p.species,
        p.breed,
        p.sex,
        p.color,
        p.ownerName,
        p.phone,
        p.address,
        p.district,
        p.notes,
        id,
        owner.id,
      ],
    );
    if (!rows[0]) throw new HttpError(404, 'No encontramos esa mascota en tu cuenta.');
    return NextResponse.json(rows[0]);
  } catch (e) {
    return failure(e);
  }
}
