import { Router, type IRouter } from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { sendChatMessage } from "../lib/vendorSyncService";
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
  const todayInBrazil = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (date && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T12:00:00Z")) ||
      new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date || date < todayInBrazil)) {
    res.status(422).json({ error: "Informe uma data de compra válida, de hoje em diante." });
    return;
  }

  if (ADDRESS_PATTERN.test(String(location)) || [category, title, description, location].some((value) => typeof value === "string" && CONTACT_PATTERN.test(value)) ||
      items.some((item: any) => [item?.description, item?.brand].some((value) => typeof value === "string" && CONTACT_PATTERN.test(value)))) {
    res.status(422).json({ error: "Informe apenas cidade ou região e não inclua telefone, e-mail ou endereço completo." });
    return;
  }

  const cleanItems = items
    .map((item: any) => ({
      quantity: Number(String(item.quantity ?? "1").replace(",", ".")),
      unit: String(item.unit ?? "un").slice(0, 30),
      description: String(item.description ?? "").trim().slice(0, 500),
      brand: String(item.brand ?? "").trim().slice(0, 120) || null,
      productId: item.productId ? String(item.productId).slice(0, 100) : null,
    }))
    .filter((item: any) => item.description && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 1_000_000);
  if (!cleanItems.length) {
    res.status(422).json({ error: "Adicione pelo menos um item válido." });
    return;
  }

  try {
    const privateText = [category, title, description, location, ...cleanItems.flatMap((item: any) => [item.description, item.brand])];
    if (await buyerNameAppears(consumerId, privateText)) {
      res.status(422).json({ error: "Remova seu nome dos detalhes; sua identificação será compartilhada com a loja apenas após aceitar uma proposta." });
      return;
    }
  } catch (error) {
    console.error("[quotes] não foi possível validar dados privados:", error);
    res.status(500).json({ error: "Não foi possível validar a cotação agora." });
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
    const recent = await client.query("SELECT COUNT(*)::int AS total FROM quote_requests WHERE consumer_id=$1 AND created_at>now()-interval '24 hours'", [consumerId]);
    if (Number(recent.rows[0]?.total ?? 0) >= 5) {
      await client.query("ROLLBACK");
      res.status(429).json({ error: "Você atingiu o limite de cinco cotações por dia. Tente novamente amanhã." });
      return;
    }
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
    const crmResults = await Promise.allSettled(vendorIds.map((vendorId) => notifyQuoteLead(quoteId, vendorId)));
    const crmFailures = crmResults.filter((result) => result.status === "rejected").length;
    if (crmFailures) console.error("[quotes] CRM notification pending for " + crmFailures + " vendor(s).");
    res.status(201).json({
      id: quoteId, protocol, recipients: vendorIds.length,
      status: vendorIds.length ? "distribuida" : "aguardando_fornecedores",
      crmPending: crmFailures,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[quotes] erro ao criar solicitação:", error);
    res.status(500).json({ error: "Não foi possível registrar a cotação agora." });
  } finally {
    client.release();
  }
});

export default router;


const CONTACT_PATTERN = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){10,})/i;
const ADDRESS_PATTERN = /\b(rua|avenida|av\.|rodovia|travessa|bairro|apartamento|apto|cep|casa|quadra|lote)\b|\b\d{5}-?\d{3}\b/i;
let directQuoteTablesReady: Promise<void> | null = null;

