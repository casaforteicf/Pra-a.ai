CREATE TABLE IF NOT EXISTS praca_suborder_cancellations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),suborder_id uuid NOT NULL REFERENCES praca_suborders(id) ON DELETE RESTRICT,
 consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE RESTRICT,reason text NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','reviewing','approved','rejected','refunded','reconciliation')),
 refund_cents bigint NOT NULL DEFAULT 0 CHECK(refund_cents>=0),refund_status text NOT NULL DEFAULT 'not_requested' CHECK(refund_status IN ('not_requested','reserved','processing','done','denied','reconciliation')),
 request_key uuid NOT NULL,operator_id text,provider_refund_id text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(suborder_id,request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_praca_suborder_cancellation_open ON praca_suborder_cancellations(suborder_id) WHERE status IN ('requested','reviewing','approved','reconciliation');
CREATE TABLE IF NOT EXISTS praca_admin_events (id bigserial PRIMARY KEY,operator_id text NOT NULL,action text NOT NULL,entity_type text NOT NULL,entity_id text NOT NULL,detail jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());