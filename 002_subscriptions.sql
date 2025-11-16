CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'trial',
  paypal_subscription_id text,
  started_at timestamptz DEFAULT now(),
  trial_expires_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id),
  user_id uuid REFERENCES users(id),
  amount numeric,
  currency text,
  paypal_event jsonb,
  status text,
  created_at timestamptz DEFAULT now()
);