function ensureDirectQuoteTables(): Promise<void> {
  if (!directQuoteTablesReady) {
    directQuoteTablesReady = pool.query(`
      CREATE TABLE IF NOT EXISTS quote_offers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_request_id uuid NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
        vendor_id text NOT NULL,
        freight numeric(12,2) NOT NULL DEFAULT 0 CHECK (freight >= 0),
        delivery_days integer NOT NULL DEFAULT 0 CHECK (delivery_days >= 0),
        terms text,
        status text NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada','aceita','recusada')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        accepted_at timestamptz,
        UNIQUE (quote_request_id, vendor_id)
      );
      CREATE INDEX IF NOT EXISTS idx_quote_offers_request ON quote_offers(quote_request_id, created_at);
      CREATE TABLE IF NOT EXISTS quote_offer_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        offer_id uuid NOT NULL REFERENCES quote_offers(id) ON DELETE CASCADE,
        request_item_id uuid NOT NULL REFERENCES quote_request_items(id) ON DELETE CASCADE,
        unit_price numeric(12,2) NOT NULL CHECK (unit_price > 0),
        UNIQUE (offer_id, request_item_id)
      );
      CREATE TABLE IF NOT EXISTS quote_vendor_leads (
        quote_request_id uuid NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
        vendor_id text NOT NULL,
        crm_lead_id uuid NOT NULL,
        crm_notified boolean NOT NULL DEFAULT false,
        identity_revealed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (quote_request_id, vendor_id)
      );
    `).then(() => undefined).catch((error) => { directQuoteTablesReady = null; throw error; });
  }
  return directQuoteTablesReady;
}

function validVendorToken(req: any, res: any): boolean {
  const expected = process.env.PRACA_ROUNDS_VENDOR_TOKEN;
  const supplied = req.header("x-praca-rounds-token");
  if (!expected || expected.length < 32) {
    res.status(503).json({ error: "Integração com lojistas indisponível." });
    return false;
  }
  if (typeof supplied !== "string") {
    res.status(401).json({ error: "Acesso não autorizado." });
    return false;
  }
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Acesso não autorizado." });
    return false;
  }
  return true;
}

