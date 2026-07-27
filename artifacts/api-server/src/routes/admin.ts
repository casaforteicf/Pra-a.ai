import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc } from "drizzle-orm";
import { db, ambassadorsTable, referralsTable, disputesTable, consumersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

export default router;
