import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

router.post("/quotes", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Entre na sua conta para enviar a cotação." });
    return;
  }

  const { category, title, description, location, date, items } = req.body ?? {};
  if (!category || !title || !location || !Array.isArray(items) || items.length === 0) {
    res.status(422).json({ error: "Preencha categoria, título, região e pelo menos um item." });
    return;
  }

  const cleanItems = items
    .map((item: any) => ({
      quantity: Number(String(item.quantity ?? "1").replace(",", ".")) || 1,
      unit: String(item.unit ?? "un").slice(0, 30),
      description: String(item.description ?? "").trim().slice(0, 500),
      brand: String(item.brand ?? "").trim().slice(0, 120) || null,
      productId: item.productId ? String(item.productId).slice(0, 100) : null,
    }))
    .filter((item: any) => item.description);
  if (!cleanItems.length) {
    res.status(422).json({ error: "Adicione pelo menos um item válido." });
    return;
  }

  const searchable = cleanItems.map((item: any) => item.description).join(" ").slice(0, 1500);
  let vendorIds: string[] = [];
  try {
    const vendors = await vendorPool.query<{ id: string }>(
      `SELECT DISTINCT t.id
       FROM produtos_catalogo pc
       JOIN tenants t ON t.id = pc.tenant_id
       LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
       WHERE t.vende_no_praca_ai = true AND pc.ativo = true
         AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
         AND (
           lower(coalesce(cp.nome, '')) LIKE lower($1)
           OR to_tsvector('portuguese', coalesce(pc.nome, '') || ' ' || coalesce(pc.descricao, ''))
              @@ plainto_tsquery('portuguese', $2)
         )
       LIMIT 30`,
      [`%${String(category).slice(0, 120)}%`, searchable],
    );
    vendorIds = vendors.rows.map((row) => row.id);
  } catch (error) {
    console.error("[quotes] falha ao localizar fornecedores:", error);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const protocol = `COT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO quote_requests
       (protocol, consumer_id, category, title, description, location, needed_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [protocol, consumerId, String(category).slice(0, 120), String(title).slice(0, 200), description ? String(description).slice(0, 2000) : null, String(location).slice(0, 200), date || null, vendorIds.length ? "distribuida" : "aguardando_fornecedores"],
    );
    const quoteId = inserted.rows[0]!.id;
    for (const item of cleanItems) {
      await client.query(
        `INSERT INTO quote_request_items (quote_request_id, quantity, unit, description, brand, product_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [quoteId, item.quantity, item.unit, item.description, item.brand, item.productId],
      );
    }
    for (const vendorId of vendorIds) {
      await client.query(
        `INSERT INTO quote_recipients (quote_request_id, vendor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [quoteId, vendorId],
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ id: quoteId, protocol, recipients: vendorIds.length, status: vendorIds.length ? "distribuida" : "aguardando_fornecedores" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[quotes] erro ao criar solicitação:", error);
    res.status(500).json({ error: "Não foi possível registrar a cotação agora." });
  } finally {
    client.release();
  }
});

export default router;
