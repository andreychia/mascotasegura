import { NextResponse } from 'next/server';
import { currentOwner } from '@/lib/auth';
import { listYapePayments } from '@/lib/data';
import { failure, HttpError } from '@/lib/http';

export async function GET() {
  try {
    const owner = await currentOwner();
    if (!owner?.isAdmin) throw new HttpError(403, 'Acceso exclusivo del administrador.');
    return NextResponse.json(await listYapePayments(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
