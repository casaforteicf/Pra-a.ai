import { Router, type IRouter } from "express";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import { vendorPool } from "../lib/vendorDb";
import { sendChatMessage } from "../lib/vendorSyncService";
import { createOrGetCustomer, createCharge, getPixQrCode, isAsaasConfigured } from "../lib/asaas";

const router: IRouter = Router();
const CONTACT_PATTERN = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){10,})/i;

function buyerId(req: any): number | null {
  const id = Number(req.session?.consumerId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function authorizedVendor(req: any, res: any): boolean {
  const expected = process.env.PRACA_ROUNDS_VENDOR_TOKEN;
  const supplied = req.header("x-praca-rounds-token");
  if (!expected || expected.length < 32) { res.status(503).json({ error: "Integração de rodadas indisponível." }); return false; }
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
        " Identificação e contato do comprador serão liberados somente depois que o pagamento for confirmado.",
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
    const expired = await client.query("SELECT id FROM buying_rounds WHERE status='open' AND closes_at<=now() ORDER BY closes_at LIMIT 50 FOR UPDATE SKIP LOCKED");
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
    const city=typeof req.query.city==="string"?req.query.city.trim().slice(0,100):"";
    const state=typeof req.query.state==="string"?req.query.state.trim().toUpperCase().slice(0,2):"";
    if (!city || !state) return void res.json([]);
    const result=await pool.query(
      "SELECT r.id,r.code,r.category,r.item_name,r.specification,r.unit,r.city,r.state,r.needed_at,r.closes_at,COALESCE(sum(p.quantity),0)::text AS total_quantity FROM buying_rounds r LEFT JOIN buying_round_participants p ON p.round_id=r.id WHERE r.status='open' AND r.closes_at>now() AND lower(r.city)=lower($1) AND upper(r.state)=upper($2) AND ($3::text IS NULL OR lower(r.category)=lower($3)) GROUP BY r.id ORDER BY r.closes_at ASC LIMIT 100",
      [city,state,category],
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
      const recent=await client.query("SELECT COUNT(*)::int AS n FROM buying_rounds WHERE created_by_consumer_id=$1 AND created_at>now()-interval '24 hours'",[consumer]);
      if(Number(recent.rows[0]?.n??0)>=5){await client.query("ROLLBACK");return void res.status(429).json({error:"Você atingiu o limite de cinco novas rodadas por dia. Tente novamente amanhã."});}
      const code="ROD-"+new Date().getFullYear()+"-"+randomBytes(3).toString("hex").toUpperCase();
      const inserted=await client.query("INSERT INTO buying_rounds(code,category,item_name,specification,unit,city,state,needed_at,closes_at,created_by_consumer_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8::date,now()+interval '48 hours',$9) RETURNING id,code,closes_at",[code,category,item,spec||null,unit,city,state,needed,consumer]);
      round=inserted.rows[0]; created=true;
    }
    const activeCount=await client.query("SELECT COUNT(*)::int AS n FROM buying_round_participants p JOIN buying_rounds r ON r.id=p.round_id WHERE p.consumer_id=$1 AND r.status='open' AND r.closes_at>now()",[consumer]);
    if(Number(activeCount.rows[0]?.n??0)>=5){await client.query("ROLLBACK");return void res.status(429).json({error:"Você pode participar de até cinco rodadas abertas por vez."});}
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
    const activeCount=await pool.query("SELECT COUNT(*)::int AS n FROM buying_round_participants p JOIN buying_rounds r ON r.id=p.round_id WHERE p.consumer_id=$1 AND r.status='open' AND r.closes_at>now()",[consumer]);
    if(Number(activeCount.rows[0]?.n??0)>=5) return void res.status(429).json({error:"Você pode participar de até cinco rodadas abertas por vez."});
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
    const result=await pool.query("SELECT COALESCE(o.id,p.id) AS id,COALESCE(o.status,CASE WHEN r.status='no_offers' THEN 'no_offers' WHEN r.status='open' THEN 'participating' ELSE 'closed' END) AS status,p.quantity::text,o.total::text,o.accepted_at,o.vendor_id,b.delivery_days,o.asaas_pix_payload,o.asaas_pix_qrcode_image,o.asaas_invoice_url,r.code,r.category,r.item_name,r.specification,r.unit,r.needed_at FROM buying_round_participants p JOIN buying_rounds r ON r.id=p.round_id LEFT JOIN buying_round_orders o ON o.participant_id=p.id LEFT JOIN buying_round_bids b ON b.id=o.bid_id WHERE p.consumer_id=$1 ORDER BY p.joined_at DESC",[consumer]);
    const response=[];
    for(const row of result.rows){
      let vendor=null;
      // A identidade do lojista só aparece depois da confirmação do pagamento.
      if(row.status==="paid"||row.status==="delivered"||row.status==="released"){
        const store=await vendorPool.query("SELECT id,nome_empresa FROM tenants WHERE id=$1 AND vende_no_praca_ai=true",[row.vendor_id]);
        if(store.rows[0]) vendor={id:store.rows[0].id,name:store.rows[0].nome_empresa,storeUrl:"/listing?vendorId="+encodeURIComponent(String(store.rows[0].id))};
      }
      response.push({id:row.id,status:row.status,quantity:Number(row.quantity),total:row.total===null?null:Number(row.total),deliveryDays:row.delivery_days===null?null:Number(row.delivery_days),acceptedAt:row.accepted_at,code:row.code,category:row.category,itemName:row.item_name,specification:row.specification,unit:row.unit,neededAt:row.needed_at,pixPayload:row.asaas_pix_payload,pixQrcodeImage:row.asaas_pix_qrcode_image,invoiceUrl:row.asaas_invoice_url,vendor});
    }
    res.json(response);
  } catch(error) {
    console.error("[rounds] orders failed:",error); res.status(500).json({error:"Não foi possível carregar seus pedidos de rodada."});
  }
});

