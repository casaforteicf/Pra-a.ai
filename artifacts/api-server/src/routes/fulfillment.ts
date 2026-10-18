import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const CONTACT_PATTERN = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){10,})/i;
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
const STATUS_ORDER = { preparing: 1, ready: 2, shipped: 3 } as const;
type FulfillmentStatus = keyof typeof STATUS_ORDER;
type OrderType = "quote" | "round";

function authorized(req: any, res: any): boolean {
  const expected = process.env.PRACA_ROUNDS_VENDOR_TOKEN ?? "";
  const supplied = req.header("x-praca-rounds-token") ?? "";
  if (expected.length < 32 || supplied.length !== expected.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    res.status(401).json({ error: "Integração de lojista não autorizada." });
    return false;
  }
  return true;
}

function normalizeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
}

router.get("/internal/vendor-orders", async (req, res): Promise<void> => {
  if (!authorized(req, res)) return;
  const vendorId = typeof req.query.tenantId === "string" ? req.query.tenantId.trim() : "";
  if (!vendorId) return void res.status(422).json({ error: "Loja inválida." });
  try {
    const [quotes, rounds] = await Promise.all([
      pool.query(
        `SELECT q.id,q.protocol AS code,q.status AS payment_status,q.paid_at,q.delivered_at,
                q.category,q.title,q.description,q.location,q.needed_at,
                c.name AS buyer_name,c.email AS buyer_email,c.phone AS buyer_phone,
                COALESCE((SELECT json_agg(json_build_object(
                  'description',qi.description,'quantity',qi.quantity,'unit',qi.unit,'brand',qi.brand
                ) ORDER BY qi.id) FROM quote_request_items qi WHERE qi.quote_request_id=q.id),'[]'::json) AS items,
                f.status AS fulfillment_status,f.delivery_mode,f.carrier,f.tracking_code,f.seller_note,f.shipped_at,f.updated_at
         FROM quote_requests q
         JOIN quote_offers o ON o.quote_request_id=q.id AND o.status='aceita' AND o.vendor_id=$1
         JOIN consumers c ON c.id=q.consumer_id
         LEFT JOIN praca_marketplace_fulfillments f ON f.order_type='quote' AND f.order_id=q.id AND f.vendor_id=$1
         WHERE q.status IN ('paid','delivered','released')
         ORDER BY COALESCE(q.paid_at,q.created_at) DESC LIMIT 100`,
        [vendorId],
      ),
      pool.query(
        `SELECT o.id,r.code,o.status AS payment_status,o.paid_at,o.delivered_at,
                r.category,r.item_name AS title,r.specification AS description,
                concat(r.city,', ',r.state) AS location,r.needed_at,
                c.name AS buyer_name,c.email AS buyer_email,c.phone AS buyer_phone,
                json_build_array(json_build_object(
                  'description',r.item_name,'specification',r.specification,
                  'quantity',o.quantity,'unit',r.unit
                )) AS items,
                f.status AS fulfillment_status,f.delivery_mode,f.carrier,f.tracking_code,f.seller_note,f.shipped_at,f.updated_at
         FROM buying_round_orders o
         JOIN buying_rounds r ON r.id=o.round_id
         JOIN buying_round_participants p ON p.id=o.participant_id
         JOIN consumers c ON c.id=p.consumer_id
         LEFT JOIN praca_marketplace_fulfillments f ON f.order_type='round' AND f.order_id=o.id AND f.vendor_id=$1
         WHERE o.vendor_id=$1 AND o.status IN ('paid','delivered','released')
         ORDER BY COALESCE(o.paid_at,o.created_at) DESC LIMIT 100`,
        [vendorId],
      ),
    ]);
    const result = [
      ...quotes.rows.map((row: any) => ({ ...row, id: String(row.id), orderType: "quote" as const })),
      ...rounds.rows.map((row: any) => ({ ...row, id: String(row.id), orderType: "round" as const })),
    ].sort((a, b) => new Date(b.paid_at ?? b.updated_at ?? 0).getTime() - new Date(a.paid_at ?? a.updated_at ?? 0).getTime());
    res.set("Cache-Control", "no-store").json(result);
  } catch (error) {
    console.error("[praca-fulfillment] vendor orders failed:", error);
    res.status(500).json({ error: "Não foi possível carregar os pedidos Praça.ai." });
  }
});

