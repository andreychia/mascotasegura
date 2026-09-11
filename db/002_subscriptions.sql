ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS owners_stripe_customer_idx
  ON owners(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS owners_stripe_subscription_idx
  ON owners(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
