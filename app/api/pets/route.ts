import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { currentOwner } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkOrigin, failure, HttpError, readJson } from '@/lib/http';
import { petSchema } from '@/lib/validation';
import { privateColumns } from '@/lib/pets';
export async function GET() {
  try {
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para ver tus mascotas.');
    const { rows } = await db().query(
      `SELECT ${privateColumns} FROM pets WHERE owner_id=$1 ORDER BY created_at DESC`,
      [owner.id],
    );
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Tu sesión terminó. Inicia sesión otra vez.');
    const p = petSchema.parse(await readJson(request));
    const id = randomUUID();
    const { rows } = await db().query(
      `INSERT INTO pets(id,owner_id,name,species,breed,sex,color,owner_name,phone,address,district,notes)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${privateColumns}`,
      [
        id,
        owner.id,
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
      ],
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
