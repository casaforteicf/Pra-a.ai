import { Router, type IRouter } from "express";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import { vendorPool } from "../lib/vendorDb";
import { sendChatMessage } from "../lib/vendorSyncService";

const router: IRouter = Router();
const CONTACT_PATTERN = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){10,})/i;

function buyerId(req: any): number | null {
  const id = Number(req.session?.consumerId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function authorizedVendor(req: any, res: any): boolean {
  const expected = process.env.PRACA_ROUNDS_VENDOR_TOKEN;
  const supplied = req.header("x-praca-rounds-token");
  if (!expected) { res.status(503).json({ error: "Integração de rodadas indisponível." }); return false; }
  if (typeof supplied !== "string") { res.status(401).json({ error: "Acesso não autorizado." }); return false; }
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(401).json({ error: "Acesso não autorizado." }); return false; }
  return true;
}

async function ensureRoundLead(params: { roundId: string; vendorId: string; code: string; demand: string; buyer?: { name: string; email: string | null; phone: string | null } }): Promise<string> {
  const mapClient = await pool.connect();
  let leadId = "";
  let notified = false;
  try {
    await mapClient.query("BEGIN");
    await mapClient.query("SELECT pg_advisory_xact_lock(hashtext($1))", [params.roundId + ":" + params.vendorId]);
    const existing = await mapClient.query(
      "SELECT crm_lead_id,crm_notified FROM buying_round_vendor_leads WHERE round_id=$1 AND vendor_id=$2",
      [params.roundId, params.vendorId],
    );
    leadId = existing.rows[0]?.crm_lead_id as string | undefined ?? "";
    notified = Boolean(existing.rows[0]?.crm_notified);
    if (!leadId) {
      leadId = randomUUID();
      await vendorPool.query(
        "INSERT INTO leads(id,tenant_id,nome,telefone,email,endereco,source,status,tipo) VALUES($1,$2,$3,NULL,NULL,NULL,'praca_ai_rodada','novo','cliente')",
        [leadId, params.vendorId, "Demanda anônima Praça.ai · " + params.code],
      );
      await mapClient.query(
        "INSERT INTO buying_round_vendor_leads(round_id,vendor_id,crm_lead_id) VALUES($1,$2,$3)",
        [params.roundId, params.vendorId, leadId],
      );
    }
    await mapClient.query("COMMIT");
  } catch (error) {
    await mapClient.query("ROLLBACK");
    throw error;
  } finally { mapClient.release(); }

  if (params.buyer) {
    await vendorPool.query(
      "UPDATE leads SET nome=$3,telefone=$4,email=$5,source='praca_ai_rodada' WHERE id=$1 AND tenant_id=$2",
      [leadId, params.vendorId, params.buyer.name, params.buyer.phone, params.buyer.email],
    );
    await pool.query(
      "UPDATE buying_round_vendor_leads SET identity_revealed_at=COALESCE(identity_revealed_at,now()) WHERE round_id=$1 AND vendor_id=$2",
      [params.roundId, params.vendorId],
    );
    await sendChatMessage({
      tenantId: params.vendorId, leadId,
      conteudo: "Praça.ai — sua oferta foi selecionada e o comprador aceitou. Cliente: " + params.buyer.name +
        (params.buyer.phone ? " · Telefone: " + params.buyer.phone : "") +
        (params.buyer.email ? " · E-mail: " + params.buyer.email : "") + ". " + params.demand,
    });
    await pool.query("UPDATE buying_round_vendor_leads SET crm_notified=true WHERE round_id=$1 AND vendor_id=$2", [params.roundId, params.vendorId]);
  } else if (!notified) {
    await sendChatMessage({
      tenantId: params.vendorId, leadId,
      conteudo: "Praça.ai — novo lead anônimo de rodada. " + params.demand +
        " Identificação e contato do comprador serão liberados somente depois que ele aceitar a oferta vencedora.",
    });
    await pool.query(
      "UPDATE buying_round_vendor_leads SET crm_notified=true WHERE round_id=$1 AND vendor_id=$2",
      [params.roundId, params.vendorId],
    );
  }
  return leadId;
}
function qty(value: unknown): number | null {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? n : null;
}
function containsContact(value: unknown): boolean {
  return typeof value === "string" && CONTACT_PATTERN.test(value);
}
async function closeExpired(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const expired = await client.query("SELECT id FROM buying_rounds WHERE status='open' AND closes_at<=now() ORDER BY closes_at FOR UPDATE SKIP LOCKED LIMIT 50");
    for (const row of expired.rows) {
      const participants = await client.query("SELECT COALESCE(sum(quantity),0)::numeric AS total FROM buying_round_participants WHERE round_id=$1",[row.id]);
      const total = Number(participants.rows[0]?.total ?? 0);
      const best = total > 0 ? await client.query(
        "SELECT id,vendor_id,unit_price::numeric,freight_total::numeric FROM buying_round_bids WHERE round_id=$1 ORDER BY unit_price + freight_total / $2 ASC,updated_at ASC LIMIT 1",
        [row.id,total],
      ) : { rows: [] as any[] };
      if (!best.rows[0]) {
        await client.query("UPDATE buying_rounds SET status='no_offers',closed_at=now() WHERE id=$1",[row.id]);
        continue;
      }
      const bid = best.rows[0];
      await client.query(
        "INSERT INTO buying_round_orders(round_id,participant_id,bid_id,vendor_id,quantity,total) SELECT p.round_id,p.id,$2,$3,p.quantity,round(($4::numeric*p.quantity+$5::numeric*p.quantity/$6::numeric),2) FROM buying_round_participants p WHERE p.round_id=$1 ON CONFLICT(participant_id) DO NOTHING",
        [row.id,bid.id,bid.vendor_id,bid.unit_price,bid.freight_total,total],
      );
      await client.query("UPDATE buying_rounds SET status='closed',winning_bid_id=$2,closed_at=now() WHERE id=$1",[row.id,bid.id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
}

// The API is a long-running Express service. A small unref'ed worker closes
// rounds on their deadline even when no buyer or seller is viewing the page.
// Row locks with SKIP LOCKED make this safe across multiple API instances.
const roundWorkerHost = globalThis as typeof globalThis & { __pracaAiRoundCloser?: ReturnType<typeof setInterval> };
if (!roundWorkerHost.__pracaAiRoundCloser) {
  roundWorkerHost.__pracaAiRoundCloser = setInterval(() => {
    void closeExpired().catch((error) => console.error("[rounds] scheduled close failed:", error));
  }, 30_000);
  roundWorkerHost.__pracaAiRoundCloser.unref?.();
}

router.get("/rounds", async (req,res):Promise<void>=>{
  try {
    await closeExpired();
    const category=typeof req.query.category==="string"?req.query.category.slice(0,120):null;
    const result=await pool.query(
      "SELECT r.id,r.code,r.category,r.item_name,r.specification,r.unit,r.city,r.state,r.needed_at,r.closes_at,COALESCE(sum(p.quantity),0)::text AS total_quantity FROM buying_rounds r LEFT JOIN buying_round_participants p ON p.round_id=r.id WHERE r.status='open' AND r.closes_at>now() AND ($1::text IS NULL OR lower(r.category)=lower($1)) GROUP BY r.id ORDER BY r.closes_at ASC LIMIT 100",
      [category],
    );
    res.json(result.rows.map((r:any)=>({id:r.id,code:r.code,category:r.category,itemName:r.item_name,specification:r.specification,unit:r.unit,city:r.city,state:r.state,neededAt:r.needed_at,closesAt:r.closes_at,totalQuantity:Number(r.total_quantity)})));
  } catch(error) {
    console.error("[rounds] list failed:",error); res.status(500).json({error:"Não foi possível carregar as rodadas agora."});
  }
});

router.post("/rounds",async(req,res):Promise<void>=>{
  const consumer=buyerId(req);
  if(!consumer) return void res.status(401).json({error:"Entre na sua conta para participar."});
  const body=req.body??{};
  const category=String(body.category??"").trim().slice(0,120);
  const item=String(body.itemName??"").trim().slice(0,200);
  const spec=String(body.specification??"").trim().slice(0,500);
  const unit=String(body.unit??"").trim().slice(0,30);
  const city=String(body.city??"").trim().slice(0,100);
  const state=String(body.state??"").trim().toUpperCase().slice(0,2);
  const quantity=qty(body.quantity);
  const needed=typeof body.neededAt==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(body.neededAt)?body.neededAt:"";
  if(!category||!item||!unit||!city||state.length!==2||!quantity||!needed) return void res.status(422).json({error:"Informe material, unidade, quantidade, cidade, estado e data necessária."});
  if([category,item,spec,city].some(containsContact)) return void res.status(422).json({error:"Não inclua telefone ou e-mail nos dados do lote."});
  const neededDate=new Date(needed+"T12:00:00Z"),today=new Date(); today.setUTCHours(0,0,0,0);
  if(Number.isNaN(neededDate.getTime())||neededDate.getTime()<Date.now()+48*60*60*1000||neededDate.getTime()>Date.now()+366*86400000) return void res.status(422).json({error:"Escolha uma data válida para receber o material."});
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const matchKey=JSON.stringify([category.toLowerCase(),item.toLowerCase(),spec.toLowerCase(),unit.toLowerCase(),city.toLowerCase(),state,needed]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[matchKey]);
    const found=await client.query("SELECT id,code,closes_at FROM buying_rounds WHERE status='open' AND closes_at>now() AND lower(category)=lower($1) AND lower(item_name)=lower($2) AND lower(COALESCE(specification,''))=lower($3) AND lower(unit)=lower($4) AND lower(city)=lower($5) AND state=$6 AND needed_at=$7::date ORDER BY created_at LIMIT 1 FOR UPDATE",[category,item,spec,unit,city,state,needed]);
    let round=found.rows[0],created=false;
    if(!round){
      const code="ROD-"+new Date().getFullYear()+"-"+randomBytes(3).toString("hex").toUpperCase();
      const inserted=await client.query("INSERT INTO buying_rounds(code,category,item_name,specification,unit,city,state,needed_at,closes_at,created_by_consumer_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8::date,now()+interval '48 hours',$9) RETURNING id,code,closes_at",[code,category,item,spec||null,unit,city,state,needed,consumer]);
      round=inserted.rows[0]; created=true;
    }
    const participant=await client.query("INSERT INTO buying_round_participants(round_id,consumer_id,quantity) VALUES($1,$2,$3) ON CONFLICT(round_id,consumer_id) DO NOTHING RETURNING id",[round.id,consumer,quantity]);
    if(!participant.rows[0]) { await client.query("ROLLBACK"); return void res.status(409).json({error:"Você já participa deste lote. Acompanhe em Minhas rodadas."}); }
    await client.query("COMMIT");
    res.status(201).json({roundId:round.id,code:round.code,closesAt:round.closes_at,created});
  } catch(error) {
    await client.query("ROLLBACK"); console.error("[rounds] create failed:",error); res.status(500).json({error:"Não foi possível registrar sua demanda agora."});
  } finally { client.release(); }
});

router.post("/rounds/:id/participations",async(req,res):Promise<void>=>{
  const consumer=buyerId(req);
  if(!consumer) return void res.status(401).json({error:"Entre na sua conta para participar."});
  const quantity=qty(req.body?.quantity);
  if(!quantity) return void res.status(422).json({error:"Informe uma quantidade válida."});
  try {
    const active=await pool.query("SELECT id FROM buying_rounds WHERE id=$1 AND status='open' AND closes_at>now()",[req.params.id]);
    if(!active.rows[0]) return void res.status(404).json({error:"Este lote não está mais aberto."});
    const joined=await pool.query("INSERT INTO buying_round_participants(round_id,consumer_id,quantity) VALUES($1,$2,$3) ON CONFLICT(round_id,consumer_id) DO NOTHING RETURNING id",[req.params.id,consumer,quantity]);
    if(!joined.rows[0]) return void res.status(409).json({error:"Você já participa deste lote."});
    res.status(201).json({participationId:joined.rows[0].id,roundId:req.params.id});
  } catch(error) {
    console.error("[rounds] join failed:",error); res.status(500).json({error:"Não foi possível registrar sua participação."});
  }
});

router.get("/round-orders",async(req,res):Promise<void>=>{
  const consumer=buyerId(req);
  if(!consumer) return void res.status(401).json({error:"Entre na sua conta para acompanhar suas rodadas."});
  try {
    await closeExpired();
    const result=await pool.query("SELECT COALESCE(o.id,p.id) AS id,COALESCE(o.status,CASE WHEN r.status='no_offers' THEN 'no_offers' WHEN r.status='open' THEN 'participating' ELSE 'closed' END) AS status,p.quantity::text,o.total::text,o.accepted_at,o.vendor_id,r.code,r.category,r.item_name,r.specification,r.unit,r.needed_at FROM buying_round_participants p JOIN buying_rounds r ON r.id=p.round_id LEFT JOIN buying_round_orders o ON o.participant_id=p.id WHERE p.consumer_id=$1 ORDER BY p.joined_at DESC",[consumer]);
    const response=[];
    for(const row of result.rows){
      let vendor=null;
      if(row.status==="awaiting_payment"||row.status==="paid"){
        const store=await vendorPool.query("SELECT id,nome_empresa FROM tenants WHERE id=$1 AND vende_no_praca_ai=true",[row.vendor_id]);
        if(store.rows[0]) vendor={id:store.rows[0].id,name:store.rows[0].nome_empresa,storeUrl:"/listing?vendorId="+encodeURIComponent(String(store.rows[0].id))};
      }
      response.push({id:row.id,status:row.status,quantity:Number(row.quantity),total:row.total===null?null:Number(row.total),acceptedAt:row.accepted_at,code:row.code,category:row.category,itemName:row.item_name,specification:row.specification,unit:row.unit,neededAt:row.needed_at,vendor});
    }
    res.json(response);
  } catch(error) {
    console.error("[rounds] orders failed:",error); res.status(500).json({error:"Não foi possível carregar seus pedidos de rodada."});
  }
});

router.post("/round-orders/:id/accept",async(req,res):Promise<void>=>{
  const consumer=buyerId(req);
  if(!consumer) return void res.status(401).json({error:"Entre na sua conta para aceitar a proposta."});
  const client=await pool.connect();
  let order:any;
  try {
    await client.query("BEGIN");
    const found=await client.query("SELECT o.id,o.status,o.round_id,o.vendor_id,o.quantity::text,o.total::text,r.code,r.item_name,r.unit,p.consumer_id FROM buying_round_orders o JOIN buying_rounds r ON r.id=o.round_id JOIN buying_round_participants p ON p.id=o.participant_id WHERE o.id=$1 FOR UPDATE OF o",[req.params.id]);
    order=found.rows[0];
    if(!order||Number(order.consumer_id)!==consumer){await client.query("ROLLBACK");return void res.status(404).json({error:"Proposta não encontrada."});}
    if(order.status==="awaiting_buyer"){
      await client.query("UPDATE buying_round_orders SET status='awaiting_payment',accepted_at=now() WHERE id=$1",[order.id]);
    } else if(order.status!=="awaiting_payment"){
      await client.query("ROLLBACK");return void res.status(409).json({error:"Esta proposta não está mais disponível."});
    }
    await client.query("COMMIT");
  } catch(error) {
    await client.query("ROLLBACK"); console.error("[rounds] accept failed:",error); return void res.status(500).json({error:"Não foi possível aceitar a proposta agora."});
  } finally { client.release(); }

  try {
    const [buyer,store]=await Promise.all([
      pool.query("SELECT name,email,phone FROM consumers WHERE id=$1",[consumer]),
      vendorPool.query("SELECT id,nome_empresa FROM tenants WHERE id=$1 AND vende_no_praca_ai=true",[order.vendor_id]),
    ]);
    const customer=buyer.rows[0],seller=store.rows[0];
    if(!customer||!seller){await pool.query("UPDATE buying_round_orders SET crm_sync_status='failed' WHERE id=$1",[order.id]);return void res.status(202).json({id:order.id,status:"awaiting_payment",total:Number(order.total),paymentStatus:"Aceitação registrada; a loja será conectada para formalizar o pagamento."});}
    const leadId=await ensureRoundLead({
      roundId:String(order.round_id), vendorId:String(order.vendor_id), code:String(order.code),
      demand:String(order.quantity)+" "+String(order.unit)+" de "+String(order.item_name)+". Total: R$ "+Number(order.total).toFixed(2)+". Formalize entrega e pagamento com o cliente.",
      buyer:{name:String(customer.name),email:customer.email??null,phone:customer.phone??null},
    });
    await pool.query("UPDATE buying_round_orders SET crm_sync_status='synced',crm_lead_id=$2 WHERE id=$1",[order.id,leadId]);
    res.json({id:order.id,status:"awaiting_payment",total:Number(order.total),vendor:{id:seller.id,name:seller.nome_empresa,storeUrl:"/listing?vendorId="+encodeURIComponent(String(seller.id))},paymentStatus:"A loja recebeu o lead para formalizar o pedido e o pagamento."});
  } catch(error) {
    console.error("[rounds] CRM sync failed after buyer acceptance:",error);
    await pool.query("UPDATE buying_round_orders SET crm_sync_status='failed' WHERE id=$1",[order.id]);
    res.status(202).json({id:order.id,status:"awaiting_payment",total:Number(order.total),paymentStatus:"Aceitação registrada; a loja será conectada para formalizar o pagamento."});
  }
});

router.post("/round-orders/:id/decline",async(req,res):Promise<void>=>{
  const consumer=buyerId(req);
  if(!consumer) return void res.status(401).json({error:"Entre na sua conta para responder à proposta."});
  const result=await pool.query("UPDATE buying_round_orders o SET status='declined' FROM buying_round_participants p WHERE o.participant_id=p.id AND o.id=$1 AND p.consumer_id=$2 AND o.status='awaiting_buyer' RETURNING o.id",[req.params.id,consumer]);
  if(!result.rows[0]) return void res.status(404).json({error:"Proposta não encontrada."});
  res.json({id:result.rows[0].id,status:"declined"});
});

// AppVendor.ai calls only from its authenticated server. No buyer contact data
// is included in these seller-facing payloads.
router.get("/internal/rounds",async(req,res):Promise<void>=>{
  if(!authorizedVendor(req,res)) return;
  const tenantId=String(req.query.tenantId??"").trim();
  if(!tenantId) return void res.status(422).json({error:"Tenant obrigatório."});
  try {
    await closeExpired();
    const enabled=await vendorPool.query("SELECT id FROM tenants WHERE id=$1 AND vende_no_praca_ai=true",[tenantId]);
    if(!enabled.rows[0]) return void res.status(403).json({error:"Loja não habilitada no Praça.ai."});
    const result=await pool.query("SELECT r.id,r.code,r.category,r.item_name,r.specification,r.unit,r.city,r.state,r.needed_at,r.closes_at,COALESCE(sum(p.quantity),0)::text AS total_quantity,mine.unit_price::text AS my_price,mine.freight_total::text AS my_freight,best.unit_price::text AS best_price,best.freight_total::text AS best_freight FROM buying_rounds r JOIN buying_round_participants p ON p.round_id=r.id LEFT JOIN buying_round_bids mine ON mine.round_id=r.id AND mine.vendor_id=$1 LEFT JOIN LATERAL (SELECT b.unit_price,b.freight_total FROM buying_round_bids b WHERE b.round_id=r.id ORDER BY b.unit_price + b.freight_total / NULLIF((SELECT sum(quantity) FROM buying_round_participants WHERE round_id=r.id),0),b.updated_at ASC LIMIT 1) best ON true WHERE r.status='open' AND r.closes_at>now() GROUP BY r.id,mine.unit_price,mine.freight_total,best.unit_price,best.freight_total ORDER BY r.closes_at ASC LIMIT 100",[tenantId]);
    res.json(result.rows.map((r:any)=>({id:r.id,code:r.code,category:r.category,itemName:r.item_name,specification:r.specification,unit:r.unit,city:r.city,state:r.state,neededAt:r.needed_at,closesAt:r.closes_at,totalQuantity:Number(r.total_quantity),myOffer:r.my_price?{unitPrice:Number(r.my_price),freight:Number(r.my_freight??0)}:null,bestOffer:r.best_price?{unitPrice:Number(r.best_price),freight:Number(r.best_freight??0)}:null})));
  } catch(error){console.error("[rounds] internal list failed:",error);res.status(500).json({error:"Não foi possível carregar oportunidades."});}
});

router.post("/internal/rounds/:id/bids",async(req,res):Promise<void>=>{
  if(!authorizedVendor(req,res)) return;
  const tenantId=String(req.body?.tenantId??"").trim();
  const unitPrice=Number(req.body?.unitPrice),freight=Number(req.body?.freight??0),deliveryDays=Number(req.body?.deliveryDays);
  const terms=typeof req.body?.terms==="string"?req.body.terms.trim().slice(0,1000):"";
  if(!tenantId||!Number.isFinite(unitPrice)||unitPrice<=0||!Number.isFinite(freight)||freight<0||!Number.isInteger(deliveryDays)||deliveryDays<0||containsContact(terms)) return void res.status(422).json({error:"Informe preço, frete e prazo válidos. Não inclua contatos nas condições."});
  try {
    const enabled=await vendorPool.query("SELECT id FROM tenants WHERE id=$1 AND vende_no_praca_ai=true",[tenantId]);
    if(!enabled.rows[0]) return void res.status(403).json({error:"Loja não habilitada no Praça.ai."});
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const round=await client.query("SELECT id,code,category,item_name,specification,unit,city,state,needed_at,status,closes_at FROM buying_rounds WHERE id=$1 FOR UPDATE",[req.params.id]);
      if(!round.rows[0]||round.rows[0].status!=="open"||new Date(round.rows[0].closes_at).getTime()<=Date.now()){await client.query("ROLLBACK");return void res.status(409).json({error:"Rodada encerrada."});}
      const total=Number((await client.query("SELECT COALESCE(sum(quantity),0)::numeric AS quantity FROM buying_round_participants WHERE round_id=$1",[req.params.id])).rows[0]?.quantity??0);
      const previous=await client.query("SELECT unit_price::numeric+freight_total::numeric/NULLIF($3::numeric,0) AS effective FROM buying_round_bids WHERE round_id=$1 AND vendor_id=$2 FOR UPDATE",[req.params.id,tenantId,total]);
      const effective=unitPrice+(total?freight/total:freight);
      if(previous.rows[0]&&effective>=Number(previous.rows[0].effective)){await client.query("ROLLBACK");return void res.status(422).json({error:"O novo lance precisa reduzir o custo total por unidade da sua oferta anterior."});}
      const saved=await client.query("INSERT INTO buying_round_bids(round_id,vendor_id,unit_price,freight_total,delivery_days,terms) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(round_id,vendor_id) DO UPDATE SET unit_price=EXCLUDED.unit_price,freight_total=EXCLUDED.freight_total,delivery_days=EXCLUDED.delivery_days,terms=EXCLUDED.terms,updated_at=now() RETURNING id",[req.params.id,tenantId,unitPrice,freight,deliveryDays,terms||null]);
      await client.query("INSERT INTO buying_round_bid_events(bid_id,unit_price,freight_total,delivery_days) VALUES($1,$2,$3,$4)",[saved.rows[0].id,unitPrice,freight,deliveryDays]);
      await client.query("COMMIT");
      let crmStatus="pending";
      try {
        await ensureRoundLead({
          roundId:String(req.params.id), vendorId:tenantId, code:String(round.rows[0].code),
          demand:String(total)+" "+String(round.rows[0].unit)+" de "+String(round.rows[0].item_name)+
            (round.rows[0].specification?" ("+String(round.rows[0].specification)+")":"")+
            " · "+String(round.rows[0].city)+", "+String(round.rows[0].state)+
            " · entrega até "+new Date(round.rows[0].needed_at).toLocaleDateString("pt-BR"),
        });
        crmStatus="notified";
      } catch(crmError) { console.error("[rounds] anonymous CRM lead failed:",crmError); }
      res.status(201).json({ok:true,crmStatus,offer:{unitPrice,freight,deliveryDays}});
    } catch(error){await client.query("ROLLBACK");throw error;} finally{client.release();}
  } catch(error){console.error("[rounds] save bid failed:",error);res.status(500).json({error:"Não foi possível registrar sua proposta."});}
});

export default router;
