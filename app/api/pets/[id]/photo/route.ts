import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { currentOwner } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkOrigin, failure, HttpError } from '@/lib/http';
import { idSchema } from '@/lib/validation';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = idSchema.parse((await ctx.params).id);
    const { rows } = await db().query('SELECT photo FROM pets WHERE id=$1', [id]);
    if (!rows[0]?.photo) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(rows[0].photo), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para cambiar la foto.');
    const id = idSchema.parse((await ctx.params).id);
    const owned = await db().query('SELECT id FROM pets WHERE id=$1 AND owner_id=$2', [
      id,
      owner.id,
    ]);
    if (!owned.rowCount) throw new HttpError(404, 'No encontramos esa mascota en tu cuenta.');
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Selecciona una foto.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(413, 'La foto debe pesar menos de 5 MB.');
      }
      chunks.push(value);
    }
    let photo: Buffer;
    try {
      const inputImage = sharp(Buffer.concat(chunks), { limitInputPixels: 25000000 });
      const metadata = await inputImage.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format || ''))
        throw new Error('Unsupported image format');
      photo = await inputImage
        .rotate()
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new HttpError(400, 'Selecciona una imagen JPG, PNG o WebP válida.');
    }
    await db().query('UPDATE pets SET photo=$1,updated_at=now() WHERE id=$2 AND owner_id=$3', [
      photo,
      id,
      owner.id,
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
