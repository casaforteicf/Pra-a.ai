import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Kind = "quote" | "round";
function kind(value: unknown): value is Kind { return value === "quote" || value === "round"; }
function auth(req: any, res: any): boolean {
  const expected = Buffer.from(process.env.PRACA_ROUNDS_VENDOR_TOKEN ?? "");
  const supplied = Buffer.from(req.header("x-praca-rounds-token") ?? "");
  if (expected.length < 32 || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    res.status(401).json({ error: "Integração não autorizada." }); return false;
  }
  return true;
}
function buyer(req: any): number | null {
  const id = Number(req.session?.consumerId); return Number.isSafeInteger(id) && id > 0 ? id : null;
}
async function ownedOrder(client: any, type: Kind, id: string, owner: string | number, vendor: boolean) {
  if (type === "quote") return client.query(
    `SELECT q.id,q.status,o.vendor_id,q.consumer_id FROM quote_requests q
     JOIN quote_offers o ON o.quote_request_id=q.id AND o.status='aceita'
     WHERE q.id=$1 AND ${vendor ? "o.vendor_id" : "q.consumer_id"}=$2 FOR UPDATE OF q`, [id, owner]);
  return client.query(
    `SELECT o.id,o.status,o.vendor_id,p.consumer_id FROM buying_round_orders o
     JOIN buying_round_participants p ON p.id=o.participant_id
     WHERE o.id=$1 AND ${vendor ? "o.vendor_id" : "p.consumer_id"}=$2 FOR UPDATE OF o`, [id, owner]);
}
async function blocked(client: any, type: Kind, id: string) {
  const result = await client.query(
    `SELECT 1 FROM praca_order_disputes WHERE order_type=$1 AND order_id=$2
       AND status IN ('aberta','em_analise','aguardando_comprador')
     UNION ALL SELECT 1 FROM praca_order_cancellations WHERE order_type=$1 AND order_id=$2
       AND status IN ('solicitada','em_analise') LIMIT 1`, [type, id]);
  return result.rows.length > 0;
}
function photo(value: unknown): { bytes: Buffer; mime: string } | null {
  if (typeof value !== "string" || value.length > 1000000) return null;
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 16 || bytes.length > 700000) return null;
  const valid = match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return valid ? { bytes, mime: "image/" + match[1] } : null;
}

