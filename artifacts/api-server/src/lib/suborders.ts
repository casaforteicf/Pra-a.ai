import { pool } from "@workspace/db";
import { splitOrder } from "./suborderAmounts";
export const SUBORDER_SQL = "CREATE TABLE IF NOT EXISTS praca_suborders (\n id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id integer NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,\n vendor_id text NOT NULL,subtotal_cents bigint NOT NULL CHECK(subtotal_cents>=0),freight_cents bigint NOT NULL CHECK(freight_cents>=0),\n discount_cents bigint NOT NULL CHECK(discount_cents>=0),total_cents bigint NOT NULL CHECK(total_cents>=0),\n freight_net_cents bigint NOT NULL CHECK(freight_net_cents>=0),\n status text NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','shipped','partially_delivered','delivered')),\n created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,vendor_id),\n CHECK(total_cents=subtotal_cents+freight_cents-discount_cents)\n);\nCREATE TABLE IF NOT EXISTS praca_suborder_items (\n id uuid PRIMARY KEY DEFAULT gen_random_uuid(),suborder_id uuid NOT NULL REFERENCES praca_suborders(id) ON DELETE RESTRICT,\n order_item_id integer NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,\n quantity integer NOT NULL CHECK(quantity>0),net_cents bigint NOT NULL CHECK(net_cents>=0)\n);\nCREATE TABLE IF NOT EXISTS praca_suborder_receipts (\n id uuid PRIMARY KEY DEFAULT gen_random_uuid(),suborder_id uuid NOT NULL REFERENCES praca_suborders(id) ON DELETE RESTRICT,\n request_key uuid NOT NULL,received_by text NOT NULL,photo text NOT NULL,photo_mime text NOT NULL,\n status text NOT NULL DEFAULT 'reported' CHECK(status IN ('reported','accepted','rejected')),\n buyer_reason text,reported_at timestamptz NOT NULL DEFAULT now(),accepted_at timestamptz,\n release_cents bigint NOT NULL DEFAULT 0 CHECK(release_cents>=0),\n release_status text NOT NULL DEFAULT 'blocked_provider' CHECK(release_status='blocked_provider'), UNIQUE(suborder_id,request_key)\n);\nCREATE TABLE IF NOT EXISTS praca_suborder_receipt_items (\n id uuid PRIMARY KEY DEFAULT gen_random_uuid(),receipt_id uuid NOT NULL REFERENCES praca_suborder_receipts(id) ON DELETE RESTRICT,\n suborder_item_id uuid NOT NULL REFERENCES praca_suborder_items(id) ON DELETE RESTRICT,\n quantity integer NOT NULL CHECK(quantity>0), UNIQUE(receipt_id,suborder_item_id)\n);\nCREATE TABLE IF NOT EXISTS praca_suborder_events (\n id uuid PRIMARY KEY DEFAULT gen_random_uuid(),suborder_id uuid NOT NULL REFERENCES praca_suborders(id) ON DELETE RESTRICT,\n actor_type text NOT NULL CHECK(actor_type IN ('buyer','vendor','system')),actor_id text, status text NOT NULL,\n created_at timestamptz NOT NULL DEFAULT now()\n);\n";
export const subordersEnabled=()=>process.env.PRACA_SUBORDERS_ENABLED==="true";
export async function installSuborders(){
 if(!subordersEnabled())return;
 await pool.query(SUBORDER_SQL);
}
export async function createSuborders(orderId:number,freight:{vendorId:string;freight:number}[],discount:number){
 if(!subordersEnabled())return;
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const order=await client.query("SELECT total FROM orders WHERE id=$1 FOR UPDATE",[orderId]);
  if(!order.rows[0])throw new Error("Pedido não encontrado.");
  const existing=await client.query("SELECT id FROM praca_suborders WHERE order_id=$1",[orderId]);
  if(existing.rows.length)throw new Error("Separação já registrada para o pedido.");
  const items=await client.query("SELECT id,vendor_id,quantity,price_at_purchase FROM order_items WHERE order_id=$1 ORDER BY id",[orderId]);
  const groups=splitOrder(items.rows.map((r:any)=>({id:r.id,vendorId:r.vendor_id,quantity:r.quantity,price:r.price_at_purchase})),freight,discount);
  if(groups.reduce((s,g)=>s+g.totalCents,0)!==Math.round(Number(order.rows[0].total)*100))throw new Error("Totais de subpedidos divergentes.");
  for(const g of groups){
   const saved=await client.query("INSERT INTO praca_suborders(order_id,vendor_id,subtotal_cents,freight_cents,discount_cents,total_cents,freight_net_cents) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",[orderId,g.vendorId,g.subtotalCents,g.freightCents,g.discountCents,g.totalCents,g.freightNetCents]);
   for(const l of g.items)await client.query("INSERT INTO praca_suborder_items(suborder_id,order_item_id,quantity,net_cents) VALUES($1,$2,$3,$4)",[saved.rows[0].id,l.id,l.quantity,l.netCents]);
   await client.query("INSERT INTO praca_suborder_events(suborder_id,actor_type,status) VALUES($1,'system','created')",[saved.rows[0].id]);
  }
  await client.query("COMMIT");
 }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error}finally{client.release()}
}