function consumerId(req: any): number | null {
  const id = Number(req.session?.consumerId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizePrivateText(value: string): string {
  return value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function buyerNameAppears(consumer: number, values: unknown[]): Promise<boolean> {
  const result = await pool.query<{ name: string | null }>("SELECT name FROM consumers WHERE id=$1", [consumer]);
  const buyerName = normalizePrivateText(String(result.rows[0]?.name ?? ""));
  if (buyerName.length < 8 || buyerName.split(" ").filter(Boolean).length < 2) return false;
  const phrase = " " + buyerName + " ";
  return values.some((value) => typeof value === "string" && (" " + normalizePrivateText(value) + " ").includes(phrase));
}

function numberValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

async function ensureQuoteLead(quoteId: string, vendorId: string): Promise<{ leadId: string; notified: boolean; revealedAt: string | null }> {
  await ensureDirectQuoteTables();
  const map = await pool.query(
    "INSERT INTO quote_vendor_leads(quote_request_id,vendor_id,crm_lead_id) VALUES($1,$2,$3) ON CONFLICT(quote_request_id,vendor_id) DO UPDATE SET vendor_id=EXCLUDED.vendor_id RETURNING crm_lead_id,crm_notified,identity_revealed_at",
    [quoteId, vendorId, randomUUID()],
  );
  const leadId = String(map.rows[0].crm_lead_id);
  await vendorPool.query(
    "INSERT INTO leads(id,tenant_id,nome,telefone,email,endereco,source,status,tipo) VALUES($1,$2,$3,NULL,NULL,NULL,'praca_ai_cotacao','novo','cliente') ON CONFLICT(id) DO NOTHING",
    [leadId, vendorId, "Cotação anônima Praça.ai"],
  );
  return { leadId, notified: Boolean(map.rows[0].crm_notified), revealedAt: map.rows[0].identity_revealed_at };
}

async function notifyQuoteLead(quoteId: string, vendorId: string, revealBuyer = false): Promise<void> {
  const lead = await ensureQuoteLead(quoteId, vendorId);
  const quote = await pool.query(
    "SELECT q.protocol,q.category,q.title,q.location,q.needed_at,c.name,c.email,c.phone FROM quote_requests q JOIN consumers c ON c.id=q.consumer_id WHERE q.id=$1",
    [quoteId],
  );
  if (!quote.rows[0]) return;
  const row = quote.rows[0];
  const items = await pool.query("SELECT quantity,unit,description FROM quote_request_items WHERE quote_request_id=$1 ORDER BY id", [quoteId]);
  const demand = [
    "Cotação " + row.protocol + " — " + row.category + ": " + row.title,
    ...items.rows.map((item: any) => `• ${item.quantity} ${item.unit} — ${item.description}`),
    "Região: " + row.location,
    row.needed_at ? "Data desejada: " + new Date(row.needed_at).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
  ].filter(Boolean).join("\n");
  if (revealBuyer) {
    if (lead.revealedAt) return;
    await vendorPool.query(
      "UPDATE leads SET nome=$3,telefone=$4,email=$5,source='praca_ai_cotacao' WHERE id=$1 AND tenant_id=$2",
      [lead.leadId, vendorId, row.name, row.phone, row.email],
    );
    await sendChatMessage({
      tenantId: vendorId, leadId: lead.leadId,
      conteudo: "Praça.ai — o comprador aceitou sua proposta. Cliente: " + row.name +
        (row.phone ? " · Telefone: " + row.phone : "") + (row.email ? " · E-mail: " + row.email : "") +
        ". Formalize pagamento e entrega com o cliente.\n" + demand,
    });
    await pool.query("UPDATE quote_vendor_leads SET identity_revealed_at=COALESCE(identity_revealed_at,now()),crm_notified=true WHERE quote_request_id=$1 AND vendor_id=$2", [quoteId, vendorId]);
  } else if (!lead.notified) {
    await sendChatMessage({
      tenantId: vendorId, leadId: lead.leadId,
      conteudo: "Praça.ai — nova cotação direta. Envie sua proposta pelo AppVendor.ai. Nome e contato do comprador ficam ocultos até o aceite.\\n" + demand,
    });
    await pool.query("UPDATE quote_vendor_leads SET crm_notified=true WHERE quote_request_id=$1 AND vendor_id=$2", [quoteId, vendorId]);
  }
}

async function quoteItems(quoteId: string) {
  const result = await pool.query(
    "SELECT id,quantity::text,unit,description,brand,product_id FROM quote_request_items WHERE quote_request_id=$1 ORDER BY id",
    [quoteId],
  );
  return result.rows.map((item: any) => ({
    id: item.id, quantity: Number(item.quantity), unit: item.unit,
    description: item.description, brand: item.brand, productId: item.product_id,
  }));
}

router.get("/quotes", async (req, res): Promise<void> => {
  const buyer = consumerId(req);
  if (!buyer) return void res.status(401).json({ error: "Entre na sua conta para acompanhar cotações." });
  try {
    await ensureDirectQuoteTables();
    const result = await pool.query(
      "SELECT id,protocol,category,title,location,needed_at,status,created_at FROM quote_requests WHERE consumer_id=$1 ORDER BY created_at DESC LIMIT 100",
      [buyer],
    );
    res.set("Cache-Control", "no-store").json(result.rows.map((row: any) => ({
      id: row.id, protocol: row.protocol, category: row.category, title: row.title,
      location: row.location, neededAt: row.needed_at, status: row.status, createdAt: row.created_at,
    })));
  } catch (error) {
    console.error("[quotes] list failed:", error);
    res.status(500).json({ error: "Não foi possível carregar suas cotações." });
  }
});

router.get("/quotes/:id", async (req, res): Promise<void> => {
  const buyer = consumerId(req);
  if (!buyer) return void res.status(401).json({ error: "Entre na sua conta para acompanhar cotações." });
  try {
    await ensureDirectQuoteTables();
    const result = await pool.query(
      "SELECT id,protocol,consumer_id,category,title,description,location,needed_at,status,created_at FROM quote_requests WHERE id=$1 AND consumer_id=$2",
      [req.params.id, buyer],
    );
    const quote = result.rows[0];
    if (!quote) return void res.status(404).json({ error: "Cotação não encontrada." });
    const accepted = quote.status === "aceita";
    if (accepted) {
      const winner = await pool.query("SELECT vendor_id FROM quote_offers WHERE quote_request_id=$1 AND status='aceita' LIMIT 1", [quote.id]);
      if (winner.rows[0]) {
        try { await notifyQuoteLead(quote.id, String(winner.rows[0].vendor_id), true); }
        catch (error) { console.error("[quotes] pending CRM identity release retry failed:", error); }
      }
    }
    const offers = await pool.query(
      `SELECT o.id,o.freight::text,o.delivery_days,o.terms,o.status,o.created_at,
              COALESCE(sum(oi.unit_price * qi.quantity),0)::numeric(12,2)::text AS subtotal,
              CASE WHEN $2::boolean THEN o.vendor_id ELSE NULL END AS vendor_id
       FROM quote_offers o
       LEFT JOIN quote_offer_items oi ON oi.offer_id=o.id
       LEFT JOIN quote_request_items qi ON qi.id=oi.request_item_id
       WHERE o.quote_request_id=$1 AND o.status <> 'recusada'
       GROUP BY o.id ORDER BY (sum(oi.unit_price * qi.quantity)+o.freight) ASC,o.created_at ASC`,
      [quote.id, accepted],
    );
    const visibleOffers = [];
    for (const offer of offers.rows) {
      let vendor = null;
      if (accepted && offer.status === "aceita" && offer.vendor_id) {
        const store = await vendorPool.query("SELECT id,nome_empresa FROM tenants WHERE id=$1 AND vende_no_praca_ai=true", [offer.vendor_id]);
        if (store.rows[0]) vendor = { id: store.rows[0].id, name: store.rows[0].nome_empresa };
      }
      const itemPrices = await pool.query("SELECT oi.request_item_id,oi.unit_price::text,qi.quantity::text,qi.unit,qi.description FROM quote_offer_items oi JOIN quote_request_items qi ON qi.id=oi.request_item_id WHERE oi.offer_id=$1 ORDER BY qi.id", [offer.id]);
      visibleOffers.push({
        id: offer.id, subtotal: Number(offer.subtotal), freight: Number(offer.freight),
        total: Number(offer.subtotal) + Number(offer.freight), deliveryDays: Number(offer.delivery_days),
        terms: offer.terms, status: offer.status, createdAt: offer.created_at, vendor,
        items: itemPrices.rows.map((item) => ({ itemId: item.request_item_id, unitPrice: Number(item.unit_price), quantity: Number(item.quantity), unit: item.unit, description: item.description })),
      });
    }
    res.set("Cache-Control", "no-store").json({
      id: quote.id, protocol: quote.protocol, category: quote.category, title: quote.title,
      description: quote.description, location: quote.location, neededAt: quote.needed_at,
      status: quote.status, createdAt: quote.created_at, items: await quoteItems(quote.id),
      offers: visibleOffers,
    });
  } catch (error) {
    console.error("[quotes] detail failed:", error);
    res.status(500).json({ error: "Não foi possível carregar as propostas agora." });
  }
});

router.post("/quotes/:id/accept", async (req, res): Promise<void> => {
  const buyer = consumerId(req);
  if (!buyer) return void res.status(401).json({ error: "Entre na sua conta para aceitar uma proposta." });
  const offerId = String(req.body?.offerId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(offerId)) return void res.status(422).json({ error: "Selecione uma proposta válida." });
  const client = await pool.connect();
  let vendorId = "";
  try {
    await ensureDirectQuoteTables();
    await client.query("BEGIN");
    const locked = await client.query("SELECT id,status FROM quote_requests WHERE id=$1 AND consumer_id=$2 FOR UPDATE", [req.params.id, buyer]);
    if (!locked.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Cotação não encontrada." }); }
    if (locked.rows[0].status === "aceita") { await client.query("ROLLBACK"); return void res.status(409).json({ error: "Você já aceitou uma proposta desta cotação." }); }
    const selected = await client.query("SELECT id,vendor_id FROM quote_offers WHERE id=$1 AND quote_request_id=$2 AND status='enviada' FOR UPDATE", [offerId, req.params.id]);
    if (!selected.rows[0]) { await client.query("ROLLBACK"); return void res.status(409).json({ error: "Esta proposta não está mais disponível." }); }
    vendorId = String(selected.rows[0].vendor_id);
    await client.query("UPDATE quote_offers SET status=CASE WHEN id=$2 THEN 'aceita' ELSE 'recusada' END,accepted_at=CASE WHEN id=$2 THEN now() ELSE accepted_at END,updated_at=now() WHERE quote_request_id=$1", [req.params.id, offerId]);
    await client.query("UPDATE quote_requests SET status='aceita' WHERE id=$1", [req.params.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[quotes] accept failed:", error);
    return void res.status(500).json({ error: "Não foi possível aceitar essa proposta agora." });
  } finally { client.release(); }
  try { await notifyQuoteLead(req.params.id, vendorId, true); }
  catch (error) { console.error("[quotes] accepted quote CRM reveal failed:", error); }
  res.json({ status: "aceita", vendorId });
});

router.get("/internal/quotes", async (req, res): Promise<void> => {
  if (!validVendorToken(req, res)) return;
  const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId.trim() : "";
  if (!tenantId) return void res.status(422).json({ error: "Loja inválida." });
  try {
    await ensureDirectQuoteTables();
    const result = await pool.query(
      `SELECT q.id,q.protocol,q.category,q.title,q.description,q.location,q.needed_at,q.created_at,
              o.id AS offer_id,o.freight::text,o.delivery_days,o.terms,
              COALESCE(sum(oi.unit_price * qi.quantity),0)::numeric(12,2)::text AS subtotal
       FROM quote_recipients r JOIN quote_requests q ON q.id=r.quote_request_id
       LEFT JOIN quote_offers o ON o.quote_request_id=q.id AND o.vendor_id=r.vendor_id AND o.status='enviada'
       LEFT JOIN quote_offer_items oi ON oi.offer_id=o.id
       LEFT JOIN quote_request_items qi ON qi.id=oi.request_item_id
       WHERE r.vendor_id=$1 AND q.status IN ('distribuida','aguardando_fornecedores')
       GROUP BY q.id,o.id ORDER BY q.needed_at NULLS LAST,q.created_at DESC LIMIT 100`,
      [tenantId],
    );
    const opportunities = [];
    for (const row of result.rows) {
      const items = await quoteItems(row.id);
      const lead = await ensureQuoteLead(row.id, tenantId);
      if (!lead.notified) {
        try { await notifyQuoteLead(row.id, tenantId); } catch (error) { console.error("[quotes] CRM lead notification failed:", error); }
      }
      opportunities.push({
        id: row.id, protocol: row.protocol, category: row.category, title: row.title,
        description: row.description, location: row.location, neededAt: row.needed_at,
        createdAt: row.created_at, items, myOffer: row.offer_id ? {
          id: row.offer_id, subtotal: Number(row.subtotal), freight: Number(row.freight),
          deliveryDays: Number(row.delivery_days), terms: row.terms,
        } : null,
      });
    }
    res.set("Cache-Control", "no-store").json(opportunities);
  } catch (error) {
    console.error("[quotes] internal list failed:", error);
    res.status(500).json({ error: "Não foi possível carregar as cotações agora." });
  }
});

router.post("/internal/quotes/:id/offers", async (req, res): Promise<void> => {
  if (!validVendorToken(req, res)) return;
  const tenantId = String(req.body?.tenantId ?? "").trim();
  if (!tenantId) return void res.status(422).json({ error: "Loja inválida." });
  const itemOffers = req.body?.items;
  const freight = numberValue(req.body?.freight ?? 0);
  const deliveryDays = Number(req.body?.deliveryDays ?? 0);
  const terms = typeof req.body?.terms === "string" ? req.body.terms.trim().slice(0, 1200) : "";
  if (!Array.isArray(itemOffers) || itemOffers.length === 0 || itemOffers.length > 100 ||
      freight === null || freight < 0 || !Number.isInteger(deliveryDays) || deliveryDays < 0 || deliveryDays > 365 ||
      CONTACT_PATTERN.test(terms)) {
    return void res.status(422).json({ error: "Revise itens, frete, prazo e observações. Não inclua telefone ou e-mail." });
  }
  const normalized = itemOffers.map((item: any) => ({
    itemId: String(item.itemId ?? ""), unitPrice: numberValue(item.unitPrice),
  }));
  if (normalized.some((item: any) => !/^[0-9a-f-]{36}$/i.test(item.itemId) || item.unitPrice === null || item.unitPrice <= 0)) {
    return void res.status(422).json({ error: "Informe um preço válido para cada item." });
  }
  const uniqueIds = new Set(normalized.map((item: any) => item.itemId));
  if (uniqueIds.size !== normalized.length) return void res.status(422).json({ error: "A proposta contém itens repetidos." });
  const client = await pool.connect();
  try {
    await ensureDirectQuoteTables();
    await client.query("BEGIN");
    const quote = await client.query(
      "SELECT q.id,q.status FROM quote_requests q JOIN quote_recipients r ON r.quote_request_id=q.id WHERE q.id=$1 AND r.vendor_id=$2 FOR UPDATE OF q",
      [req.params.id, tenantId],
    );
    if (!quote.rows[0] || !["distribuida","aguardando_fornecedores"].includes(String(quote.rows[0].status))) {
      await client.query("ROLLBACK"); return void res.status(404).json({ error: "Cotação encerrada ou indisponível para sua loja." });
    }
    const requested = await client.query("SELECT id FROM quote_request_items WHERE quote_request_id=$1", [req.params.id]);
    const requestedIds = new Set(requested.rows.map((item: any) => String(item.id)));
    if (requestedIds.size !== uniqueIds.size || [...uniqueIds].some((id) => !requestedIds.has(id))) {
      await client.query("ROLLBACK"); return void res.status(422).json({ error: "A proposta precisa cobrir todos os itens solicitados." });
    }
    const upsert = await client.query(
      "INSERT INTO quote_offers(quote_request_id,vendor_id,freight,delivery_days,terms) VALUES($1,$2,$3,$4,$5) ON CONFLICT(quote_request_id,vendor_id) DO UPDATE SET freight=EXCLUDED.freight,delivery_days=EXCLUDED.delivery_days,terms=EXCLUDED.terms,updated_at=now() WHERE quote_offers.status='enviada' RETURNING id",
      [req.params.id, tenantId, freight, deliveryDays, terms || null],
    );
    if (!upsert.rows[0]) { await client.query("ROLLBACK"); return void res.status(409).json({ error: "A cotação já foi encerrada." }); }
    const offerId = String(upsert.rows[0].id);
    await client.query("DELETE FROM quote_offer_items WHERE offer_id=$1", [offerId]);
    for (const item of normalized) {
      await client.query("INSERT INTO quote_offer_items(offer_id,request_item_id,unit_price) VALUES($1,$2,$3)", [offerId, item.itemId, item.unitPrice]);
    }
    await client.query("COMMIT");
    await ensureQuoteLead(req.params.id, tenantId);
    res.status(201).json({ offerId, status: "enviada" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[quotes] vendor offer failed:", error);
    res.status(500).json({ error: "Não foi possível enviar a proposta agora." });
  } finally { client.release(); }
});

export default router;
