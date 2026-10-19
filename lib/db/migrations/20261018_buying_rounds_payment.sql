-- Praça.ai buying rounds and held-payment lifecycle.
-- Idempotent so an environment where the tables were provisioned manually can adopt it safely.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS buying_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  category varchar(120) NOT NULL,
  item_name varchar(200) NOT NULL,
  specification text,
  unit varchar(30) NOT NULL,
  city varchar(100) NOT NULL,
  state varchar(2) NOT NULL,
  needed_at date NOT NULL,
  closes_at timestamptz NOT NULL,
  created_by_consumer_id integer REFERENCES consumers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  winning_bid_id uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buying_rounds_open_location
  ON buying_rounds (city, state, closes_at) WHERE status='open';

CREATE TABLE IF NOT EXISTS buying_round_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES buying_rounds(id) ON DELETE CASCADE,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, consumer_id)
);
CREATE INDEX IF NOT EXISTS idx_buying_round_participants_consumer
  ON buying_round_participants (consumer_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS buying_round_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES buying_rounds(id) ON DELETE CASCADE,
  vendor_id text NOT NULL,
  unit_price numeric(14,2) NOT NULL CHECK (unit_price > 0),
  freight_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (freight_total >= 0),
  delivery_days integer NOT NULL CHECK (delivery_days >= 0),
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS buying_round_bid_events (
  id bigserial PRIMARY KEY,
  bid_id uuid NOT NULL REFERENCES buying_round_bids(id) ON DELETE CASCADE,
  unit_price numeric(14,2) NOT NULL,
  freight_total numeric(14,2) NOT NULL,
  delivery_days integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buying_round_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES buying_rounds(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL UNIQUE REFERENCES buying_round_participants(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES buying_round_bids(id),
  vendor_id text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  total numeric(14,2) NOT NULL CHECK (total > 0),
  status text NOT NULL DEFAULT 'awaiting_buyer',
  accepted_at timestamptz,
  payment_method text,
  asaas_charge_id text,
  asaas_pix_payload text,
  asaas_pix_qrcode_image text,
  asaas_invoice_url text,
  paid_at timestamptz,
  delivered_at timestamptz,
  released_at timestamptz,
  crm_sync_status text,
  crm_lead_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buying_round_orders_status ON buying_round_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS buying_round_vendor_leads (
  round_id uuid NOT NULL REFERENCES buying_rounds(id) ON DELETE CASCADE,
  vendor_id text NOT NULL,
  crm_lead_id text NOT NULL,
  crm_notified boolean NOT NULL DEFAULT false,
  identity_revealed_at timestamptz,
  PRIMARY KEY (round_id, vendor_id)
);

-- Add payment columns to installations that already have the round tables.
ALTER TABLE buying_round_orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE buying_round_orders ADD COLUMN IF NOT EXISTS asaas_charge_id text;
ALTER TABLE buying_round_orders ADD COLUMN IF NOT EXISTS asaas_pix_payload text;
ALTER TABLE buying_round_orders ADD COLUMN IF NOT EXISTS asaas_pix_qrcode_image text;
ALTER TABLE buying_round_orders ADD COLUMN IF NOT EXISTS asaas_invoice_url text;
ALTER TABLE buying_round_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE buying_round_orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE buying_round_orders ADD COLUMN IF NOT EXISTS released_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS idx_buying_round_orders_asaas_charge
  ON buying_round_orders (asaas_charge_id);
