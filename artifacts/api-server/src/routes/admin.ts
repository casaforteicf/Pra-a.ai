import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc, and } from "drizzle-orm";
import { db, ambassadorsTable, referralsTable, disputesTable, consumersTable, vendorPayoutsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { vendorPool } from "../lib/vendorDb";
import { pool } from "@workspace/db";

const router: IRouter = Router();

/**
 * Autenticação de admin — medida provisória real, não sistema completo.
 * Praça.ai não tem conta de admin própria (login, perfis, auditoria por
 * usuário) ainda — construir isso é decisão maior que exige credencial e
 * definição de quem tem acesso, não algo pra decidir sozinho no código.
 *
 * Isso aqui fecha o buraco real que existia (qualquer um com a URL
 * acessava sem barreira nenhuma): agora exige uma chave secreta
 * compartilhada via header, configurada como PRACA_ADMIN_API_KEY nos
 * Secrets do Replit. Não é rastreável por usuário — é um perímetro, não
 * uma conta. Quando existir tela de admin de verdade, isso deve ser
 * substituído por login + sessão própria.
 */
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = process.env.PRACA_ADMIN_API_KEY;
  if (!configuredKey) {
    // Sem chave configurada, os endpoints ficam bloqueados por padrão —
    // nunca abertos "por esquecimento" de configurar o secret.
    res.status(503).json({ error: "Admin API não configurada (PRACA_ADMIN_API_KEY ausente)." });
    return;
  }

  const providedKey = req.header("x-admin-key");
  if (providedKey !== configuredKey) {
    res.status(401).json({ error: "Chave de admin inválida ou ausente." });
    return;
  }

  next();
}

// Escopo restrito a /admin/* — sem isso, esse middleware bloqueava
// (por engano) TODAS as rotas registradas depois dele no index.ts,
// incluindo veículos/imóveis/farmácia/restaurantes/serviços/fretes, já
// que router.use(fn) sem path aplica pra qualquer requisição que passe
// por esse router, não só as que batem com uma rota definida nele.
router.use("/admin", requireAdminKey);

router.get("/admin/embaixadores", async (_req, res): Promise<void> => {
  const ambassadors = await db
    .select({
      id: ambassadorsTable.id,
      codigo: ambassadorsTable.codigo,
      saldoComissao: ambassadorsTable.saldoComissao,
      status: ambassadorsTable.status,
      createdAt: ambassadorsTable.createdAt,
      nome: consumersTable.name,
      email: consumersTable.email,
    })
    .from(ambassadorsTable)
    .innerJoin(consumersTable, eq(consumersTable.id, ambassadorsTable.consumerId))
    .orderBy(desc(ambassadorsTable.createdAt));

  res.json(ambassadors);
});

router.get("/admin/embaixadores/:id/indicacoes", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const ambassadorId = parseInt(id, 10);
  if (isNaN(ambassadorId)) {
    res.status(404).json({ error: "Embaixador não encontrado" });
    return;
  }

  const referrals = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.ambassadorId, ambassadorId))
    .orderBy(desc(referralsTable.createdAt));

  res.json(referrals);
});

router.patch("/admin/embaixadores/:id/status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const ambassadorId = parseInt(id, 10);
  const { status } = req.body as { status?: string };

  if (isNaN(ambassadorId) || !["ativo", "bloqueado"].includes(status ?? "")) {
    res.status(400).json({ error: "Status inválido." });
    return;
  }

  const [updated] = await db
    .update(ambassadorsTable)
    .set({ status })
    .where(eq(ambassadorsTable.id, ambassadorId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Embaixador não encontrado" });
    return;
  }

  res.json(updated);
});

router.get("/admin/disputas", async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  const disputas = status
    ? await db.select().from(disputesTable).where(eq(disputesTable.status, status)).orderBy(desc(disputesTable.createdAt))
    : await db.select().from(disputesTable).orderBy(desc(disputesTable.createdAt));

  res.json(disputas);
});

/**
 * Razão de repasses por lojista — ver lib/db/src/schema/vendorPayouts.ts.
 * Não é split automático (sem subconta Asaas por lojista ainda): isso
 * aqui só mostra quanto cada um tem a receber, pra você repassar
 * manualmente por fora (PIX/transferência) e depois marcar como pago.
 */
