import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { currentOwner } from '@/lib/auth';
import { ownsPet } from '@/lib/data';
import { idSchema } from '@/lib/validation';
import { failure, HttpError } from '@/lib/http';
import { subscriptionAllowsAccess } from '@/lib/billing';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await currentOwner();
    if (!owner) throw new HttpError(401, 'Inicia sesión para descargar el QR.');
    if (!subscriptionAllowsAccess(owner.subscriptionStatus))
      throw new HttpError(402, 'Activa tu suscripción para descargar el QR.');
    const id = idSchema.parse((await ctx.params).id);
    if (!(await ownsPet(id, owner.id))) throw new HttpError(404, 'Mascota no encontrada.');
    const base = new URL(
      process.env.CONTEXT === 'branch-deploy'
        ? process.env.DEPLOY_PRIME_URL || 'http://localhost:3100'
        : process.env.APP_URL || 'http://localhost:3100',
    ).origin;
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
