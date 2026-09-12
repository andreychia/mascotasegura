import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { currentOwner } from '@/lib/auth';
import { getPetPhoto, ownsPet, setPetPhoto } from '@/lib/data';
import { checkOrigin, failure, HttpError } from '@/lib/http';
import { idSchema } from '@/lib/validation';
import { accountAllowsAccess, subscriptionAllowsAccess } from '@/lib/billing';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = idSchema.parse((await ctx.params).id);
    const photo = await getPetPhoto(id);
    if (!photo) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(photo), {
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
    if (!accountAllowsAccess(owner.accountStatus))
      throw new HttpError(403, 'Tu cuenta está inactiva.');
    if (!owner.isAdmin && !subscriptionAllowsAccess(owner.subscriptionStatus))
      throw new HttpError(402, 'Activa tu suscripción para cambiar la foto.');
    const id = idSchema.parse((await ctx.params).id);
    if (!(await ownsPet(id, owner.id)))
      throw new HttpError(404, 'No encontramos esa mascota en tu cuenta.');
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
    await setPetPhoto(id, owner.id, photo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
