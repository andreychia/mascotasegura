import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ownerAdminDetails, updateMercadoPagoSubscription, type SubscriptionStatus } from './data';
import { HttpError } from './http';

export const monthlyPrice = 'S/14.90';
export const billingConfigured = () =>
  Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN && process.env.MERCADO_PAGO_WEBHOOK_SECRET);
export const subscriptionAllowsAccess = (status?: string) =>
  status === 'active' || status === 'trialing';
export const accountAllowsAccess = (status?: string) => status !== 'inactive';

type MercadoPagoSubscription = {
  id: string;
  status: string;
  external_reference?: string;
  init_point?: string;
};

type MercadoPagoAuthorizedPayment = { preapproval_id?: string };

function accessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token)
    throw new HttpError(503, 'Los pagos todavía no están configurados. Inténtalo más tarde.');
  return token;
}

function appUrl() {
  const value =
    process.env.CONTEXT === 'branch-deploy'
      ? process.env.DEPLOY_PRIME_URL
      : process.env.APP_URL || process.env.URL;
  return new URL(value || 'http://localhost:3100').origin;
}

async function mercadoPago<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${accessToken()}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Mercado Pago API error:', response.status, detail.slice(0, 500));
    throw new HttpError(502, 'Mercado Pago no pudo procesar la solicitud. Inténtalo nuevamente.');
  }
  return (await response.json()) as T;
}

function normalizedStatus(status?: string): SubscriptionStatus {
  switch (status) {
    case 'authorized':
      return 'active';
    case 'paused':
      return 'paused';
    case 'cancelled':
    case 'canceled':
      return 'canceled';
    default:
      return 'inactive';
  }
}

async function subscription(id: string) {
  return mercadoPago<MercadoPagoSubscription>(`/preapproval/${encodeURIComponent(id)}`);
}

export async function createSubscriptionCheckout(owner: { id: string; email: string }) {
  const current = await ownerAdminDetails(owner.id);
  if (current?.mercadoPagoSubscriptionId) {
    const existing = await subscription(current.mercadoPagoSubscriptionId).catch(() => undefined);
    if (existing?.status === 'authorized') {
      await syncSubscription(existing);
      throw new HttpError(409, 'Tu suscripción ya está activa.');
    }
    if (existing?.status === 'pending' && existing.init_point) return existing.init_point;
  }

  const base = appUrl();
  const created = await mercadoPago<MercadoPagoSubscription>('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: 'MascotaSegura — suscripción mensual',
      external_reference: owner.id,
      payer_email: owner.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 14.9,
        currency_id: 'PEN',
      },
      back_url: `${base}/api/billing/complete`,
      notification_url: `${base}/api/billing/webhook`,
      status: 'pending',
    }),
  });
  if (!created.id || !created.init_point)
    throw new HttpError(502, 'Mercado Pago no devolvió una página de pago.');
  await updateMercadoPagoSubscription(owner.id, 'inactive', created.id);
  return created.init_point;
}

export async function syncSubscription(value: MercadoPagoSubscription) {
  const ownerId = value.external_reference;
  if (!ownerId) return false;
  await updateMercadoPagoSubscription(ownerId, normalizedStatus(value.status), value.id);
  return true;
}

export async function confirmCheckout(ownerId: string, preapprovalId: string) {
  const value = await subscription(preapprovalId);
  if (value.external_reference !== ownerId)
    throw new HttpError(403, 'No pudimos confirmar esta suscripción.');
  await syncSubscription(value);
  return normalizedStatus(value.status);
}

export function verifyWebhook(request: Request, dataId: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const signature = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id');
  if (!secret || !signature || !requestId || !dataId) throw new HttpError(400, 'Firma ausente.');
  const parts = Object.fromEntries(
    signature.split(',').map((part) => part.trim().split('=', 2) as [string, string]),
  );
  if (!parts.ts || !parts.v1) throw new HttpError(400, 'Firma inválida.');
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const received = parts.v1.toLowerCase();
  if (
    expected.length !== received.length ||
    !timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'))
  )
    throw new HttpError(400, 'Firma inválida.');
}

export async function syncWebhookResource(type: string, dataId: string) {
  if (type === 'subscription_preapproval') return syncSubscription(await subscription(dataId));
  if (type === 'subscription_authorized_payment') {
    const payment = await mercadoPago<MercadoPagoAuthorizedPayment>(
      `/authorized_payments/${encodeURIComponent(dataId)}`,
    );
    if (!payment.preapproval_id) return false;
    return syncSubscription(await subscription(payment.preapproval_id));
  }
  return false;
}

export async function cancelSubscriptionBeforeDeletion(subscriptionId?: string) {
  if (!subscriptionId) return;
  await mercadoPago<MercadoPagoSubscription>(`/preapproval/${encodeURIComponent(subscriptionId)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });
}
