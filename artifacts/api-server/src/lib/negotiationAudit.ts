import { pool } from "@workspace/db";
// Ativação somente após revisar/aplicar a migração em homologação.
export const NSU_AUDIT_SQL = String.raw`
CREATE SEQUENCE IF NOT EXISTS praca_master_nsu_seq;
CREATE SEQUENCE IF NOT EXISTS praca_movement_nsu_seq;
CREATE TABLE IF NOT EXISTS praca_negotiations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 master_nsu text NOT NULL UNIQUE DEFAULT ('NSU-' || nextval('praca_master_nsu_seq')::text),
 source_type text NOT NULL,
 source_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_type,source_id)
);
CREATE TABLE IF NOT EXISTS praca_negotiation_links (
 entity_type text NOT NULL, entity_id text NOT NULL,
 master_id uuid NOT NULL REFERENCES praca_negotiations(id) ON DELETE RESTRICT,
 movement_nsu text NOT NULL UNIQUE DEFAULT ('MOV-' || nextval('praca_movement_nsu_seq')::text),
 scope_type text NOT NULL, scope_id text NOT NULL,
 vendor_id text,
 PRIMARY KEY(entity_type,entity_id),
 UNIQUE(entity_type,entity_id,master_id)
);
CREATE INDEX IF NOT EXISTS idx_praca_nsu_links_master ON praca_negotiation_links(master_id,scope_type,scope_id);
CREATE TABLE IF NOT EXISTS praca_negotiation_events (
 sequence bigserial PRIMARY KEY,
 master_id uuid NOT NULL REFERENCES praca_negotiations(id) ON DELETE RESTRICT,
 entity_type text NOT NULL,entity_id text NOT NULL,
 operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE','SNAPSHOT')),
 actor_type text NOT NULL,actor_id text,
 before_data jsonb,after_data jsonb,
 occurred_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(entity_type,entity_id,master_id) REFERENCES praca_negotiation_links(entity_type,entity_id,master_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_praca_nsu_events_master ON praca_negotiation_events(master_id,sequence);
CREATE UNIQUE INDEX IF NOT EXISTS idx_praca_nsu_initial_snapshot
 ON praca_negotiation_events(entity_type,entity_id) WHERE operation='SNAPSHOT';

CREATE OR REPLACE FUNCTION praca_nsu_immutable() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN RAISE EXCEPTION 'NSU audit records are append-only'; END;
$fn$;
DROP TRIGGER IF EXISTS praca_nsu_events_immutable ON praca_negotiation_events;
CREATE TRIGGER praca_nsu_events_immutable BEFORE UPDATE OR DELETE ON praca_negotiation_events FOR EACH ROW EXECUTE FUNCTION praca_nsu_immutable();
DROP TRIGGER IF EXISTS praca_nsu_links_immutable ON praca_negotiation_links;
CREATE TRIGGER praca_nsu_links_immutable BEFORE UPDATE OR DELETE ON praca_negotiation_links FOR EACH ROW EXECUTE FUNCTION praca_nsu_immutable();
DROP TRIGGER IF EXISTS praca_nsu_master_immutable ON praca_negotiations;
CREATE TRIGGER praca_nsu_master_immutable BEFORE UPDATE OR DELETE ON praca_negotiations FOR EACH ROW EXECUTE FUNCTION praca_nsu_immutable();

-- Somente campos operacionais/financeiros; fotos, contatos, nomes e texto livre
-- permanecem nas fontes protegidas e não são replicados na linha do tempo.
CREATE OR REPLACE FUNCTION praca_nsu_safe_data(d jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $fn$
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(coalesce(d,'{}'::jsonb))
 WHERE key=ANY(ARRAY['status','payment_status','refund_status','release_status','quantity','unit','unit_price',
 'price_at_purchase','subtotal','total','shipping','discount','freight','freight_total','delivery_days',
 'valor_bruto','comissao_percentual','comissao_valor','valor_liquido','valor','tipo','outcome','event_type',
 'provider_event_id','payment_id','charge_id','asaas_event_id','asaas_charge_id','provider_release_id',
 'subtotal_cents','freight_cents','discount_cents','total_cents','net_cents','release_cents','created_at','joined_at','identity_revealed_at','crm_lead_id','from_status','to_status','delivery_mode','delivery_reported_at','accepted_at','paid_at','delivered_at','released_at']);
$fn$;

CREATE OR REPLACE FUNCTION praca_nsu_record(tbl text,d jsonb,op text,old_d jsonb DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE
 entity text; parent_table text; parent_entity text; parent_data jsonb;
 master uuid; linked_master uuid; scope_kind text; scope_entity text; inherited_vendor text;
BEGIN
 entity:=d->>'id';
 IF tbl IN ('praca_marketplace_fulfillments','praca_delivery_acceptances') THEN
   entity:=(d->>'order_type')||':'||(d->>'order_id');
 ELSIF tbl IN ('quote_recipients','quote_vendor_leads') THEN
   entity:=(d->>'quote_request_id')||':'||(d->>'vendor_id');
 ELSIF tbl='buying_round_vendor_leads' THEN entity:=(d->>'round_id')||':'||(d->>'vendor_id');
 ELSIF tbl='praca_asaas_webhook_events' THEN entity:=d->>'asaas_event_id';
 END IF;
 IF entity IS NULL THEN RAISE EXCEPTION 'Missing audit identity for %',tbl; END IF;
 IF tbl IN ('orders','quote_requests','buying_rounds') THEN
   INSERT INTO praca_negotiations(source_type,source_id) VALUES(tbl,entity) ON CONFLICT(source_type,source_id) DO NOTHING;
   SELECT id INTO master FROM praca_negotiations WHERE source_type=tbl AND source_id=entity;
   scope_kind:=CASE tbl WHEN 'orders' THEN 'marketplace' WHEN 'quote_requests' THEN 'quote' ELSE 'lot' END;
   scope_entity:=entity;
 ELSE
   CASE
   WHEN tbl IN ('praca_suborders','order_items','order_deal_links','vendor_payouts','deliveries','disputes','asaas_payment_events')
     THEN parent_table:='orders';parent_entity:=d->>'order_id';
   WHEN tbl IN ('praca_suborder_items','praca_suborder_receipts','praca_suborder_events') THEN parent_table:='praca_suborders';parent_entity:=d->>'suborder_id';
   WHEN tbl='praca_suborder_receipt_items' THEN parent_table:='praca_suborder_receipts';parent_entity:=d->>'receipt_id';
   WHEN tbl IN ('delivery_events','delivery_proofs','praca_bank_transactions')
     THEN parent_table:='deliveries';parent_entity:=d->>'delivery_id';
   WHEN tbl IN ('quote_request_items','quote_recipients','quote_offers','quote_vendor_leads')
     THEN parent_table:='quote_requests';parent_entity:=d->>'quote_request_id';
   WHEN tbl='quote_offer_items' THEN parent_table:='quote_offers';parent_entity:=d->>'offer_id';
   WHEN tbl IN ('buying_round_participants','buying_round_bids','buying_round_orders','buying_round_vendor_leads')
     THEN parent_table:='buying_rounds';parent_entity:=d->>'round_id';
   WHEN tbl='buying_round_bid_events' THEN parent_table:='buying_round_bids';parent_entity:=d->>'bid_id';
   WHEN tbl IN ('praca_marketplace_fulfillments','praca_marketplace_fulfillment_events','praca_order_disputes','praca_order_cancellations','praca_delivery_acceptances')
     THEN parent_table:=CASE d->>'order_type' WHEN 'quote' THEN 'quote_requests' WHEN 'round' THEN 'buying_round_orders' END;parent_entity:=d->>'order_id';
   WHEN tbl='praca_order_dispute_events' THEN parent_table:='praca_order_disputes';parent_entity:=d->>'dispute_id';
   WHEN tbl='praca_order_cancellation_events' THEN parent_table:='praca_order_cancellations';parent_entity:=d->>'cancellation_id';
   WHEN tbl='praca_asaas_webhook_events' THEN
     SELECT 'quote_requests',id::text INTO parent_table,parent_entity FROM quote_requests q WHERE to_jsonb(q)->>'asaas_charge_id'=d->>'charge_id' LIMIT 1;
     IF parent_entity IS NULL THEN SELECT 'buying_round_orders',id::text INTO parent_table,parent_entity FROM buying_round_orders WHERE asaas_charge_id=d->>'charge_id' LIMIT 1;END IF;
   ELSE RAISE EXCEPTION 'Unsupported NSU source %',tbl;
   END CASE;
   -- Eventos externos ignorados e lançamentos sem pedido não representam negociação.
   IF parent_entity IS NULL AND tbl IN ('praca_asaas_webhook_events','praca_bank_transactions','asaas_payment_events') THEN RETURN NULL; END IF;
   IF parent_table IS NULL OR parent_entity IS NULL THEN RAISE EXCEPTION 'Missing NSU parent for %',tbl; END IF;
   SELECT master_id,scope_type,scope_id,vendor_id INTO master,scope_kind,scope_entity,inherited_vendor
     FROM praca_negotiation_links WHERE entity_type=parent_table AND entity_id=parent_entity;
   IF master IS NULL THEN
     EXECUTE format('SELECT to_jsonb(s) FROM %I s WHERE s.id::text=$1',parent_table) INTO parent_data USING parent_entity;
     IF parent_data IS NULL THEN RAISE EXCEPTION 'NSU parent not found for %',tbl;END IF;
     PERFORM praca_nsu_record(parent_table,parent_data,'SNAPSHOT');
     SELECT master_id,scope_type,scope_id,vendor_id INTO master,scope_kind,scope_entity,inherited_vendor
       FROM praca_negotiation_links WHERE entity_type=parent_table AND entity_id=parent_entity;
   END IF;
   IF tbl='buying_round_orders' THEN scope_kind:='round';scope_entity:=entity; END IF;
   IF tbl='buying_round_participants' THEN scope_kind:='participant';scope_entity:=entity; END IF;
 END IF;
 -- Serializa eventos de uma negociação e preserva um único vínculo por entidade.
 PERFORM 1 FROM praca_negotiations WHERE id=master FOR UPDATE;
 INSERT INTO praca_negotiation_links(entity_type,entity_id,master_id,scope_type,scope_id,vendor_id)
 VALUES(tbl,entity,master,scope_kind,scope_entity,coalesce(d->>'vendor_id',inherited_vendor))
 ON CONFLICT(entity_type,entity_id) DO NOTHING;
 SELECT master_id INTO linked_master FROM praca_negotiation_links WHERE entity_type=tbl AND entity_id=entity;
 IF linked_master IS DISTINCT FROM master THEN RAISE EXCEPTION 'Cannot move an entity to another master NSU';END IF;
 IF op='UPDATE' AND d=old_d THEN RETURN master;END IF;
 INSERT INTO praca_negotiation_events(master_id,entity_type,entity_id,operation,actor_type,actor_id,before_data,after_data,occurred_at)
 VALUES(master,tbl,entity,op,coalesce(d->>'actor_type',nullif(current_setting('app.actor_type',true),''),'system'),coalesce(d->>'actor_consumer_id',d->>'actor_id',nullif(current_setting('app.actor_id',true),'')),
   CASE WHEN old_d IS NULL THEN NULL ELSE praca_nsu_safe_data(old_d) END,
   CASE WHEN op='DELETE' THEN NULL ELSE praca_nsu_safe_data(d) END,
   clock_timestamp())
 ON CONFLICT DO NOTHING;
 RETURN master;
END;
$fn$;
CREATE OR REPLACE FUNCTION praca_nsu_source_trigger() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(OLD)->>'id') IS DISTINCT FROM (to_jsonb(NEW)->>'id') THEN RAISE EXCEPTION 'Cannot change audited entity identity';END IF;
 IF TG_OP='DELETE' THEN PERFORM praca_nsu_record(TG_TABLE_NAME,to_jsonb(OLD),'DELETE',to_jsonb(OLD));RETURN OLD;END IF;
 PERFORM praca_nsu_record(TG_TABLE_NAME,to_jsonb(NEW),TG_OP,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END);
 RETURN NEW;
END;
$fn$;

DO $install$
DECLARE tbl text; r jsonb;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['praca_suborders','praca_suborder_items','praca_suborder_receipts','praca_suborder_receipt_items','praca_suborder_events','orders','quote_requests','buying_rounds','buying_round_participants','buying_round_bids','buying_round_bid_events','buying_round_orders','buying_round_vendor_leads','order_items','order_deal_links','vendor_payouts','deliveries','delivery_events','delivery_proofs','disputes','asaas_payment_events','praca_bank_transactions','quote_request_items','quote_recipients','quote_offers','quote_offer_items','quote_vendor_leads','praca_marketplace_fulfillments','praca_marketplace_fulfillment_events','praca_order_disputes','praca_order_dispute_events','praca_order_cancellations','praca_order_cancellation_events','praca_delivery_acceptances','praca_asaas_webhook_events'] LOOP
   IF to_regclass(tbl) IS NULL THEN CONTINUE; END IF;
   EXECUTE format('DROP TRIGGER IF EXISTS praca_nsu_audit ON %I',tbl);
   EXECUTE format('CREATE TRIGGER praca_nsu_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION praca_nsu_source_trigger()',tbl);
   FOR r IN EXECUTE format('SELECT to_jsonb(s) FROM %I s',tbl) LOOP
     PERFORM praca_nsu_record(tbl,r,'SNAPSHOT');
   END LOOP;
 END LOOP;
END;
$install$;
`;
export async function installNegotiationAudit(): Promise<void> {
 if(process.env.PRACA_NSU_AUDIT_ENABLED!=="true") return;
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(713049, 1)");
  await client.query(NSU_AUDIT_SQL);
  await client.query("COMMIT");
 }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error}finally{client.release()}
}
