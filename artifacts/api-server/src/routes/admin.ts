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

router.get("/admin/marketplace-disputas", async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const allowed = ["aberta", "em_analise", "aguardando_comprador", "resolvida", "rejeitada"];
  if (status && !allowed.includes(status)) return void res.status(422).json({ error: "Filtro de status inválido." });
  const result = await pool.query(
    `SELECT d.id,d.order_type,d.order_id,d.reason_code,d.description,d.evidence_url,d.status,d.vendor_response,d.vendor_responded_at,
            (SELECT e.note FROM praca_order_dispute_events e WHERE e.dispute_id=d.id AND e.actor_type='buyer'
             AND e.from_status='aguardando_comprador' ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS buyer_response,
            d.resolution_text,d.created_at,d.updated_at,d.resolved_at,d.vendor_id,
            c.name AS buyer_name,c.email AS buyer_email,
            COALESCE(q.protocol,r.code) AS order_code,
            COALESCE(q.title,r.item_name) AS item_title,
            COALESCE(q.location,concat(r.city,', ',r.state)) AS location
     FROM praca_order_disputes d
     JOIN consumers c ON c.id=d.consumer_id
     LEFT JOIN quote_requests q ON d.order_type='quote' AND q.id=d.order_id
     LEFT JOIN buying_round_orders o ON d.order_type='round' AND o.id=d.order_id
     LEFT JOIN buying_rounds r ON r.id=o.round_id
     WHERE ($1='' OR d.status=$1)
     ORDER BY CASE WHEN d.status IN ('aberta','em_analise','aguardando_comprador') THEN 0 ELSE 1 END,
              d.created_at DESC LIMIT 300`,
    [status],
  );
  res.set("Cache-Control", "no-store").json(result.rows);
});

router.patch("/admin/marketplace-disputas/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const status = String(req.body?.status ?? "");
  const note = typeof req.body?.resolutionText === "string" ? req.body.resolutionText.trim().slice(0, 3000) : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["em_analise", "aguardando_comprador", "resolvida", "rejeitada"].includes(status)) {
    return void res.status(422).json({ error: "Atualização de disputa inválida." });
  }
  if (["aguardando_comprador", "resolvida", "rejeitada"].includes(status) && note.length < 8) {
    return void res.status(422).json({ error: "Registre uma observação antes de solicitar resposta ou concluir a disputa." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT status FROM praca_order_disputes WHERE id=$1 FOR UPDATE", [id]);
    if (!existing.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Disputa não encontrada." }); }
    const fromStatus = String(existing.rows[0].status);
    if (["resolvida", "rejeitada"].includes(fromStatus)) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Uma disputa concluída não pode ser alterada." });
    }
    const allowedTransitions: Record<string, string[]> = {
      aberta: ["em_analise"],
      em_analise: ["aguardando_comprador", "resolvida", "rejeitada"],
      aguardando_comprador: ["em_analise", "resolvida", "rejeitada"],
    };
    if (!(allowedTransitions[fromStatus] ?? []).includes(status)) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Transição de status inválida para esta disputa." });
    }
    const updated = await client.query(
      `UPDATE praca_order_disputes SET status=$2,resolution_text=$3,updated_at=now(),
         resolved_at=CASE WHEN $2 IN ('resolvida','rejeitada') THEN now() ELSE NULL END
       WHERE id=$1 RETURNING id,status,resolution_text,updated_at,resolved_at`,
      [id, status, note || null],
    );
    await client.query(
      `INSERT INTO praca_order_dispute_events(dispute_id,from_status,to_status,actor_type,note)
       VALUES($1,$2,$3,'admin',$4)`,
      [id, fromStatus, status, note || null],
    );
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[admin] marketplace dispute update failed:", error);
    res.status(500).json({ error: "Não foi possível atualizar a disputa." });
  } finally { client.release(); }
});

router.get("/admin/marketplace-cancelamentos", async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const allowed = ["solicitada", "em_analise", "atendida", "recusada"];
  if (status && !allowed.includes(status)) return void res.status(422).json({ error: "Filtro de status inválido." });
  const result = await pool.query(
    `SELECT x.id,x.order_type,x.order_id,x.reason,x.description,x.status,x.resolution_note,x.created_at,x.updated_at,x.resolved_at,
            x.vendor_id,c.name AS buyer_name,c.email AS buyer_email,
            COALESCE(q.protocol,r.code) AS order_code,
            COALESCE(q.title,r.item_name) AS item_title,
            COALESCE(q.location,concat(r.city,', ',r.state)) AS location
       FROM praca_order_cancellations x
       JOIN consumers c ON c.id=x.consumer_id
       LEFT JOIN quote_requests q ON x.order_type='quote' AND q.id=x.order_id
       LEFT JOIN buying_round_orders o ON x.order_type='round' AND o.id=x.order_id
       LEFT JOIN buying_rounds r ON r.id=o.round_id
      WHERE ($1='' OR x.status=$1)
      ORDER BY CASE WHEN x.status IN ('solicitada','em_analise') THEN 0 ELSE 1 END,x.created_at DESC
      LIMIT 300`, [status],
  );
  res.set("Cache-Control", "no-store").json(result.rows);
});

router.patch("/admin/marketplace-cancelamentos/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? ""), status = String(req.body?.status ?? "");
  const note = typeof req.body?.resolutionNote === "string" ? req.body.resolutionNote.trim().slice(0, 2000) : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["em_analise", "atendida", "recusada"].includes(status)) {
    return void res.status(422).json({ error: "Atualização de solicitação inválida." });
  }
  if (["atendida", "recusada"].includes(status) && note.length < 8) {
    return void res.status(422).json({ error: "Registre o resultado do atendimento antes de concluir a solicitação." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT status FROM praca_order_cancellations WHERE id=$1 FOR UPDATE", [id]);
    if (!existing.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Solicitação não encontrada." }); }
    const fromStatus = String(existing.rows[0].status);
    const transitions: Record<string, string[]> = { solicitada: ["em_analise"], em_analise: ["atendida", "recusada"] };
    if (!(transitions[fromStatus] ?? []).includes(status)) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Esta solicitação já foi concluída ou a transição não é permitida." });
    }
    const updated = await client.query(
      `UPDATE praca_order_cancellations SET status=$2,resolution_note=$3,updated_at=now(),
         resolved_at=CASE WHEN $2 IN ('atendida','recusada') THEN now() ELSE NULL END
       WHERE id=$1 RETURNING id,status,resolution_note,updated_at,resolved_at`, [id, status, note || null],
    );
    await client.query(
      `INSERT INTO praca_order_cancellation_events(cancellation_id,from_status,to_status,actor_type,note)
       VALUES($1,$2,$3,'admin',$4)`, [id, fromStatus, status, note || null],
    );
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[admin] marketplace cancellation update failed:", error);
    res.status(500).json({ error: "Não foi possível atualizar a solicitação." });
  } finally { client.release(); }
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

export default router;