router.post("/internal/vendor-orders/:type/:id/delivery-report", async (req, res): Promise<void> => {
  if (!auth(req,res)) return;
  const type = req.params.type, id = String(req.params.id);
  const vendorId = typeof req.body?.tenantId === "string" ? req.body.tenantId.trim() : "";
  const receiver = typeof req.body?.receivedBy === "string" ? req.body.receivedBy.trim() : "";
  const evidence = photo(req.body?.photo);
  if (!kind(type) || !UUID.test(id) || !vendorId || receiver.length < 2 || receiver.length > 120 || !evidence || req.body?.allItemsDelivered !== true) {
    return void res.status(422).json({ error: "Informe quem recebeu, uma foto JPG/PNG de até 700 KB e confirme a entrega de todos os itens." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await ownedOrder(client,type,id,vendorId,true);
    if (!found.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Pedido não encontrado para esta loja." }); }
    if (found.rows[0].status !== "paid" || await blocked(client,type,id)) {
      await client.query("ROLLBACK"); return void res.status(409).json({ error: "Entrega bloqueada por estado do pedido ou atendimento em análise." });
    }
    const f = await client.query("SELECT status,delivery_mode,delivery_reported_at FROM praca_marketplace_fulfillments WHERE order_type=$1 AND order_id=$2 AND vendor_id=$3 FOR UPDATE", [type,id,vendorId]);
    const row = f.rows[0];
    if (!row || row.delivery_reported_at || !(row.status === "shipped" || (row.status === "ready" && row.delivery_mode === "pickup"))) {
      await client.query("ROLLBACK"); return void res.status(409).json({ error: "Registre a saída para entrega ou a retirada pronta. Uma comprovação já enviada não pode ser substituída." });
    }
    await client.query(`UPDATE praca_marketplace_fulfillments SET delivery_reported_at=now(),delivery_received_by=$4,
      delivery_photo=$5,delivery_photo_mime=$6,updated_at=now() WHERE order_type=$1 AND order_id=$2 AND vendor_id=$3`,
      [type,id,vendorId,receiver,evidence.bytes.toString("base64"),evidence.mime]);
    await client.query(`INSERT INTO praca_marketplace_fulfillment_events(order_type,order_id,vendor_id,status,delivery_mode,seller_note)
      VALUES($1,$2,$3,$4,$5,'Entrega integral informada com foto; aguardando aceite do comprador.')`, [type,id,vendorId,row.status,row.delivery_mode]);
    await client.query("COMMIT");
    res.status(201).json({ status: "awaiting_buyer_confirmation", message: "Comprovante registrado. Aguarde o aceite do comprador." });
  } catch {
    await client.query("ROLLBACK").catch(()=>undefined);
    res.status(500).json({ error: "Não foi possível registrar o comprovante." });
  } finally { client.release(); }
});

router.get("/marketplace-orders/:type/:id/delivery-report", async (req,res): Promise<void> => {
  const consumer = buyer(req), type=req.params.type, id=String(req.params.id);
  if (!consumer) return void res.status(401).json({ error: "Entre na sua conta." });
  if (!kind(type) || !UUID.test(id)) return void res.status(422).json({ error: "Pedido inválido." });
  const client=await pool.connect();
  try {
    const found=await ownedOrder(client,type,id,consumer,false);
    if (!found.rows[0] || !["paid","delivered","released"].includes(found.rows[0].status)) return void res.status(404).json({ error: "Pedido não encontrado." });
    const f=await client.query("SELECT delivery_reported_at,delivery_received_by FROM praca_marketplace_fulfillments WHERE order_type=$1 AND order_id=$2 AND vendor_id=$3", [type,id,found.rows[0].vendor_id]);
    res.set("Cache-Control","no-store").json({ reportedAt:f.rows[0]?.delivery_reported_at??null, receivedBy:f.rows[0]?.delivery_received_by??null, blocked:await blocked(client,type,id), orderStatus:found.rows[0].status });
  } catch { res.status(500).json({error:"Não foi possível carregar a entrega."}); }
  finally { client.release(); }
});
router.get("/marketplace-orders/:type/:id/delivery-evidence", async (req,res): Promise<void> => {
  const consumer=buyer(req), type=req.params.type,id=String(req.params.id);
  if (!consumer) return void res.status(401).end();
  if (!kind(type)||!UUID.test(id)) return void res.status(422).end();
  const client=await pool.connect();
  try {
    const found=await ownedOrder(client,type,id,consumer,false);
    if (!found.rows[0]||!["paid","delivered","released"].includes(found.rows[0].status)) return void res.status(404).end();
    const f=await client.query("SELECT delivery_photo,delivery_photo_mime FROM praca_marketplace_fulfillments WHERE order_type=$1 AND order_id=$2 AND vendor_id=$3", [type,id,found.rows[0].vendor_id]);
    if (!f.rows[0]?.delivery_photo) return void res.status(404).end();
    res.set("Cache-Control","private, no-store").set("X-Content-Type-Options","nosniff").type(f.rows[0].delivery_photo_mime).send(Buffer.from(f.rows[0].delivery_photo,"base64"));
  } catch { res.status(500).end(); } finally { client.release(); }
});

async function confirm(req:any,res:any,type:Kind): Promise<void> {
  const consumer=buyer(req),id=String(req.params.id);
  if (!consumer) return void res.status(401).json({error:"Entre na sua conta."});
  if (!UUID.test(id)||req.body?.allItemsReceived!==true) return void res.status(422).json({error:"Confirme que recebeu todos os itens corretamente."});
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const found=await ownedOrder(client,type,id,consumer,false),order=found.rows[0];
    if (!order) { await client.query("ROLLBACK"); return void res.status(404).json({error:"Pedido não encontrado."}); }
    if (order.status==="delivered"||order.status==="released") {
      await client.query("COMMIT"); return void res.json({status:order.status,payoutStatus:order.status==="released"?"released":"blocked_provider",duplicate:true});
    }
    if (order.status!=="paid"||await blocked(client,type,id)) {
      await client.query("ROLLBACK"); return void res.status(409).json({error:"Recebimento bloqueado por estado do pedido ou atendimento em análise."});
    }
    const f=await client.query("SELECT delivery_reported_at,delivery_photo FROM praca_marketplace_fulfillments WHERE order_type=$1 AND order_id=$2 AND vendor_id=$3 FOR UPDATE",[type,id,order.vendor_id]);
    if (!f.rows[0]?.delivery_reported_at||!f.rows[0]?.delivery_photo) {
      await client.query("ROLLBACK"); return void res.status(409).json({error:"Aguarde o lojista registrar o comprovante de entrega."});
    }
    await client.query(type==="quote"?"UPDATE quote_requests SET status='delivered',delivered_at=now() WHERE id=$1":"UPDATE buying_round_orders SET status='delivered',delivered_at=now(),updated_at=now() WHERE id=$1",[id]);
    // Registra intenção única. Não afirma retenção nem dispara transferência sem provedor habilitado.
    await client.query(`INSERT INTO praca_delivery_acceptances(order_type,order_id,vendor_id,consumer_id,release_status)
      VALUES($1,$2,$3,$4,'blocked_provider') ON CONFLICT(order_type,order_id) DO NOTHING`,[type,id,order.vendor_id,consumer]);
    await client.query("COMMIT");
    res.json({status:"delivered",payoutStatus:"blocked_provider",message:"Recebimento confirmado. A liberação financeira aguarda a integração do provedor."});
  } catch { await client.query("ROLLBACK").catch(()=>undefined); res.status(500).json({error:"Não foi possível confirmar o recebimento."}); }
  finally { client.release(); }
}
router.post("/quotes/:id/confirm-delivery",async(req,res)=>confirm(req,res,"quote"));
router.post("/round-orders/:id/confirm-delivery",async(req,res)=>confirm(req,res,"round"));
export default router;
