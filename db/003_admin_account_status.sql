ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

ALTER TABLE owners
  DROP CONSTRAINT IF EXISTS owners_account_status_check;

ALTER TABLE owners
  ADD CONSTRAINT owners_account_status_check
  CHECK (account_status IN ('active', 'inactive'));
