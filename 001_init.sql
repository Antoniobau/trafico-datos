CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text,
  role text NOT NULL CHECK (role IN ('advertiser','publisher','admin')),
  name text,
  created_at timestamptz DEFAULT now(),
  verified boolean DEFAULT false
);

CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  balance_numeric bigint DEFAULT 0,
  currency text DEFAULT 'USD',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid REFERENCES users(id),
  name text,
  total_credits bigint,
  consumed_credits bigint DEFAULT 0,
  price_per_action numeric DEFAULT 1,
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  created_at timestamptz DEFAULT now(),
  start_at timestamptz,
  end_at timestamptz
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id),
  publisher_id uuid REFERENCES users(id),
  event_type text CHECK (event_type IN ('impression','click')),
  ip inet,
  user_agent text,
  fingerprint text,
  referrer text,
  created_at timestamptz DEFAULT now(),
  score numeric DEFAULT 1.0,
  flagged boolean DEFAULT false
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  paypal_order_id text,
  amount numeric,
  currency text,
  status text,
  raw_response jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  description text,
  credits bigint,
  percent_off numeric,
  expires_at timestamptz,
  uses_left int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid REFERENCES users(id),
  amount numeric,
  currency text DEFAULT 'USD',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  details jsonb
);
