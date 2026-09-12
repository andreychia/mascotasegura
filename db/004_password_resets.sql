CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash text PRIMARY KEY,
  owner_id uuid UNIQUE NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx
  ON password_reset_tokens(expires_at);
