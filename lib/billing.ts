import 'server-only';
import Stripe from 'stripe';
import { ownerIdByStripeCustomer, updateSubscription, type SubscriptionStatus } from './data';
import { HttpError } from './http';

export const monthlyPrice = '$3.99 USD';
export const billingConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
export const subscriptionAllowsAccess = (status?: string) =>
  status === 'active' || status === 'trialing';

function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key)
    throw new HttpError(503, 'Los pagos todavía no están configurados. Inténtalo más tarde.');
  return new Stripe(key);
}

function appUrl() {
  const value =
    process.env.CONTEXT === 'branch-deploy'
      ? process.env.DEPLOY_PRIME_URL
      : process.env.APP_URL || process.env.URL;
  return new URL(value || 'http://localhost:3100').origin;
}

export async function createSubscriptionCheckout(owner: { id: string; email: string }) {
  if (!billingConfigured())
    throw new HttpError(503, 'Los pagos todavía no están configurados. Inténtalo más tarde.');
  const base = appUrl();
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: owner.id,
    customer_email: owner.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: 399,
          recurring: { interval: 'month' },
          product_data: { name: 'MascotaSegura — suscripción mensual' },
        },
      },
    ],
    metadata: { ownerId: owner.id },
    subscription_data: { metadata: { ownerId: owner.id } },
    success_url: `${base}/api/billing/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?subscription=cancelled`,
  });
  if (!session.url) throw new HttpError(503, 'Stripe no devolvió una página de pago.');
  return session.url;
}

const normalizedStatus = (status: Stripe.Subscription.Status): SubscriptionStatus => {
  switch (status as string) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
      return 'unpaid';
    case 'paused':
      return 'paused';
    default:
      return 'canceled';
  }
};

export async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const ownerId = subscription.metadata.ownerId || (await ownerIdByStripeCustomer(customerId));
  if (!ownerId) return false;
  await updateSubscription(
    ownerId,
    normalizedStatus(subscription.status),
    customerId,
    subscription.id,
  );
  return true;
}

export async function confirmCheckout(ownerId: string, sessionId: string) {
  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });
  if (session.client_reference_id !== ownerId || session.status !== 'complete')
    throw new HttpError(403, 'No pudimos confirmar esta suscripción.');
  if (!session.subscription || typeof session.subscription === 'string')
    throw new HttpError(409, 'La suscripción aún se está procesando. Recarga en unos segundos.');
  await syncSubscription(session.subscription);
}

export function verifiedWebhook(rawBody: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, 'El webhook de pagos no está configurado.');
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}