router.get("/admin/repasses/resumo", async (_req, res): Promise<void> => {
  const rows = await db.select().from(vendorPayoutsTable);

  const porVendedor = new Map<string, { vendorId: string; pendente: number; pago: number; qtdPedidosPendentes: number }>();
  for (const row of rows) {
    const entry = porVendedor.get(row.vendorId) ?? { vendorId: row.vendorId, pendente: 0, pago: 0, qtdPedidosPendentes: 0 };
    if (row.status === "pendente") {
      entry.pendente += Number(row.valorLiquido);
      entry.qtdPedidosPendentes += 1;
    } else {
      entry.pago += Number(row.valorLiquido);
    }
    porVendedor.set(row.vendorId, entry);
  }

  const vendorIds = [...porVendedor.keys()];
  let nomes: Record<string, string> = {};
  if (vendorIds.length > 0) {
    const { rows: tenantRows } = await vendorPool.query<{ id: string; nome_empresa: string }>(
      `SELECT id, nome_empresa FROM tenants WHERE id = ANY($1)`,
      [vendorIds],
    );
    nomes = Object.fromEntries(tenantRows.map((t) => [t.id, t.nome_empresa]));
  }

  const resultado = [...porVendedor.values()]
    .map((v) => ({ ...v, nomeEmpresa: nomes[v.vendorId] ?? v.vendorId }))
    .sort((a, b) => b.pendente - a.pendente);

  res.json(resultado);
});

router.get("/admin/repasses/:vendorId", async (req, res): Promise<void> => {
  const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
  const { status } = req.query as { status?: string };

  const conditions = [eq(vendorPayoutsTable.vendorId, vendorId)];
  if (status) conditions.push(eq(vendorPayoutsTable.status, status));

  const repasses = await db
    .select()
    .from(vendorPayoutsTable)
    .where(and(...conditions))
    .orderBy(desc(vendorPayoutsTable.createdAt));

  res.json(repasses);
});

router.patch("/admin/repasses/:vendorId/marcar-pago", async (req, res): Promise<void> => {
  const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;

  const updated = await db
    .update(vendorPayoutsTable)
    .set({ status: "pago", pagoEm: new Date() })
    .where(and(eq(vendorPayoutsTable.vendorId, vendorId), eq(vendorPayoutsTable.status, "pendente")))
    .returning();

  res.json({ marcados: updated.length, repasses: updated });
});

/**
 * Comissão por loja — edição direta, pra ajustar conforme a demanda (sem
 * precisar de deploy). Lê/escreve direto em tenants.comissao_praca_ai_
 * percentual (tabela do Vendor.ai, mesmo banco físico).
 */
router.get("/admin/lojas", async (_req, res): Promise<void> => {
  const { rows } = await vendorPool.query<{ id: string; nome_empresa: string; comissao_praca_ai_percentual: string | null }>(
    `SELECT id, nome_empresa, comissao_praca_ai_percentual FROM tenants WHERE vende_no_praca_ai = true ORDER BY nome_empresa`,
  );
  res.json(rows.map((r) => ({
    vendorId: r.id,
    nomeEmpresa: r.nome_empresa,
    comissaoPercentual: Number(r.comissao_praca_ai_percentual ?? 8),
  })));
});

router.patch("/admin/lojas/:vendorId/comissao", async (req, res): Promise<void> => {
  const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
  const { comissaoPercentual } = req.body as { comissaoPercentual?: number };

  if (typeof comissaoPercentual !== "number" || comissaoPercentual < 0 || comissaoPercentual > 100) {
    res.status(400).json({ error: "Comissão precisa ser um número entre 0 e 100." });
    return;
  }

  const { rowCount } = await vendorPool.query(
    `UPDATE tenants SET comissao_praca_ai_percentual = $1 WHERE id = $2`,
    [comissaoPercentual, vendorId],
  );

  if (rowCount === 0) {
    res.status(404).json({ error: "Loja não encontrada." });
    return;
  }

  res.json({ vendorId, comissaoPercentual });
});


