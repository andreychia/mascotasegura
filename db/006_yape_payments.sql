ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS yape_payments (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  operation_number varchar(20) UNIQUE NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 14.90 CHECK (amount = 14.90),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS yape_payments_owner_idx
  ON yape_payments(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS yape_payments_pending_idx
  ON yape_payments(created_at DESC)
  WHERE status = 'pending';
