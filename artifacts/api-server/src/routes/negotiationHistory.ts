import {Router,type IRouter} from "express";
import {pool} from "@workspace/db";
import {timingSafeEqual} from "node:crypto";
const router:IRouter=Router();
router.get("/negotiations/:type/:id/history",async(req,res):Promise<void>=>{
 const consumer=Number(req.session?.consumerId),type=String(req.params.type),id=String(req.params.id);
 if(!Number.isSafeInteger(consumer)||consumer<=0)return void res.status(401).json({error:"Entre na sua conta."});
 if(process.env.PRACA_NSU_AUDIT_ENABLED!=="true")return void res.status(503).json({error:"Histórico NSU em homologação."});
 if(!["quote","round","marketplace"].includes(type)||!(type==="marketplace"?/^[1-9][0-9]{0,15}$/:/^[0-9a-f-]{36}$/i).test(id))return void res.status(422).json({error:"Pedido inválido."});
 const after=typeof req.query.after==="string"?req.query.after:"0";
 if(!/^[0-9]{1,18}$/.test(after))return void res.status(422).json({error:"Página inválida."});
 try{
  const own=type==="quote"?await pool.query("SELECT id FROM quote_requests WHERE id=$1 AND consumer_id=$2",[id,consumer]):
   type==="round"?await pool.query("SELECT o.id FROM buying_round_orders o JOIN buying_round_participants p ON p.id=o.participant_id WHERE o.id=$1 AND p.consumer_id=$2",[id,consumer]):
   await pool.query("SELECT id FROM orders WHERE id=$1 AND consumer_id=$2",[id,consumer]);
  if(!own.rows[0])return void res.status(404).json({error:"Negociação não encontrada."});
  const entity=type==="quote"?"quote_requests":type==="round"?"buying_round_orders":"orders";
  const linked=await pool.query("SELECT n.id,n.master_nsu,l.movement_nsu FROM praca_negotiation_links l JOIN praca_negotiations n ON n.id=l.master_id WHERE l.entity_type=$1 AND l.entity_id=$2",[entity,id]);
  if(!linked.rows[0])return void res.status(404).json({error:"Negociação ainda não vinculada ao NSU."});
  const root=linked.rows[0];
  // Comprador só recebe o escopo de seu pedido; não recebe fornecedores,
  // preços de concorrentes, outros participantes, notas internas ou dados financeiros.
  const events=await pool.query(
   `SELECT e.sequence::text,e.operation,e.entity_type,e.occurred_at,e.recorded_at,
      CASE WHEN e.entity_type IN ('quote_requests','buying_round_orders','orders','praca_order_disputes','praca_order_cancellations')
       THEN e.after_data->>'status' ELSE NULL END AS status
    FROM praca_negotiation_events e JOIN praca_negotiation_links l ON l.entity_type=e.entity_type AND l.entity_id=e.entity_id
    WHERE e.master_id=$1 AND l.scope_type=$2 AND l.scope_id=$3 AND e.sequence>$4::bigint
      AND e.entity_type=ANY($5::text[]) ORDER BY e.sequence LIMIT 101`,
    [root.id,type,id,after,["quote_requests","buying_round_orders","orders","praca_marketplace_fulfillment_events","praca_marketplace_fulfillments","praca_delivery_acceptances","praca_order_disputes","praca_order_cancellations"]]);
  const page=events.rows.slice(0,100);
  res.set("Cache-Control","no-store").json({masterNsu:root.master_nsu,movementNsu:root.movement_nsu,events:page,nextCursor:events.rows.length>100?page[page.length-1].sequence:null});
 }catch{res.status(500).json({error:"Não foi possível carregar o histórico."})}
});

router.get("/internal/vendor-orders/:type/:id/history",async(req,res):Promise<void>=>{
 const expected=Buffer.from(process.env.PRACA_ROUNDS_VENDOR_TOKEN??""),supplied=Buffer.from(req.header("x-praca-rounds-token")??"");
 if(expected.length<32||supplied.length!==expected.length||!timingSafeEqual(expected,supplied))return void res.status(401).json({error:"Integração não autorizada."});
 if(process.env.PRACA_NSU_AUDIT_ENABLED!=="true")return void res.status(503).json({error:"Histórico NSU em homologação."});
 const type=String(req.params.type),id=String(req.params.id),vendor=typeof req.query.tenantId==="string"?req.query.tenantId:"",after=typeof req.query.after==="string"?req.query.after:"0";
 if(!["quote","round"].includes(type)||!/^[0-9a-f-]{36}$/i.test(id)||!vendor||!/^[0-9]{1,18}$/.test(after))return void res.status(422).json({error:"Pedido ou página inválidos."});
 try{
 const owned=type==="quote"?await pool.query("SELECT q.id FROM quote_requests q JOIN quote_offers o ON o.quote_request_id=q.id AND o.status='aceita' WHERE q.id=$1 AND o.vendor_id=$2 AND q.status IN ('paid','delivered','released')",[id,vendor]):
 await pool.query("SELECT id FROM buying_round_orders WHERE id=$1 AND vendor_id=$2 AND status IN ('paid','delivered','released')",[id,vendor]);
 if(!owned.rows[0])return void res.status(404).json({error:"Pedido pago não encontrado."});
 const entity=type==="quote"?"quote_requests":"buying_round_orders";
 const roots=await pool.query("SELECT n.id,n.master_nsu,l.movement_nsu FROM praca_negotiation_links l JOIN praca_negotiations n ON n.id=l.master_id WHERE l.entity_type=$1 AND l.entity_id=$2",[entity,id]);
 if(!roots.rows[0])return void res.status(404).json({error:"Pedido ainda não vinculado ao NSU."});
 const root=roots.rows[0];
 const result=await pool.query(`SELECT e.sequence::text,e.operation,e.entity_type,e.occurred_at,e.recorded_at,e.after_data->>'status' AS status
 FROM praca_negotiation_events e JOIN praca_negotiation_links l ON l.entity_type=e.entity_type AND l.entity_id=e.entity_id
 WHERE e.master_id=$1 AND l.scope_type=$2 AND l.scope_id=$3 AND e.sequence>$4::bigint
 AND (l.vendor_id=$5 OR e.entity_type=$6)
 AND e.entity_type=ANY($7::text[]) ORDER BY e.sequence LIMIT 101`,
 [root.id,type,id,after,vendor,entity,["quote_requests","buying_round_orders","praca_marketplace_fulfillments","praca_marketplace_fulfillment_events","praca_delivery_acceptances","praca_order_disputes","praca_order_cancellations"]]);
 const page=result.rows.slice(0,100);
 res.set("Cache-Control","no-store").json({masterNsu:root.master_nsu,movementNsu:root.movement_nsu,events:page,nextCursor:result.rows.length>100?page[page.length-1].sequence:null});
 }catch{res.status(500).json({error:"Não foi possível carregar histórico da loja."})}
});

export default router;
