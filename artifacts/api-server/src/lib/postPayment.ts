import { pool } from "@workspace/db";
import { vendorPool } from "./vendorDb";
import { createDealFromPracaOrder, findOrCreateLead } from "./vendorSyncService";

export async function processMarketplacePostPayment(orderId:number):Promise<void>{
 const claim=await pool.query("INSERT INTO praca_post_payment_jobs(order_id,status,attempts,locked_at) VALUES($1,'processing',1,now()) ON CONFLICT(order_id) DO UPDATE SET status='processing',attempts=praca_post_payment_jobs.attempts+1,locked_at=now(),updated_at=now() WHERE praca_post_payment_jobs.status IN ('pending','failed') RETURNING order_id",[orderId]);
 if(!claim.rows[0])return;
 try{
  const result=await pool.query("SELECT o.id,o.order_number,o.total,o.consumer_id,o.guest_name,o.guest_phone,o.delivery_address,c.name,c.phone,c.email FROM orders o LEFT JOIN consumers c ON c.id=o.consumer_id WHERE o.id=$1 AND o.payment_status='paid'",[orderId]);
  const order=result.rows[0];if(!order)throw new Error("paid_order_not_found");
  const items=(await pool.query("SELECT vendor_id,product_name,quantity,price_at_purchase FROM order_items WHERE order_id=$1 ORDER BY id",[orderId])).rows;
  const nsu=process.env.PRACA_NSU_AUDIT_ENABLED==="true"?(await pool.query("SELECT n.master_nsu,l.movement_nsu FROM praca_negotiation_links l JOIN praca_negotiations n ON n.id=l.master_id WHERE l.entity_type='orders' AND l.entity_id=$1::text LIMIT 1",[orderId])).rows[0]:null;
  const grouped=new Map<string,any[]>();for(const item of items){if(item.vendor_id){const list=grouped.get(item.vendor_id)??[];list.push(item);grouped.set(item.vendor_id,list)}}
  for(const [vendorId,vendorItems] of grouped){
   if(!(await pool.query("SELECT 1 FROM order_deal_links WHERE order_id=$1 AND vendor_id=$2",[orderId,vendorId])).rows[0]){
    const leadId=await findOrCreateLead(vendorId,{nome:String(order.name??order.guest_name??"Comprador Praça.ai"),telefone:order.phone??order.guest_phone??null,email:order.email??null,endereco:String(order.delivery_address??"")});
    const gross=vendorItems.reduce((sum,item)=>sum+Number(item.price_at_purchase)*Number(item.quantity),0);
    const dealId=await createDealFromPracaOrder({tenantId:vendorId,leadId,orderNumber:String(order.order_number),items:vendorItems.map((item)=>({productName:String(item.product_name),quantity:Number(item.quantity)})),valor:gross});
    await pool.query("INSERT INTO order_deal_links(order_id,vendor_id,deal_id) VALUES($1,$2,$3) ON CONFLICT(order_id,vendor_id) DO NOTHING",[orderId,vendorId,dealId]);
   }
   const grossCents=vendorItems.reduce((sum,item)=>sum+Math.round(Number(item.price_at_purchase)*100)*Number(item.quantity),0);
   const cfg=await vendorPool.query("SELECT comissao_praca_ai_percentual FROM tenants WHERE id=$1",[vendorId]);
   const feeBps=Math.round(Number(cfg.rows[0]?.comissao_praca_ai_percentual??8)*100),feeCents=Math.floor(grossCents*feeBps/10000);
   await pool.query("INSERT INTO vendor_payouts(order_id,vendor_id,valor_bruto,comissao_percentual,comissao_valor,valor_liquido,status,master_nsu,movement_nsu) VALUES($1,$2,$3,$4,$5,$6,'pendente',$7,$8) ON CONFLICT(order_id,vendor_id) DO NOTHING",[orderId,vendorId,grossCents/100,feeBps/100,feeCents/100,(grossCents-feeCents)/100,nsu?.master_nsu??null,nsu?.movement_nsu??null]);
  }
  if(order.consumer_id){const coins=Math.floor(Number(order.total)/10);if(coins>0){const reason="compra:"+orderId;const credited=await pool.query("INSERT INTO coin_transactions(consumer_id,tipo,quantidade,motivo) SELECT $1,'ganho',$2,$3 WHERE NOT EXISTS(SELECT 1 FROM coin_transactions WHERE consumer_id=$1 AND motivo=$3) RETURNING id",[order.consumer_id,coins,reason]);if(credited.rows[0])await pool.query("UPDATE consumers SET saldo_moedas=saldo_moedas+$2 WHERE id=$1",[order.consumer_id,coins])}}
  await pool.query("UPDATE praca_post_payment_jobs SET status='done',completed_at=now(),last_error=NULL,updated_at=now() WHERE order_id=$1",[orderId]);
 }catch(error){await pool.query("UPDATE praca_post_payment_jobs SET status='failed',last_error=$2,updated_at=now() WHERE order_id=$1",[orderId,error instanceof Error?error.message:"unknown"]);throw error}
}