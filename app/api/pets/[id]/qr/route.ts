import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { currentOwner } from '@/lib/auth';
import { db } from '@/lib/db';
import { idSchema } from '@/lib/validation';
import { failure, HttpError } from '@/lib/http';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para descargar el QR.');
    const id = idSchema.parse((await ctx.params).id);
    const result = await db().query('SELECT id FROM pets WHERE id=$1 AND owner_id=$2', [
      id,
      owner.id,
    ]);
    if (!result.rowCount) throw new HttpError(404, 'Mascota no encontrada.');
    const base = new URL(process.env.APP_URL || 'http://localhost:3000').origin;
    const png = await QRCode.toBuffer(base + '/m/' + id, {
      type: 'png',
      width: 1024,
      margin: 4,
      errorCorrectionLevel: 'H',
      color: { dark: '#132e32', light: '#ffffff' },
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="mascotasegura-${id}.png"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
