import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, disputesTable, ordersTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { timingSafeEqual } from "node:crypto";

const router: IRouter = Router();

const MOTIVOS_ERRO_LOJISTA = new Set(["defeito", "produto_errado"]);
const MARKETPLACE_REASONS = new Set(["nao_recebido", "produto_danificado", "produto_incompleto", "produto_divergente", "atraso", "outro"]);

function consumerId(req: any): number | null {
  const id = Number(req.session?.consumerId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validAdminKey(req: any): boolean {
  const expected = process.env.PRACA_ADMIN_API_KEY ?? "";
  const supplied = req.header("x-admin-key") ?? "";
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

async function marketplaceOrder(client: any, type: string, id: string, buyerId: number, lock = false) {
  if (type === "quote") {
    return client.query(
      `SELECT q.id,q.consumer_id,q.status,o.vendor_id FROM quote_requests q
       JOIN quote_offers o ON o.quote_request_id=q.id AND o.status='aceita'
       WHERE q.id=$1 AND q.consumer_id=$2 ${lock ? "FOR UPDATE OF q" : ""}`,
      [id, buyerId],
    );
  }
  if (type === "round") {
    return client.query(
      `SELECT o.id,p.consumer_id,o.status,o.vendor_id FROM buying_round_orders o
       JOIN buying_round_participants p ON p.id=o.participant_id
       WHERE o.id=$1 AND p.consumer_id=$2 ${lock ? "FOR UPDATE OF o" : ""}`,
      [id, buyerId],
    );
  }
  return { rows: [] };
}

router.post("/marketplace-orders/:type/:id/disputa", async (req, res): Promise<void> => {
  const buyerId = consumerId(req);
  if (!buyerId) return void res.status(401).json({ error: "Entre na sua conta para abrir uma disputa." });
  const type = String(req.params.type ?? "");
  const orderId = String(req.params.id ?? "");
  if (!["quote", "round"].includes(type) || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return void res.status(422).json({ error: "Pedido inválido." });
  }
  const reason = String(req.body?.reason ?? "");
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const evidenceUrl = typeof req.body?.evidenceUrl === "string" ? req.body.evidenceUrl.trim() : "";
  if (!MARKETPLACE_REASONS.has(reason) || description.length < 12 || description.length > 3000) {
    return void res.status(422).json({ error: "Escolha um motivo e descreva o problema em pelo menos 12 caracteres." });
  }
  if (evidenceUrl) {
    try {
      const url = new URL(evidenceUrl);
      if (url.protocol !== "https:" || evidenceUrl.length > 1500) throw new Error("invalid");
    } catch {
      return void res.status(422).json({ error: "A evidência deve ser um link HTTPS válido." });
    }
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await marketplaceOrder(client, type, orderId, buyerId, true);
    const order = result.rows[0];
    if (!order) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Pedido não encontrado." }); }
    if (!["paid", "delivered"].includes(String(order.status))) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Só é possível abrir disputa em pedido pago e ainda não repassado." });
    }
    const inserted = await client.query(
      `INSERT INTO praca_order_disputes(order_type,order_id,consumer_id,vendor_id,reason_code,description,evidence_url)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,order_type,order_id,reason_code,description,evidence_url,status,created_at`,
      [type, orderId, buyerId, order.vendor_id, reason, description, evidenceUrl || null],
    );
    await client.query(
      `INSERT INTO praca_order_dispute_events(dispute_id,to_status,actor_type,actor_consumer_id,note)
       VALUES($1,'aberta','buyer',$2,'Disputa aberta pelo comprador')`,
      [inserted.rows[0].id, buyerId],
    );
    await client.query("COMMIT");
    res.status(201).json(inserted.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") return void res.status(409).json({ error: "Já existe uma disputa registrada para este pedido." });
    console.error("[disputes] marketplace dispute create failed:", error);
    res.status(500).json({ error: "Não foi possível abrir a disputa agora." });
  } finally { client.release(); }
});

router.get("/marketplace-orders/:type/:id/disputa", async (req, res): Promise<void> => {
  const buyerId = consumerId(req);
  if (!buyerId) return void res.status(401).json({ error: "Entre na sua conta para consultar a disputa." });
  const type = String(req.params.type ?? ""), orderId = String(req.params.id ?? "");
  if (!["quote", "round"].includes(type) || !/^[0-9a-f-]{36}$/i.test(orderId)) return void res.status(422).json({ error: "Pedido inválido." });
  const owned = await marketplaceOrder(pool, type, orderId, buyerId);
  if (!owned.rows[0]) return void res.status(404).json({ error: "Pedido não encontrado." });
  const result = await pool.query(
    `SELECT id,order_type,order_id,reason_code,description,evidence_url,status,vendor_response,resolution_text,created_at,updated_at,resolved_at
     FROM praca_order_disputes WHERE order_type=$1 AND order_id=$2 AND consumer_id=$3 LIMIT 1`,
    [type, orderId, buyerId],
  );
  const dispute = result.rows[0];
  const events = dispute ? await pool.query(
    `SELECT id,actor_type AS "actorType",note,created_at AS "createdAt"
     FROM praca_order_dispute_events WHERE dispute_id=$1 ORDER BY created_at,id`, [dispute.id],
  ) : { rows: [] };
  res.set("Cache-Control", "no-store").json(dispute ? { ...dispute, events: events.rows } : null);
});

router.post("/marketplace-orders/:type/:id/disputa/resposta", async (req, res): Promise<void> => {
  const buyerId = consumerId(req);
  if (!buyerId) return void res.status(401).json({ error: "Entre na sua conta para responder à disputa." });
  const type = String(req.params.type ?? ""), orderId = String(req.params.id ?? "");
  const response = typeof req.body?.response === "string" ? req.body.response.trim() : "";
  if (!["quote", "round"].includes(type) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) || response.length < 12 || response.length > 3000) {
    return void res.status(422).json({ error: "Informe um pedido válido e uma resposta de 12 a 3.000 caracteres." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await marketplaceOrder(client, type, orderId, buyerId, true);
    if (!owned.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Pedido não encontrado." }); }
    const result = await client.query(
      "SELECT id,status FROM praca_order_disputes WHERE order_type=$1 AND order_id=$2 AND consumer_id=$3 FOR UPDATE",
      [type, orderId, buyerId],
    );
    const dispute = result.rows[0];
    if (!dispute) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Disputa não encontrada." }); }
    if (dispute.status !== "aguardando_comprador") {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "A disputa não está aguardando sua resposta. Atualize o pedido para acompanhar a análise." });
    }
    await client.query(
      "INSERT INTO praca_order_dispute_events(dispute_id,from_status,to_status,actor_type,actor_consumer_id,note) VALUES($1,'aguardando_comprador','em_analise','buyer',$2,$3)",
      [dispute.id, buyerId, response],
    );
    await client.query("UPDATE praca_order_disputes SET status='em_analise',updated_at=now() WHERE id=$1", [dispute.id]);
    await client.query("COMMIT");
    res.set("Cache-Control", "no-store").json({ id: dispute.id, status: "em_analise" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[disputes] buyer response failed:", error);
    res.status(500).json({ error: "Não foi possível registrar sua resposta agora." });
  } finally { client.release(); }
});

router.post("/orders/:id/disputa", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const { motivo, descricao, evidenciaUrl } = req.body as {
    motivo?: string;
    descricao?: string;
    evidenciaUrl?: string;
  };

  if (!motivo || !descricao) {
    res.status(400).json({ error: "Informe o motivo e a descrição da disputa." });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const buyer = consumerId(req);
  if (!buyer) {
    res.status(401).json({ error: "Entre na sua conta para abrir uma disputa." });
    return;
  }
  const shippingValue = Number(order.shipping ?? 0);
  if (order.consumerId !== buyer) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  const existing = await db.select({ id: disputesTable.id }).from(disputesTable).where(eq(disputesTable.orderId, orderId)).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "Já existe uma disputa registrada para este pedido." });
    return;
  }

  // Regra decidida: custo do frete de devolução nunca fica com o cliente.
  const isErroLojista = MOTIVOS_ERRO_LOJISTA.has(motivo);
  const freteDevolucaoResponsavel = isErroLojista ? "lojista" : "rateado";
  const freteDevolucaoValorVendedor = isErroLojista ? shippingValue : Math.round((shippingValue / 2) * 100) / 100;
  const freteDevolucaoValorEntregador = isErroLojista ? 0 : Math.round((shippingValue / 2) * 100) / 100;

  const [dispute] = await db
    .insert(disputesTable)
    .values({
      orderId,
      consumerId: buyer,
      motivo,
      descricao,
      evidenciaUrl: evidenciaUrl ?? null,
      status: "aberta",
      freteDevolucaoResponsavel,
      freteDevolucaoValorVendedor: String(freteDevolucaoValorVendedor),
      freteDevolucaoValorEntregador: String(freteDevolucaoValorEntregador),
    })
    .returning();

  res.status(201).json(dispute);
});

router.get("/disputas/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const disputeId = parseInt(id, 10);
  if (isNaN(disputeId)) {
    res.status(404).json({ error: "Disputa não encontrada" });
    return;
  }

  const [dispute] = await db.select().from(disputesTable).where(eq(disputesTable.id, disputeId)).limit(1);
  if (!dispute) {
    res.status(404).json({ error: "Disputa não encontrada" });
    return;
  }

  const buyerId = consumerId(req);
  if (buyerId !== dispute.consumerId && !validAdminKey(req)) return void res.status(404).json({ error: "Disputa não encontrada" });
  res.json(dispute);
});

// Uso interno/admin — sem tela de administração própria ainda; endpoint pronto
// pra quando o painel de suporte existir.
router.patch("/disputas/:id", async (req, res): Promise<void> => {
  if (!validAdminKey(req)) return void res.status(401).json({ error: "Acesso administrativo não autorizado." });
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const disputeId = parseInt(id, 10);
  if (isNaN(disputeId)) {
    res.status(404).json({ error: "Disputa não encontrada" });
    return;
  }

  const { status, resolucaoTexto } = req.body as { status?: string; resolucaoTexto?: string };
  if (!status || !["aberta", "em_analise", "resolvida"].includes(status) || (status === "resolvida" && !String(resolucaoTexto ?? "").trim())) {
    return void res.status(422).json({ error: "Informe um status válido e a resolução antes de concluir." });
  }
  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (resolucaoTexto) updates.resolucaoTexto = resolucaoTexto;
  if (status === "resolvida") updates.resolvidoEm = new Date();

  const [updated] = await db
    .update(disputesTable)
    .set(updates)
    .where(eq(disputesTable.id, disputeId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Disputa não encontrada" });
    return;
  }

  res.json(updated);
});

export default router;
