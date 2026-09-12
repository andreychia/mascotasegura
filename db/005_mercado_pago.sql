ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS mercado_pago_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS owners_mercado_pago_subscription_idx
  ON owners(mercado_pago_subscription_id)
  WHERE mercado_pago_subscription_id IS NOT NULL;
