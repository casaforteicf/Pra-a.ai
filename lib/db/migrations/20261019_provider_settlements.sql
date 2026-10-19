-- CICLO-02: trilha financeira por subpedido. A migração é aditiva e não ativa o fluxo.
ALTER TABLE praca_suborders
  ADD COLUMN IF NOT EXISTS provider_split_id text,
  ADD COLUMN IF NOT EXISTS settlement_status text NOT NULL DEFAULT 'disabled',
  ADD COLUMN IF NOT EXISTS settled_cents bigint NOT NULL DEFAULT 0 CHECK (settled_cents >= 0),
  ADD COLUMN IF NOT EXISTS refunded_cents bigint NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0);

ALTER TABLE praca_suborder_receipts DROP CONSTRAINT IF EXISTS praca_suborder_receipts_release_status_check;
ALTER TABLE praca_suborder_receipts ADD CONSTRAINT praca_suborder_receipts_release_status_check
  CHECK (release_status IN ('blocked_provider','escrow_pending','escrow_held','released','refund_pending','refunded','reconciliation'));

CREATE TABLE IF NOT EXISTS praca_provider_events (
  provider_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payment_id text NOT NULL,
  split_id text,
  suborder_id uuid REFERENCES praca_suborders(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_praca_provider_events_payment ON praca_provider_events(payment_id, processed_at DESC);

CREATE TABLE IF NOT EXISTS praca_suborder_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suborder_id uuid NOT NULL REFERENCES praca_suborders(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','processing','done','denied','reconciliation')),
  provider_refund_id text,
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(suborder_id, request_key)
);

CREATE TABLE IF NOT EXISTS praca_post_payment_jobs (
  order_id integer PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_deal_links_order_vendor ON order_deal_links(order_id,vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_payouts_order_vendor ON vendor_payouts(order_id,vendor_id);

ALTER TABLE vendor_payouts
  ADD COLUMN IF NOT EXISTS master_nsu text,
  ADD COLUMN IF NOT EXISTS movement_nsu text,
  ADD COLUMN IF NOT EXISTS provider_split_id text;

ALTER TABLE influencer_conversions
  ADD COLUMN IF NOT EXISTS master_nsu text,
  ADD COLUMN IF NOT EXISTS movement_nsu text;

ALTER TABLE praca_suborder_events DROP CONSTRAINT IF EXISTS praca_suborder_events_actor_type_check;
ALTER TABLE praca_suborder_events ADD CONSTRAINT praca_suborder_events_actor_type_check
  CHECK(actor_type IN ('buyer','vendor','admin','system','provider'));
