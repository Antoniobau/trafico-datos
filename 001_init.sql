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
CREATE TABLE user_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  channel_url text,
  video_url text,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid,
  publisher_id uuid,
  event_type text,
  ip inet,
  user_agent text,
  fingerprint text,
  referrer text,
  created_at timestamptz DEFAULT now(),
  score numeric DEFAULT 1.0,
  flagged boolean DEFAULT false
);