router.post("/round-orders/:id/accept",async(req,res):Promise<void>=>{
  const consumer=buyerId(req);
  if(!consumer) return void res.status(401).json({error:"Entre na sua conta para aceitar a proposta."});
  try {
    const result=await pool.query(
      "UPDATE buying_round_orders o SET status='awaiting_payment',accepted_at=COALESCE(accepted_at,now()),updated_at=now() FROM buying_round_participants p WHERE o.participant_id=p.id AND o.id=$1 AND p.consumer_id=$2 AND o.status='awaiting_buyer' RETURNING o.id,o.total",
      [req.params.id,consumer],
    );
    if(!result.rows[0]) {
      const existing=await pool.query("SELECT o.id,o.status,o.total FROM buying_round_orders o JOIN buying_round_participants p ON p.id=o.participant_id WHERE o.id=$1 AND p.consumer_id=$2",[req.params.id,consumer]);
      if(existing.rows[0]?.status!=="awaiting_payment") return void res.status(404).json({error:"Proposta não encontrada ou indisponível."});
      return void res.json({id:existing.rows[0].id,status:"awaiting_payment",total:Number(existing.rows[0].total),paymentStatus:"Proposta aceita. Gere o pagamento para confirmar o pedido."});
    }
    res.json({id:result.rows[0].id,status:"awaiting_payment",total:Number(result.rows[0].total),paymentStatus:"Proposta aceita. Gere o pagamento para confirmar o pedido."});
  } catch(error) {
    console.error("[rounds] accept failed:",error);
    res.status(500).json({error:"Não foi possível aceitar a proposta agora."});
  }
});

