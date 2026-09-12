import { NextResponse } from 'next/server';
import { syncWebhookResource, verifyWebhook } from '@/lib/billing';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      data?: { id?: string | number };
    };
    const dataId = String(url.searchParams.get('data.id') || body.data?.id || '');
    const type = String(url.searchParams.get('type') || body.type || '');
    verifyWebhook(request, dataId);
    await syncWebhookResource(type, dataId);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      'Mercado Pago webhook rejected:',
      error instanceof Error ? error.message : 'Unknown',
    );
    return NextResponse.json({ error: 'Webhook inválido.' }, { status: 400 });
  }
}