router.patch("/internal/vendor-orders/:type/:id/fulfillment", async (req, res): Promise<void> => {
  if (!authorized(req, res)) return;
  const orderType = String(req.params.type) as OrderType;
  const orderId = String(req.params.id ?? "");
  const vendorId = normalizeText(req.body?.tenantId, 180);
  const status = String(req.body?.status ?? "") as FulfillmentStatus;
  const deliveryMode = req.body?.deliveryMode == null ? null : String(req.body.deliveryMode);
  const carrier = normalizeText(req.body?.carrier, 120);
  const trackingCode = normalizeText(req.body?.trackingCode, 160);
  const sellerNote = normalizeText(req.body?.sellerNote, 1000);
  if (!vendorId || !["quote", "round"].includes(orderType) || !UUID_PATTERN.test(orderId) ||
      !Object.prototype.hasOwnProperty.call(STATUS_ORDER, status) || (deliveryMode !== null && !["pickup", "own_delivery", "carrier"].includes(deliveryMode)) ||
      (sellerNote && CONTACT_PATTERN.test(sellerNote))) {
    return void res.status(422).json({ error: "Revise o status e as informações de expedição." });
  }
  if (status === "ready" && deliveryMode !== "pickup" && deliveryMode !== "own_delivery") {
    return void res.status(422).json({ error: "Para marcar como pronto, selecione retirada ou entrega própria." });
  }
  if (status === "shipped" && deliveryMode !== "own_delivery" && deliveryMode !== "carrier") {
    return void res.status(422).json({ error: "Para registrar a saída, selecione entrega própria ou transportadora." });
  }
  if (status === "shipped" && deliveryMode === "carrier" && !carrier) {
    return void res.status(422).json({ error: "Informe a transportadora." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = orderType === "quote"
      ? await client.query(
          "SELECT q.id,q.status FROM quote_requests q JOIN quote_offers o ON o.quote_request_id=q.id AND o.status='aceita' WHERE q.id=$1 AND o.vendor_id=$2 FOR UPDATE OF q",
          [orderId, vendorId],
        )
      : await client.query(
          "SELECT id,status FROM buying_round_orders WHERE id=$1 AND vendor_id=$2 FOR UPDATE",
          [orderId, vendorId],
        );
    if (!order.rows[0] || !["paid", "delivered", "released"].includes(String(order.rows[0].status))) {
      await client.query("ROLLBACK");
      return void res.status(404).json({ error: "Pedido pago não encontrado para esta loja." });
    }
    if (["delivered", "released"].includes(String(order.rows[0].status))) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "A expedição não pode ser alterada depois da confirmação de entrega." });
    }
    const previous = await client.query(
      "SELECT status FROM praca_marketplace_fulfillments WHERE order_type=$1 AND order_id=$2 AND vendor_id=$3 FOR UPDATE",
      [orderType, orderId, vendorId],
    );
    const previousStatus = previous.rows[0]?.status as FulfillmentStatus | undefined;
    if (previousStatus && STATUS_ORDER[status] < STATUS_ORDER[previousStatus]) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "O status da expedição não pode voltar para uma etapa anterior." });
    }
    const saved = await client.query(
      `INSERT INTO praca_marketplace_fulfillments
         (order_type,order_id,vendor_id,status,delivery_mode,carrier,tracking_code,seller_note,shipped_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $4='shipped' THEN now() ELSE NULL END,now())
       ON CONFLICT (order_type,order_id) DO UPDATE SET
         status=EXCLUDED.status,
         delivery_mode=COALESCE(EXCLUDED.delivery_mode,praca_marketplace_fulfillments.delivery_mode),
         carrier=COALESCE(EXCLUDED.carrier,praca_marketplace_fulfillments.carrier),
         tracking_code=COALESCE(EXCLUDED.tracking_code,praca_marketplace_fulfillments.tracking_code),
         seller_note=COALESCE(EXCLUDED.seller_note,praca_marketplace_fulfillments.seller_note),
         shipped_at=CASE WHEN EXCLUDED.status='shipped' THEN COALESCE(praca_marketplace_fulfillments.shipped_at,now()) ELSE praca_marketplace_fulfillments.shipped_at END,
         updated_at=now()
       RETURNING status,delivery_mode,carrier,tracking_code,seller_note,shipped_at,updated_at`,
      [orderType, orderId, vendorId, status, deliveryMode, carrier, trackingCode, sellerNote],
    );
    const fulfillment = saved.rows[0];
    await client.query(
      `INSERT INTO praca_marketplace_fulfillment_events
         (order_type,order_id,vendor_id,status,delivery_mode,carrier,tracking_code,seller_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [orderType, orderId, vendorId, status, fulfillment.delivery_mode, fulfillment.carrier, fulfillment.tracking_code, fulfillment.seller_note],
    );
    await client.query("COMMIT");
    res.json({ id: orderId, orderType, ...fulfillment });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[praca-fulfillment] fulfillment update failed:", error);
    res.status(500).json({ error: "Não foi possível atualizar a expedição agora." });
  } finally {
    client.release();
  }
});

export default router;