router.post("/round-orders/:id/pay",async(req,res):Promise<void>=>{
  const consumer=buyerId(req);
  if(!consumer) return void res.status(401).json({error:"Entre na sua conta para pagar o pedido."});
  const method=String(req.body?.paymentMethod??"pix");
  if(method!=="pix"&&method!=="boleto") return void res.status(422).json({error:"Escolha Pix ou boleto."});
  if(!isAsaasConfigured()) return void res.status(503).json({error:"Pagamento temporariamente indisponível. A loja permanece oculta até a confirmação do pagamento."});
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const found=await client.query(
      "SELECT o.id,o.status,o.total::text,o.payment_method,o.asaas_charge_id,o.asaas_pix_payload,o.asaas_pix_qrcode_image,o.asaas_invoice_url,c.name,c.email,c.phone,c.cpf,r.code,r.item_name,r.unit FROM buying_round_orders o JOIN buying_round_participants p ON p.id=o.participant_id JOIN consumers c ON c.id=p.consumer_id JOIN buying_rounds r ON r.id=o.round_id WHERE o.id=$1 AND p.consumer_id=$2 FOR UPDATE OF o",
      [req.params.id,consumer],
    );
    const order=found.rows[0];
    if(!order) { await client.query("ROLLBACK"); return void res.status(404).json({error:"Pedido não encontrado."}); }
    if(order.status!=="awaiting_payment") { await client.query("ROLLBACK"); return void res.status(409).json({error:"Este pedido não está aguardando pagamento."}); }
    if(order.asaas_charge_id) {
      if(order.payment_method!==method) { await client.query("ROLLBACK"); return void res.status(409).json({error:"Já existe uma cobrança ativa para este pedido. Use o meio de pagamento escolhido."}); }
      await client.query("COMMIT");
      let pixPayload=order.asaas_pix_payload,pixQrcodeImage=order.asaas_pix_qrcode_image;
      if(order.payment_method==="pix"&&!pixPayload) {
        const pix=await getPixQrCode(String(order.asaas_charge_id));
        pixPayload=pix.payload;pixQrcodeImage=pix.encodedImage;
        await pool.query("UPDATE buying_round_orders SET asaas_pix_payload=$2,asaas_pix_qrcode_image=$3,updated_at=now() WHERE id=$1",[order.id,pixPayload,pixQrcodeImage]);
      }
      return void res.json({id:order.id,status:order.status,paymentMethod:order.payment_method,pixPayload,pixQrcodeImage,invoiceUrl:order.asaas_invoice_url});
    }
    const total=Number(order.total);
    if(!Number.isFinite(total)||total<5) { await client.query("ROLLBACK"); return void res.status(422).json({error:"O valor mínimo para cobrança é R$ 5,00."}); }
    if(method==="boleto"&&String(order.cpf??"").replace(/\D/g,"").length!==11) { await client.query("ROLLBACK"); return void res.status(422).json({error:"Cadastre um CPF válido na sua conta para pagar por boleto."}); }
    const customer=await createOrGetCustomer({name:String(order.name),email:String(order.email),phone:order.phone??undefined,cpfCnpj:order.cpf??undefined});
    const billingType=method==="pix"?"PIX":"BOLETO";
    const charge=await createCharge({
      customer:customer.id,billingType,value:total,
      dueDate:new Date(Date.now()+(method==="boleto"?3:1)*86400000).toISOString().slice(0,10),
      description:"Rodada Praça.ai "+String(order.code)+" — "+String(order.item_name),
      externalReference:"PRACA_ROUND_ORDER:"+String(order.id),
    });
    const invoiceUrl=method==="boleto"?(charge.bankSlipUrl??charge.invoiceUrl):charge.invoiceUrl;
    // Persist the charge id before requesting the QR code. A transient QR API
    // error can then be retried without creating a second live charge.
    await client.query(
      "UPDATE buying_round_orders SET payment_method=$2,asaas_charge_id=$3,asaas_invoice_url=$4,updated_at=now() WHERE id=$1",
      [order.id,method,charge.id,invoiceUrl??null],
    );
    await client.query("COMMIT");
    let pix:any=null;
    if(method==="pix") {
      pix=await getPixQrCode(charge.id);
      await pool.query("UPDATE buying_round_orders SET asaas_pix_payload=$2,asaas_pix_qrcode_image=$3,updated_at=now() WHERE id=$1",[order.id,pix.payload,pix.encodedImage]);
    }
    res.status(201).json({id:order.id,status:"awaiting_payment",paymentMethod:method,pixPayload:pix?.payload??null,pixQrcodeImage:pix?.encodedImage??null,invoiceUrl});
  } catch(error) {
    await client.query("ROLLBACK");
    console.error("[rounds] payment create failed:",error);
    res.status(502).json({error:"Não foi possível gerar a cobrança. Tente novamente mais tarde."});
  } finally { client.release(); }
});

