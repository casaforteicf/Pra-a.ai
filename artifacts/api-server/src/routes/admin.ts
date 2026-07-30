import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc, and } from "drizzle-orm";
import { db, ambassadorsTable, referralsTable, disputesTable, consumersTable, vendorPayoutsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { vendorPool } from "../lib/vendorDb";

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

router.use(requireAdminKey);

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

export default router;