// Indicadores agregados do marketplace, cotações e rodadas.
// Nenhum identificador de comprador ou lojista é retornado por este endpoint.
router.get("/admin/inteligencia", async (req, res): Promise<void> => {
  const allowedDays = new Set([7, 30, 90, 365]);
  const requestedDays = Number(req.query.days ?? 30);
  const days = allowedDays.has(requestedDays) ? requestedDays : 30;

  try {
    const tables = await pool.query<{
      quotes: string | null;
      recipients: string | null;
      offers: string | null;
      rounds: string | null;
      participants: string | null;
      bids: string | null;
      roundOrders: string | null;
    }>(`SELECT
      to_regclass('public.quote_requests')::text AS quotes,
      to_regclass('public.quote_recipients')::text AS recipients,
      to_regclass('public.quote_offers')::text AS offers,
      to_regclass('public.buying_rounds')::text AS rounds,
      to_regclass('public.buying_round_participants')::text AS participants,
      to_regclass('public.buying_round_bids')::text AS bids,
      to_regclass('public.buying_round_orders')::text AS "roundOrders"`);

    const present = tables.rows[0] ?? {};
    const quoteTablesReady = Boolean(present.quotes && present.recipients && present.offers);
    const roundsReady = Boolean(present.rounds && present.participants && present.bids && present.roundOrders);

    let quotes = { total: 0, awaitingSuppliers: 0, withOffers: 0, accepted: 0, unanswered: 0, offers: 0, averageFirstResponseHours: null as number | null };
    let coverage = { vendorsReceivingQuotes: 0, vendorsSendingOffers: 0, vendorsBiddingRounds: 0 };
    let rounds = { open: 0, closed: 0, noOffers: 0, participants: 0, bids: 0, buyerAccepted: 0, buyerDeclined: 0 };
    const categoryRows: Array<{ category: string; total: number }> = [];

    if (quoteTablesReady) {
      const result = await pool.query(`
        WITH period_quotes AS (
          SELECT q.id, q.category, q.status, q.created_at
          FROM quote_requests q
          WHERE q.created_at >= now() - ($1::int * interval '1 day')
        ),
        offer_counts AS (
          SELECT o.quote_request_id, count(*)::int AS n,
                 min(o.created_at) AS first_offer_at
          FROM quote_offers o
          JOIN period_quotes q ON q.id = o.quote_request_id
          GROUP BY o.quote_request_id
        ),
        recipient_counts AS (
          SELECT r.quote_request_id, count(*)::int AS n
          FROM quote_recipients r
          JOIN period_quotes q ON q.id = r.quote_request_id
          GROUP BY r.quote_request_id
        )
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE q.status = 'aguardando_fornecedores')::int AS "awaitingSuppliers",
          count(*) FILTER (WHERE coalesce(o.n, 0) > 0)::int AS "withOffers",
          count(*) FILTER (WHERE q.status = 'aceita')::int AS accepted,
          count(*) FILTER (WHERE coalesce(o.n, 0) = 0)::int AS unanswered,
          coalesce(sum(o.n), 0)::int AS offers,
          round(avg(extract(epoch FROM (o.first_offer_at - q.created_at)) / 3600)::numeric, 1)::float8 AS "averageFirstResponseHours"
        FROM period_quotes q
        LEFT JOIN offer_counts o ON o.quote_request_id = q.id
        LEFT JOIN recipient_counts r ON r.quote_request_id = q.id
      `, [days]);
      const row = result.rows[0] ?? {};
      quotes = {
        total: Number(row.total ?? 0),
        awaitingSuppliers: Number(row.awaitingSuppliers ?? 0),
        withOffers: Number(row.withOffers ?? 0),
        accepted: Number(row.accepted ?? 0),
        unanswered: Number(row.unanswered ?? 0),
        offers: Number(row.offers ?? 0),
        averageFirstResponseHours: row.averageFirstResponseHours == null ? null : Number(row.averageFirstResponseHours),
      };

      const coverageResult = await pool.query(`
        WITH period_quotes AS (
          SELECT id FROM quote_requests WHERE created_at >= now() - ($1::int * interval '1 day')
        )
        SELECT
          (SELECT count(DISTINCT r.vendor_id)::int FROM quote_recipients r JOIN period_quotes q ON q.id=r.quote_request_id) AS "vendorsReceivingQuotes",
          (SELECT count(DISTINCT o.vendor_id)::int FROM quote_offers o JOIN period_quotes q ON q.id=o.quote_request_id) AS "vendorsSendingOffers"
      `, [days]);
      coverage.vendorsReceivingQuotes = Number(coverageResult.rows[0]?.vendorsReceivingQuotes ?? 0);
      coverage.vendorsSendingOffers = Number(coverageResult.rows[0]?.vendorsSendingOffers ?? 0);

      const cats = await pool.query<{ category: string; total: number }>(`
        SELECT category, count(*)::int AS total
        FROM quote_requests
        WHERE created_at >= now() - ($1::int * interval '1 day')
        GROUP BY category
      `, [days]);
      categoryRows.push(...cats.rows.map((row) => ({ category: String(row.category), total: Number(row.total) })));
    }

    if (roundsReady) {
      const result = await pool.query(`
        SELECT
          count(*) FILTER (WHERE r.status='open' AND r.closes_at > now())::int AS open,
          count(*) FILTER (WHERE r.status='closed')::int AS closed,
          count(*) FILTER (WHERE r.status='no_offers')::int AS "noOffers",
          coalesce(sum(p.participants),0)::int AS participants,
          coalesce(sum(b.bids),0)::int AS bids,
          coalesce(sum(o.buyer_accepted),0)::int AS "buyerAccepted",
          coalesce(sum(o.buyer_declined),0)::int AS "buyerDeclined"
        FROM buying_rounds r
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS participants FROM buying_round_participants p WHERE p.round_id=r.id
        ) p ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS bids FROM buying_round_bids b WHERE b.round_id=r.id
        ) b ON true
        LEFT JOIN LATERAL (
          SELECT count(*) FILTER (WHERE status IN ('awaiting_payment','paid'))::int AS buyer_accepted,
                 count(*) FILTER (WHERE status='declined')::int AS buyer_declined
          FROM buying_round_orders o WHERE o.round_id=r.id
        ) o ON true
        WHERE r.created_at >= now() - ($1::int * interval '1 day')
      `, [days]);
      const row = result.rows[0] ?? {};
      rounds = {
        open: Number(row.open ?? 0), closed: Number(row.closed ?? 0), noOffers: Number(row.noOffers ?? 0),
        participants: Number(row.participants ?? 0), bids: Number(row.bids ?? 0),
        buyerAccepted: Number(row.buyerAccepted ?? 0), buyerDeclined: Number(row.buyerDeclined ?? 0),
      };

      const vendorCount = await pool.query<{ total: number }>(`
        SELECT count(DISTINCT b.vendor_id)::int AS total
        FROM buying_round_bids b
        JOIN buying_rounds r ON r.id=b.round_id
        WHERE r.created_at >= now() - ($1::int * interval '1 day')
      `, [days]);
      coverage.vendorsBiddingRounds = Number(vendorCount.rows[0]?.total ?? 0);

      const cats = await pool.query<{ category: string; total: number }>(`
        SELECT category, count(*)::int AS total FROM buying_rounds
        WHERE created_at >= now() - ($1::int * interval '1 day')
        GROUP BY category
      `, [days]);
      categoryRows.push(...cats.rows.map((row) => ({ category: String(row.category), total: Number(row.total) })));
    }

    const knownCategories = new Map<string, string>([
      ["cimento e agregados", "Cimento e agregados"],
      ["tijolos e blocos", "Tijolos e blocos"],
      ["elétrica e iluminação", "Elétrica e iluminação"],
      ["eletrica e iluminacao", "Elétrica e iluminação"],
      ["telhas e cobertura", "Telhas e cobertura"],
      ["telhas e estrutura de telhado", "Telhas e cobertura"],
      ["hidráulica e conexões", "Hidráulica e conexões"],
      ["hidraulica e conexoes", "Hidráulica e conexões"],
      ["construção e reforma", "Construção e reforma"],
      ["construcao e reforma", "Construção e reforma"],
      ["materiais de construção", "Materiais de construção"],
      ["materiais de construcao", "Materiais de construção"],
      ["ferramentas", "Ferramentas"],
      ["casa e decoração", "Casa e decoração"],
      ["casa e decoracao", "Casa e decoração"],
      ["móveis", "Móveis"],
      ["moveis", "Móveis"],
      ["informática e eletrônicos", "Informática e eletrônicos"],
      ["informatica e eletronicos", "Informática e eletrônicos"],
      ["imóveis", "Imóveis"],
      ["imoveis", "Imóveis"],
      ["veículos", "Veículos"],
      ["veiculos", "Veículos"],
      ["serviços", "Serviços"],
      ["servicos", "Serviços"],
    ]);
    const normalizeCategory = (value: string) => value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();
    const categories = new Map<string, number>();
    for (const row of categoryRows) {
      const category = knownCategories.get(normalizeCategory(row.category)) ?? "Outros segmentos";
      categories.set(category, (categories.get(category) ?? 0) + row.total);
    }
    const demandByCategory = [...categories.entries()]
      .filter(([, total]) => total >= 5)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    res.set("Cache-Control", "no-store").json({
      days,
      generatedAt: new Date().toISOString(),
      privacy: { aggregateOnly: true, categoryMinimum: 5 },
      quotes,
      rounds,
      coverage,
      demandByCategory,
    });
  } catch (error) {
    console.error("[admin] intelligence metrics failed:", error);
    res.status(500).json({ error: "Não foi possível carregar os indicadores de inteligência." });
  }
});

export default router;
