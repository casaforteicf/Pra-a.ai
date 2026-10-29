import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import { subordersEnabled } from "../lib/suborders";
import { acceptedValue } from "../lib/suborderAmounts";
const router:IRouter=Router();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const paid=(value:string)=>value==="paid";
function enabled(res:any){if(subordersEnabled())return true;res.status(404).json({error:"Recurso indisponível."});return false}
function buyer(req:any){const n=Number(req.session?.consumerId);return Number.isSafeInteger(n)&&n>0?n:null}
function vendor(req:any,res:any):string|null{
 const wanted=Buffer.from(process.env.PRACA_ROUNDS_VENDOR_TOKEN??""),given=Buffer.from(req.header("x-praca-rounds-token")??"");
 if(wanted.length<32||wanted.length!==given.length||!timingSafeEqual(wanted,given)){res.status(401).json({error:"Integração não autorizada."});return null}
 const id=req.method==="GET"?req.query.tenantId:req.body?.tenantId;
 if(typeof id!=="string"||!id.trim()){res.status(422).json({error:"Loja inválida."});return null}return id.trim();
}
function image(value:unknown){
 if(typeof value!=="string"||value.length>1000000)return null;
 const m=/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!m)return null;
 const bytes=Buffer.from(m[2],"base64");
 if(bytes.length<16||bytes.length>700000)return null;
 if(m[1]==="jpeg"?!bytes.subarray(0,3).equals(Buffer.from([255,216,255])):!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
 return {data:bytes.toString("base64"),mime:"image/"+m[1]};
}
async function locked(client:any,id:string,owner:string|number,isVendor:boolean){
 // Sempre trava o pedido mestre antes do subpedido.
 const parent=await client.query("SELECT o.id,o.payment_status,o.status,o.consumer_id FROM orders o JOIN praca_suborders s ON s.order_id=o.id WHERE s.id=$1 AND "+(isVendor?"s.vendor_id":"o.consumer_id")+"=$2 FOR UPDATE OF o",[id,owner]);
 if(!parent.rows[0])return null;
 const s=await client.query("SELECT * FROM praca_suborders WHERE id=$1 FOR UPDATE",[id]);
 return {...s.rows[0],payment_status:parent.rows[0].payment_status,parent_status:parent.rows[0].status};
}
async function hasDispute(client:any,orderId:number){
 const r=await client.query("SELECT 1 FROM disputes WHERE order_id=$1 AND status NOT IN ('resolved','closed','resolvida','rejeitada') LIMIT 1",[orderId]);return !!r.rows.length;
}
async function lines(client:any,id:string){
 return (await client.query(`SELECT i.id,i.quantity,i.net_cents,oi.product_name,oi.product_image_url,
 COALESCE((SELECT sum(ri.quantity) FROM praca_suborder_receipt_items ri JOIN praca_suborder_receipts r ON r.id=ri.receipt_id WHERE ri.suborder_item_id=i.id AND r.status='accepted'),0)::integer AS accepted,
 COALESCE((SELECT sum(ri.quantity) FROM praca_suborder_receipt_items ri JOIN praca_suborder_receipts r ON r.id=ri.receipt_id WHERE ri.suborder_item_id=i.id AND r.status IN ('reported','accepted')),0)::integer AS reserved
 FROM praca_suborder_items i JOIN order_items oi ON oi.id=i.order_item_id WHERE i.suborder_id=$1 ORDER BY i.order_item_id`,[id])).rows;
}
async function present(client:any,s:any){
 const items=await lines(client,s.id);
 const nsu=process.env.PRACA_NSU_AUDIT_ENABLED==="true"?(await client.query("SELECT n.master_nsu,l.movement_nsu FROM praca_negotiation_links l JOIN praca_negotiations n ON n.id=l.master_id WHERE l.entity_type=\'praca_suborders\' AND l.entity_id=$1",[s.id])).rows[0]:null;
 const receipts=await client.query("SELECT id,status,reported_at,accepted_at,release_cents,release_status FROM praca_suborder_receipts WHERE suborder_id=$1 ORDER BY reported_at",[s.id]);
 const ri=await client.query("SELECT ri.receipt_id,ri.suborder_item_id,ri.quantity FROM praca_suborder_receipt_items ri JOIN praca_suborder_receipts r ON r.id=ri.receipt_id WHERE r.suborder_id=$1",[s.id]);
 return {buyer:s.vendor_view?{name:s.buyer_name??null,phone:s.buyer_phone??null,address:s.delivery_address??null}:undefined,masterNsu:nsu?.master_nsu??null,movementNsu:nsu?.movement_nsu??null,id:s.id,orderId:s.order_id,status:s.status,paymentStatus:s.payment_status,subtotal:Number(s.subtotal_cents)/100,freight:Number(s.freight_cents)/100,discount:Number(s.discount_cents)/100,total:Number(s.total_cents)/100,
 items:items.map((i:any)=>({id:i.id,name:i.product_name,imageUrl:i.product_image_url,quantity:i.quantity,accepted:i.accepted,pending:i.reserved-i.accepted})),
 receipts:receipts.rows.map((r:any)=>({id:r.id,status:r.status,reportedAt:r.reported_at,acceptedAt:r.accepted_at,amount:Number(r.release_cents)/100,releaseStatus:r.release_status,items:ri.rows.filter((l:any)=>l.receipt_id===r.id).map((l:any)=>({itemId:l.suborder_item_id,quantity:l.quantity}))}))};
}
router.get("/orders/:id/suborders",async(req,res):Promise<void>=>{
 if(!enabled(res))return;const consumer=buyer(req);if(!consumer)return void res.status(401).json({error:"Entre na sua conta."});
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)return void res.status(422).json({error:"Pedido inválido."});
 try{
 const found=await pool.query("SELECT s.*,o.payment_status FROM praca_suborders s JOIN orders o ON o.id=s.order_id WHERE o.id=$1 AND o.consumer_id=$2 ORDER BY s.vendor_id",[id,consumer]);
 res.set("Cache-Control","private, no-store").json(await Promise.all(found.rows.map((s:any)=>present(pool,s))));
 }catch{res.status(503).json({error:"Não foi possível consultar os pedidos por loja."})}
});
router.get("/internal/vendor-suborders",async(req,res):Promise<void>=>{
 if(!enabled(res))return;const tenant=vendor(req,res);if(!tenant)return;
 try{
 const found=await pool.query("SELECT s.*,o.payment_status,true AS vendor_view,COALESCE(c.name,o.guest_name) AS buyer_name,COALESCE(c.phone,o.guest_phone) AS buyer_phone,o.delivery_address FROM praca_suborders s JOIN orders o ON o.id=s.order_id LEFT JOIN consumers c ON c.id=o.consumer_id WHERE s.vendor_id=$1 AND o.payment_status='paid' ORDER BY s.created_at DESC LIMIT 100",[tenant]);
 res.set("Cache-Control","private, no-store").json(await Promise.all(found.rows.map((s:any)=>present(pool,s))));
 }catch{res.status(503).json({error:"Não foi possível consultar os pedidos da loja."})}
});
router.post("/internal/vendor-suborders/:id/receipts",async(req,res):Promise<void>=>{
 if(!enabled(res))return;const tenant=vendor(req,res);if(!tenant)return;
 const id=String(req.params.id),proof=image(req.body?.photo),receivedBy=typeof req.body?.receivedBy==="string"?req.body.receivedBy.trim():"";
 const requested=req.body?.items,requestKey=String(req.body?.requestKey??"");
 if(!UUID.test(requestKey)||!UUID.test(id)||!proof||receivedBy.length<2||receivedBy.length>120||!Array.isArray(requested)||!requested.length||requested.length>100||requested.some((l:any)=>!UUID.test(l?.itemId)||!Number.isSafeInteger(l.quantity)||l.quantity<=0)||new Set(requested.map((l:any)=>l.itemId)).size!==requested.length)return void res.status(422).json({error:"Informe foto, recebedor e quantidades válidas."});
 const c=await pool.connect();
 try{
 await c.query("BEGIN");const s=await locked(c,id,tenant,true);
 if(!s){await c.query("ROLLBACK");return void res.status(404).json({error:"Pedido não encontrado."})}
 if(!paid(s.payment_status)||s.parent_status==="cancelled"||s.status==="delivered"||await hasDispute(c,s.order_id)){await c.query("ROLLBACK");return void res.status(409).json({error:"Pedido bloqueado para entrega."})}
 const previous=await c.query("SELECT id,status FROM praca_suborder_receipts WHERE suborder_id=$1 AND request_key=$2",[id,requestKey]);
 if(previous.rows[0]){await c.query("COMMIT");return void res.json({...previous.rows[0],duplicate:true})}
 const all=await lines(c,id);
 if(requested.some((r:any)=>{const l=all.find((i:any)=>i.id===r.itemId);return !l||l.reserved+r.quantity>l.quantity})){await c.query("ROLLBACK");return void res.status(409).json({error:"Quantidade superior ao saldo disponível."})}
 const saved=await c.query("INSERT INTO praca_suborder_receipts(suborder_id,received_by,photo,photo_mime,request_key) VALUES($1,$2,$3,$4,$5) RETURNING id",[id,receivedBy,proof.data,proof.mime,requestKey]);
 for(const l of requested)await c.query("INSERT INTO praca_suborder_receipt_items(receipt_id,suborder_item_id,quantity) VALUES($1,$2,$3)",[saved.rows[0].id,l.itemId,l.quantity]);
 await c.query("UPDATE praca_suborders SET status=CASE WHEN status='preparing' THEN 'shipped' ELSE status END WHERE id=$1",[id]);
 await c.query("INSERT INTO praca_suborder_events(suborder_id,actor_type,actor_id,status) VALUES($1,'vendor',$2,'delivery_reported')",[id,tenant]);
 await c.query("COMMIT");res.status(201).json({id:saved.rows[0].id,status:"reported"});
 }catch{await c.query("ROLLBACK").catch(()=>undefined);res.status(503).json({error:"Não foi possível registrar a entrega."})}finally{c.release()}
});
router.get("/suborders/:id/receipts/:receiptId/photo",async(req,res):Promise<void>=>{
 if(!enabled(res))return;const consumer=buyer(req);if(!consumer)return void res.status(401).end();
 if(!UUID.test(String(req.params.id))||!UUID.test(String(req.params.receiptId)))return void res.status(422).end();
 try{
 const found=await pool.query("SELECT r.photo,r.photo_mime FROM praca_suborder_receipts r JOIN praca_suborders s ON s.id=r.suborder_id JOIN orders o ON o.id=s.order_id WHERE s.id=$1 AND r.id=$2 AND o.consumer_id=$3 AND o.payment_status='paid'",[req.params.id,req.params.receiptId,consumer]);
 if(!found.rows[0])return void res.status(404).end();
 res.set("Cache-Control","private, no-store").set("X-Content-Type-Options","nosniff").type(found.rows[0].photo_mime).send(Buffer.from(found.rows[0].photo,"base64"));
 }catch{res.status(503).end()}
});
router.post("/suborders/:id/receipts/:receiptId/answer",async(req,res):Promise<void>=>{
 if(!enabled(res))return;const consumer=buyer(req);if(!consumer)return void res.status(401).json({error:"Entre na sua conta."});
 const id=String(req.params.id),rid=String(req.params.receiptId),accept=req.body?.accept,reason=typeof req.body?.reason==="string"?req.body.reason.trim():"";
 if(!UUID.test(id)||!UUID.test(rid)||typeof accept!=="boolean"||(accept&&req.body?.quantitiesChecked!==true)||(!accept&&(reason.length<5||reason.length>1000)))return void res.status(422).json({error:"Confira as quantidades ou informe o motivo da divergência."});
 const c=await pool.connect();
 try{
 await c.query("BEGIN");const s=await locked(c,id,consumer,false);
 if(!s){await c.query("ROLLBACK");return void res.status(404).json({error:"Pedido não encontrado."})}
 if(!paid(s.payment_status)||s.parent_status==="cancelled"||await hasDispute(c,s.order_id)){await c.query("ROLLBACK");return void res.status(409).json({error:"Pedido bloqueado para confirmação."})}
 const receipt=await c.query("SELECT status FROM praca_suborder_receipts WHERE id=$1 AND suborder_id=$2 FOR UPDATE",[rid,id]);
 if(!receipt.rows[0]){await c.query("ROLLBACK");return void res.status(404).json({error:"Comprovante não encontrado."})}
 if(receipt.rows[0].status!=="reported"){await c.query("COMMIT");return void res.json({status:receipt.rows[0].status,duplicate:true})}
 const all=await lines(c,id),received=(await c.query("SELECT suborder_item_id,quantity FROM praca_suborder_receipt_items WHERE receipt_id=$1",[rid])).rows;
 let amount=0,complete=false;
 if(accept){
  for(const r of received){const l=all.find((i:any)=>i.id===r.suborder_item_id);if(!l)throw new Error("Item inválido");amount+=acceptedValue(Number(l.net_cents),l.quantity,l.accepted,r.quantity)}
  complete=all.every((l:any)=>l.accepted+(received.find((r:any)=>r.suborder_item_id===l.id)?.quantity??0)===l.quantity);
  if(complete)amount+=Number(s.freight_net_cents);
 }
 await c.query("UPDATE praca_suborder_receipts SET status=$3,buyer_reason=$4,accepted_at=CASE WHEN $5 THEN now() ELSE NULL END,release_cents=$6 WHERE id=$1 AND suborder_id=$2",[rid,id,accept?"accepted":"rejected",accept?null:reason,accept,amount]);
 if(accept)await c.query("UPDATE praca_suborders SET status=$2 WHERE id=$1",[id,complete?"delivered":"partially_delivered"]);
 await c.query("INSERT INTO praca_suborder_events(suborder_id,actor_type,actor_id,status) VALUES($1,'buyer',$2,$3)",[id,String(consumer),accept?"receipt_accepted":"receipt_rejected"]);
 await c.query("COMMIT");res.json({status:accept?"accepted":"rejected",amount:amount/100,releaseStatus:"blocked_provider"});
 }catch{await c.query("ROLLBACK").catch(()=>undefined);res.status(503).json({error:"Não foi possível registrar a confirmação."})}finally{c.release()}
});