router.post("/webhooks/asaas",async(req,res):Promise<void>=>{
  const expected=process.env.ASAAS_WEBHOOK_TOKEN??"";
  const supplied=req.header("asaas-access-token")??"";
  if(expected.length<32||supplied.length!==expected.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))) {
    return void res.status(401).json({error:"Webhook não autorizado."});
  }
  const event=String(req.body?.event??"");
  const payment=req.body?.payment;
  const chargeId=String(payment?.id??"");
  const externalReference=String(payment?.externalReference??"");
  if(!chargeId||!externalReference.startsWith("PRACA_ROUND_ORDER:")) return void res.status(200).json({received:true,ignored:true});
  const orderId=externalReference.slice("PRACA_ROUND_ORDER:".length);
  if(event!=="PAYMENT_RECEIVED"&&event!=="PAYMENT_CONFIRMED") return void res.status(200).json({received:true});
  try {
    const result=await pool.query(
      "UPDATE buying_round_orders SET status='paid',paid_at=COALESCE(paid_at,now()),updated_at=now() WHERE id=$1 AND asaas_charge_id=$2 AND status='awaiting_payment' RETURNING id,round_id,vendor_id,quantity::text,total::text",
      [orderId,chargeId],
    );
    let paid=result.rows[0];
    if(!paid) {
      const retry=await pool.query("SELECT id,round_id,vendor_id,quantity::text,total::text FROM buying_round_orders WHERE id=$1 AND asaas_charge_id=$2 AND status='paid' AND COALESCE(crm_sync_status,'')<>'synced'",[orderId,chargeId]);
      paid=retry.rows[0];
      if(!paid) return void res.status(200).json({received:true,duplicate:true});
    }
    const [buyer,round]=await Promise.all([
      pool.query("SELECT c.name,c.email,c.phone FROM buying_round_participants p JOIN consumers c ON c.id=p.consumer_id JOIN buying_round_orders o ON o.participant_id=p.id WHERE o.id=$1",[orderId]),
      pool.query("SELECT r.code,r.item_name,r.unit FROM buying_rounds r WHERE r.id=$1",[paid.round_id]),
    ]);
    const customer=buyer.rows[0],details=round.rows[0];
    if(customer&&details) {
      const leadId=await ensureRoundLead({
        roundId:String(paid.round_id),vendorId:String(paid.vendor_id),code:String(details.code),
        demand:String(paid.quantity)+" "+String(details.unit)+" de "+String(details.item_name)+". Pagamento confirmado; combinar entrega e confirmação no Praça.ai.",
        buyer:{name:String(customer.name),email:customer.email??null,phone:customer.phone??null},
      });
      await pool.query("UPDATE buying_round_orders SET crm_sync_status='synced',crm_lead_id=$2 WHERE id=$1",[orderId,leadId]);
    }
    res.json({received:true,paid:true});
  } catch(error) {
    console.error("[rounds] Asaas webhook failed:",error);
    res.status(500).json({error:"Não foi possível processar a confirmação agora."});
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
    const enabled=await vendorPool.query("SELECT id,cidade,estado FROM tenants WHERE id=$1 AND vende_no_praca_ai=true",[tenantId]);
    if(!enabled.rows[0]) return void res.status(403).json({error:"Loja não habilitada no Praça.ai."});
    const sellerCity=String(enabled.rows[0].cidade??"").trim(),sellerState=String(enabled.rows[0].estado??"").trim().toUpperCase();
    if(!sellerCity||!/^[A-Z]{2}$/.test(sellerState)) return void res.status(409).json({error:"Cadastre cidade e UF no perfil do AppVendor.ai para acessar rodadas."});
    const result=await pool.query("SELECT r.id,r.code,r.category,r.item_name,r.specification,r.unit,r.city,r.state,r.needed_at,r.closes_at,COALESCE(sum(p.quantity),0)::text AS total_quantity,mine.unit_price::text AS my_price,mine.freight_total::text AS my_freight,best.unit_price::text AS best_price,best.freight_total::text AS best_freight FROM buying_rounds r JOIN buying_round_participants p ON p.round_id=r.id LEFT JOIN buying_round_bids mine ON mine.round_id=r.id AND mine.vendor_id=$1 LEFT JOIN LATERAL (SELECT b.unit_price,b.freight_total FROM buying_round_bids b WHERE b.round_id=r.id ORDER BY b.unit_price + b.freight_total / NULLIF((SELECT sum(quantity) FROM buying_round_participants WHERE round_id=r.id),0),b.updated_at ASC LIMIT 1) best ON true WHERE r.status='open' AND r.closes_at>now() AND lower(trim(r.city))=lower($2) AND upper(trim(r.state))=upper($3) GROUP BY r.id,mine.unit_price,mine.freight_total,best.unit_price,best.freight_total ORDER BY r.closes_at ASC LIMIT 100",[tenantId,sellerCity,sellerState]);
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
    const enabled=await vendorPool.query("SELECT id,cidade,estado FROM tenants WHERE id=$1 AND vende_no_praca_ai=true",[tenantId]);
    if(!enabled.rows[0]) return void res.status(403).json({error:"Loja não habilitada no Praça.ai."});
    const sellerCity=String(enabled.rows[0].cidade??"").trim(),sellerState=String(enabled.rows[0].estado??"").trim().toUpperCase();
    if(!sellerCity||!/^[A-Z]{2}$/.test(sellerState)) return void res.status(409).json({error:"Cadastre cidade e UF no perfil do AppVendor.ai para enviar lances."});
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const round=await client.query("SELECT id,code,category,item_name,specification,unit,city,state,needed_at,status,closes_at FROM buying_rounds WHERE id=$1 FOR UPDATE",[req.params.id]);
      if(!round.rows[0]||round.rows[0].status!=="open"||new Date(round.rows[0].closes_at).getTime()<=Date.now()){await client.query("ROLLBACK");return void res.status(409).json({error:"Rodada encerrada."});}
      if(String(round.rows[0].city).trim().toLowerCase()!==sellerCity.toLowerCase()||String(round.rows[0].state).trim().toUpperCase()!==sellerState){await client.query("ROLLBACK");return void res.status(403).json({error:"Esta rodada pertence a outro município."});}
      const deliveryDeadline=new Date(round.rows[0].needed_at).getTime()+24*60*60*1000;
      const availableAfterClose=deliveryDeadline-new Date(round.rows[0].closes_at).getTime();
      if(deliveryDays*24*60*60*1000>availableAfterClose){await client.query("ROLLBACK");return void res.status(422).json({error:"O prazo de entrega precisa caber antes da data solicitada pelo comprador."});}
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
