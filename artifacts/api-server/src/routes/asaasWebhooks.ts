import { Router, type IRouter, type Request, type Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import { getPayment } from "../lib/asaas";

const router: IRouter = Router();
const PAYMENT_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

router.post("/webhooks/asaas", async (req: Request, res: Response): Promise<void> => {
  // A integração permanece desligada por padrão até configurar o token no
  // Asaas e nos secrets da API da Contabo.
  if (process.env.ASAAS_PAYMENT_WEBHOOK_ENABLED !== "true") {
    res.status(404).json({ error: "Webhook indisponível." });
    return;
  }

  const secret = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!secret || secret.length < 32 || /\s/.test(secret)) {
    res.status(503).json({ error: "Webhook Asaas não configurado." });
    return;
  }
  if (!tokenMatches(req.header("asaas-access-token"), secret)) {
    res.status(401).json({ error: "Não autorizado." });
    return;
  }

  const eventId = typeof req.body?.id === "string" ? req.body.id : "";
  const eventType = typeof req.body?.event === "string" ? req.body.event : "";
  const paymentId = typeof req.body?.payment?.id === "string" ? req.body.payment.id : "";
  if (!eventId || !eventType || !paymentId) {
    res.status(400).json({ error: "Evento inválido." });
    return;
  }
  if (!PAYMENT_EVENTS.has(eventType)) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  let payment;
  try {
    // O payload recebido não é prova suficiente de pagamento: consulta-se o
    // estado atual diretamente na API Asaas antes de alterar o registro local.
    payment = await getPayment(paymentId);
  } catch {
    res.status(503).json({ error: "Não foi possível validar o pagamento no Asaas." });
    return;
  }

  if (payment.id !== paymentId || !["CONFIRMED", "RECEIVED"].includes(payment.status)) {
    res.status(503).json({ error: "O Asaas ainda não confirmou o pagamento." });
    return;
  }
  if (!payment.externalReference || !Number.isFinite(payment.value)) {
    res.status(422).json({ error: "Pagamento sem referência ou valor válido." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<{
      id: number;
      order_number: string;
      total: string;
      asaas_charge_id: string | null;
    }>(
      `SELECT id, order_number, total, asaas_charge_id
       FROM orders
       WHERE order_number = $1
       FOR UPDATE`,
      [payment.externalReference],
    );
    const order = found.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      // Este endpoint também pode receber notificações de cobranças que não
      // pertencem ao marketplace. Confirmamos o recebimento sem armazenar PII.
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    if (order.asaas_charge_id && order.asaas_charge_id !== payment.id) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "A referência já está vinculada a outra cobrança." });
      return;
    }
    const expectedCents = Math.round(Number(order.total) * 100);
    const receivedCents = Math.round(payment.value * 100);
    if (!Number.isSafeInteger(expectedCents) || expectedCents !== receivedCents) {
      await client.query("ROLLBACK");
      res.status(422).json({ error: "O valor confirmado não corresponde ao pedido." });
      return;
    }

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO asaas_payment_events
         (provider_event_id, payment_id, event_type, order_id, outcome)
       VALUES ($1, $2, $3, $4, 'payment_confirmed')
       ON CONFLICT (provider_event_id) DO NOTHING
       RETURNING id`,
      [eventId, payment.id, eventType, order.id],
    );

    if (inserted.rows.length === 0) {
      await client.query("COMMIT");
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    await client.query(
      `UPDATE orders
       SET asaas_charge_id = $1,
           payment_status = 'paid',
           payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
           updated_at = now()
       WHERE id = $2`,
      [payment.id, order.id],
    );
    await client.query(
      "UPDATE asaas_payment_events SET processed_at = now() WHERE id = $1",
      [inserted.rows[0].id],
    );
    await client.query("COMMIT");
    res.status(200).json({ ok: true });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[asaas-webhook] falha ao processar evento de pagamento");
    res.status(503).json({ error: "Não foi possível processar o evento." });
  } finally {
    client.release();
  }
});

export default router;
