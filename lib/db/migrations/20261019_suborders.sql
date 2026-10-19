BEGIN;
CREATE TABLE IF NOT EXISTS praca_suborders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id integer NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 vendor_id text NOT NULL,subtotal_cents bigint NOT NULL CHECK(subtotal_cents>=0),freight_cents bigint NOT NULL CHECK(freight_cents>=0),
 discount_cents bigint NOT NULL CHECK(discount_cents>=0),total_cents bigint NOT NULL CHECK(total_cents>=0),
 freight_net_cents bigint NOT NULL CHECK(freight_net_cents>=0),
 status text NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','shipped','partially_delivered','delivered')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,vendor_id),
 CHECK(total_cents=subtotal_cents+freight_cents-discount_cents)
);
CREATE TABLE IF NOT EXISTS praca_suborder_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),suborder_id uuid NOT NULL REFERENCES praca_suborders(id) ON DELETE RESTRICT,
 order_item_id integer NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK(quantity>0),net_cents bigint NOT NULL CHECK(net_cents>=0)
);
CREATE TABLE IF NOT EXISTS praca_suborder_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),suborder_id uuid NOT NULL REFERENCES praca_suborders(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL,received_by text NOT NULL,photo text NOT NULL,photo_mime text NOT NULL,
 status text NOT NULL DEFAULT 'reported' CHECK(status IN ('reported','accepted','rejected')),
 buyer_reason text,reported_at timestamptz NOT NULL DEFAULT now(),accepted_at timestamptz,
 release_cents bigint NOT NULL DEFAULT 0 CHECK(release_cents>=0),
 release_status text NOT NULL DEFAULT 'blocked_provider' CHECK(release_status='blocked_provider'), UNIQUE(suborder_id,request_key)
);
CREATE TABLE IF NOT EXISTS praca_suborder_receipt_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),receipt_id uuid NOT NULL REFERENCES praca_suborder_receipts(id) ON DELETE RESTRICT,
 suborder_item_id uuid NOT NULL REFERENCES praca_suborder_items(id) ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK(quantity>0), UNIQUE(receipt_id,suborder_item_id)
);
CREATE TABLE IF NOT EXISTS praca_suborder_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),suborder_id uuid NOT NULL REFERENCES praca_suborders(id) ON DELETE RESTRICT,
 actor_type text NOT NULL CHECK(actor_type IN ('buyer','vendor','system')),actor_id text, status text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
