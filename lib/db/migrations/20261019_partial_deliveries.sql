CREATE TABLE IF NOT EXISTS praca_marketplace_delivery_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_type text NOT NULL CHECK(order_type IN ('quote','round')),order_id uuid NOT NULL,vendor_id text NOT NULL,request_key uuid NOT NULL,
 received_by text NOT NULL,items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),status text NOT NULL DEFAULT 'reported' CHECK(status IN ('reported','accepted','rejected')),
 buyer_reason text,reported_at timestamptz NOT NULL DEFAULT now(),answered_at timestamptz,release_status text NOT NULL DEFAULT 'blocked_provider',
 UNIQUE(order_type,order_id,request_key)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_delivery_receipts_order ON praca_marketplace_delivery_receipts(order_type,order_id,reported_at);