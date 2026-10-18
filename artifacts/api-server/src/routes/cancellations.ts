import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const REASONS = new Set(["mudanca_de_ideia", "prazo", "preco", "erro_no_pedido", "outro"]);

function buyerId(req: any): number | null {
  const id = Number(req.session?.consumerId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function orderForBuyer(client: any, type: string, id: string, buyer: number, lock = false) {
  if (type === "quote") return client.query(
    `SELECT q.id,q.status,o.vendor_id,f.status AS fulfillment_status
       FROM quote_requests q JOIN quote_offers o ON o.quote_request_id=q.id AND o.status='aceita'
       LEFT JOIN praca_marketplace_fulfillments f ON f.order_type='quote' AND f.order_id=q.id AND f.vendor_id=o.vendor_id
      WHERE q.id=$1 AND q.consumer_id=$2 ${lock ? "FOR UPDATE OF q" : ""}`,
    [id, buyer],
  );
  if (type === "round") return client.query(
    `SELECT o.id,o.status,o.vendor_id,f.status AS fulfillment_status
       FROM buying_round_orders o JOIN buying_round_participants p ON p.id=o.participant_id
       LEFT JOIN praca_marketplace_fulfillments f ON f.order_type='round' AND f.order_id=o.id AND f.vendor_id=o.vendor_id
      WHERE o.id=$1 AND p.consumer_id=$2 ${lock ? "FOR UPDATE OF o" : ""}`,
    [id, buyer],
  );
  return { rows: [] };
}

router.post("/marketplace-orders/:type/:id/cancelamento", async (req, res): Promise<void> => {
  const buyer = buyerId(req);
  if (!buyer) return void res.status(401).json({ error: "Entre na sua conta para solicitar o cancelamento." });
  const type = String(req.params.type ?? ""), id = String(req.params.id ?? "");
  const reason = String(req.body?.reason ?? "");
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  if (!['quote', 'round'].includes(type) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return void res.status(422).json({ error: "Pedido inválido." });
  }
  if (!REASONS.has(reason) || description.length < 12 || description.length > 2000) {
    return void res.status(422).json({ error: "Escolha um motivo e descreva a solicitação em pelo menos 12 caracteres." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await orderForBuyer(client, type, id, buyer, true);
    const order = result.rows[0];
    if (!order) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Pedido não encontrado." }); }
    if (order.status !== "paid" || order.fulfillment_status === "shipped") {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "A solicitação de cancelamento está disponível enquanto o pedido pago ainda não saiu para entrega. Para problemas após o envio, abra uma disputa." });
    }
    const dispute = await client.query(
      "SELECT 1 FROM praca_order_disputes WHERE order_type=$1 AND order_id=$2 AND consumer_id=$3 AND status IN ('aberta','em_analise','aguardando_comprador') LIMIT 1",
      [type, id, buyer],
    );
    if (dispute.rows.length) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Já existe uma disputa em andamento para este pedido. Continue o atendimento por ela." });
    }
    const created = await client.query(
      `INSERT INTO praca_order_cancellations(order_type,order_id,consumer_id,vendor_id,reason,description)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id,order_type,order_id,reason,description,status,created_at`,
      [type, id, buyer, order.vendor_id, reason, description],
    );
    await client.query(
      `INSERT INTO praca_order_cancellation_events(cancellation_id,to_status,actor_type,actor_consumer_id,note)
       VALUES($1,'solicitada','buyer',$2,'Solicitação enviada pelo comprador')`,
      [created.rows[0].id, buyer],
    );
    await client.query("COMMIT");
    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") return void res.status(409).json({ error: "Já existe uma solicitação de cancelamento para este pedido." });
    console.error("[cancellations] request failed:", error);
    res.status(500).json({ error: "Não foi possível registrar a solicitação agora." });
  } finally { client.release(); }
});

router.get("/marketplace-orders/:type/:id/cancelamento", async (req, res): Promise<void> => {
  const buyer = buyerId(req);
  if (!buyer) return void res.status(401).json({ error: "Entre na sua conta para consultar a solicitação." });
  const type = String(req.params.type ?? ""), id = String(req.params.id ?? "");
  if (!['quote', 'round'].includes(type) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return void res.status(422).json({ error: "Pedido inválido." });
  const owned = await orderForBuyer(pool, type, id, buyer);
  if (!owned.rows[0]) return void res.status(404).json({ error: "Pedido não encontrado." });
  const found = await pool.query(
    `SELECT id,order_type,order_id,reason,description,status,resolution_note,refund_status,asaas_refunded_at,refund_error,created_at,updated_at,resolved_at
       FROM praca_order_cancellations WHERE order_type=$1 AND order_id=$2 AND consumer_id=$3 LIMIT 1`, [type, id, buyer],
  );
  const request = found.rows[0];
  const events = request ? await pool.query(
    `SELECT id,actor_type AS "actorType",note,created_at AS "createdAt"
       FROM praca_order_cancellation_events WHERE cancellation_id=$1 ORDER BY created_at,id`, [request.id],
  ) : { rows: [] };
  res.set("Cache-Control", "no-store").json(request ? { ...request, events: events.rows } : null);
});

export default router;
