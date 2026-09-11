CREATE TABLE owners (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX sessions_owner_idx ON sessions(owner_id);

CREATE TABLE pets (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name text NOT NULL,
  species text NOT NULL CHECK (species IN ('Perro', 'Gato', 'Conejo', 'Ave', 'Otro')),
  breed text NOT NULL DEFAULT '',
  sex text NOT NULL CHECK (sex IN ('Macho', 'Hembra', 'No especificado')),
  color text NOT NULL DEFAULT '',
  owner_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL DEFAULT '',
  district text NOT NULL,
  notes text NOT NULL DEFAULT '',
  photo bytea,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pets_owner_idx ON pets(owner_id);

CREATE TABLE auth_attempts (
  key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);