router.get("/internal/vendor-suborders/:id/history",async(req,res):Promise<void>=>{
 if(!enabled(res))return;const tenant=vendor(req,res);if(!tenant)return;
 const id=String(req.params.id),after=typeof req.query.after==="string"?req.query.after:"0";
 if(!UUID.test(id)||!/^[0-9]{1,18}$/.test(after))return void res.status(422).json({error:"Consulta inválida."});
 if(process.env.PRACA_NSU_AUDIT_ENABLED!=="true")return void res.status(503).json({error:"Histórico NSU em homologação."});
 try{
 const owned=await pool.query("SELECT s.id FROM praca_suborders s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 AND s.vendor_id=$2 AND o.payment_status='paid'",[id,tenant]);
 if(!owned.rows[0])return void res.status(404).json({error:"Pedido não encontrado."});
 const linked=await pool.query("SELECT n.id,n.master_nsu,l.movement_nsu FROM praca_negotiation_links l JOIN praca_negotiations n ON n.id=l.master_id WHERE l.entity_type='praca_suborders' AND l.entity_id=$1",[id]);
 const root=linked.rows[0];if(!root)return void res.status(404).json({error:"Pedido sem NSU."});
 const result=await pool.query("SELECT e.sequence::text,e.entity_type,e.operation,e.occurred_at,e.after_data->>'status' AS status FROM praca_negotiation_events e JOIN praca_negotiation_links l ON l.entity_type=e.entity_type AND l.entity_id=e.entity_id WHERE e.master_id=$1 AND l.vendor_id=$2 AND e.sequence>$3::bigint AND e.entity_type=ANY($4::text[]) ORDER BY e.sequence LIMIT 101",[root.id,tenant,after,["praca_suborders","praca_suborder_receipts","praca_suborder_events"]]);
 const page=result.rows.slice(0,100);res.set("Cache-Control","private, no-store").json({masterNsu:root.master_nsu,movementNsu:root.movement_nsu,events:page,nextCursor:result.rows.length>100?page[page.length-1].sequence:null});
 }catch{res.status(503).json({error:"Não foi possível consultar o histórico."})}
});
export default router;
