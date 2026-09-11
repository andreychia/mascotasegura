import { NextResponse } from 'next/server';
import { syncSubscription, verifiedWebhook } from '@/lib/billing';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Firma ausente.' }, { status: 400 });
  try {
    const event = verifiedWebhook(await request.text(), signature);
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await syncSubscription(event.data.object);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook rejected:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'Webhook inválido.' }, { status: 400 });
  }
}
