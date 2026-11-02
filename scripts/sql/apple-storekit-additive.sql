-- Additive only. Development may apply this script directly.
-- Production schema rollout is through the approved publishing process after
-- a verified backup/isolated restore rehearsal, never application startup.
BEGIN;
CREATE TABLE IF NOT EXISTS apple_purchases (
  transaction_id text PRIMARY KEY,
  original_transaction_id text NOT NULL,
  product_id text NOT NULL,
  environment text NOT NULL,
  app_account_token uuid NOT NULL,
  user_id integer,
  enrollment_id integer,
  purchased_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  verified_at timestamptz NOT NULL DEFAULT now(),
  erased_at timestamptz
);
CREATE INDEX IF NOT EXISTS apple_purchases_user_idx ON apple_purchases(user_id);
CREATE TABLE IF NOT EXISTS apple_purchase_intents (
  id uuid PRIMARY KEY,
  secret_hash text NOT NULL,
  app_account_token uuid NOT NULL UNIQUE,
  device_id text NOT NULL,
  user_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS apple_identity_challenges (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL,
  device_id text NOT NULL,
  request_hash text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apple_identity_email_created_idx ON apple_identity_challenges(email, created_at);
COMMIT;
