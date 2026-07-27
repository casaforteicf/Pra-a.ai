import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ambassadorsTable, referralsTable, REFERRAL_COMMISSION } from "@workspace/db";
import crypto from "crypto";

const router: IRouter = Router();

function gerarCodigo(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

router.post("/embaixadores", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login para virar embaixador." });
    return;
  }

  const [existing] = await db.select().from(ambassadorsTable).where(eq(ambassadorsTable.consumerId, consumerId)).limit(1);
  if (existing) {
    res.json(existing);
    return;
  }

  let codigo = gerarCodigo();
  // Garante unicidade (raro colidir, mas confere antes de inserir)
  for (let tentativas = 0; tentativas < 5; tentativas++) {
    const [taken] = await db.select().from(ambassadorsTable).where(eq(ambassadorsTable.codigo, codigo)).limit(1);
    if (!taken) break;
    codigo = gerarCodigo();
  }

  const [ambassador] = await db.insert(ambassadorsTable).values({ consumerId, codigo }).returning();
  res.status(201).json(ambassador);
});

router.get("/embaixadores/me", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login." });
    return;
  }

  const [ambassador] = await db.select().from(ambassadorsTable).where(eq(ambassadorsTable.consumerId, consumerId)).limit(1);
  if (!ambassador) {
    res.status(404).json({ error: "Você ainda não é embaixador. Cadastre-se primeiro." });
    return;
  }

  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.ambassadorId, ambassador.id));

  res.json({ ...ambassador, referrals });
});

// Chamado pelo frontend logo após um cadastro feito via link de indicação
// (?ref=CODIGO). Registra a indicação como "pendente" até a conversão real
// (primeiro pedido do indicado, verificado no checkout).
router.post("/embaixadores/indicar", async (req, res): Promise<void> => {
  const { codigo, indicadoConsumerId, indicadoTenantId } = req.body as {
    codigo?: string;
    indicadoConsumerId?: number;
    indicadoTenantId?: string;
  };

  if (!codigo || (!indicadoConsumerId && !indicadoTenantId)) {
    res.status(400).json({ error: "Código de indicação e (consumidor ou tenant) são obrigatórios." });
    return;
  }

  const [ambassador] = await db.select().from(ambassadorsTable).where(eq(ambassadorsTable.codigo, codigo)).limit(1);
  if (!ambassador || ambassador.status !== "ativo") {
    res.status(404).json({ error: "Código de indicação inválido." });
    return;
  }

  if (indicadoConsumerId && ambassador.consumerId === indicadoConsumerId) {
    res.status(400).json({ error: "Você não pode se autoindicar." });
    return;
  }

  const [referral] = await db
    .insert(referralsTable)
    .values({
      ambassadorId: ambassador.id,
      indicadoTipo: indicadoTenantId ? "lojista" : "cliente",
      indicadoConsumerId: indicadoConsumerId ?? null,
      indicadoTenantId: indicadoTenantId ?? null,
      status: "pendente",
    })
    .returning();

  res.status(201).json(referral);
});

/**
 * Confirma a conversão de uma indicação de LOJISTA (primeira venda do
 * tenant indicado fechada). Endpoint stateless — chamado pelo Vendor.ai
 * quando um deal fecha 'ganho' pela primeira vez pra um tenant, sem o
 * Vendor.ai precisar saber nada sobre embaixador/indicação (só manda o
 * tenantId, a lógica de achar a indicação pendente fica aqui).
 */
router.post("/embaixadores/confirmar-conversao-lojista", async (req, res): Promise<void> => {
  const { tenantId } = req.body as { tenantId?: string };
  if (!tenantId) {
    res.status(400).json({ error: "tenantId é obrigatório." });
    return;
  }

  const [referral] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.indicadoTenantId, tenantId), eq(referralsTable.status, "pendente")))
    .limit(1);

  if (!referral) {
    res.json({ converted: false, reason: "Nenhuma indicação pendente pra esse tenant." });
    return;
  }

  const valor = REFERRAL_COMMISSION.LOJISTA_PRIMEIRA_VENDA;
  await db
    .update(referralsTable)
    .set({ status: "convertido", valorComissao: String(valor), convertidoEm: new Date() })
    .where(eq(referralsTable.id, referral.id));

  const [ambassador] = await db.select().from(ambassadorsTable).where(eq(ambassadorsTable.id, referral.ambassadorId)).limit(1);
  if (ambassador) {
    await db
      .update(ambassadorsTable)
      .set({ saldoComissao: String(Number(ambassador.saldoComissao) + valor) })
      .where(eq(ambassadorsTable.id, ambassador.id));
  }

  res.json({ converted: true, valorComissao: valor });
});

/**
 * Confirma a conversão de uma indicação de cliente (primeiro pedido feito).
 * Chamado internamente pelo checkout (orders.ts) — não é endpoint público.
 */
export async function confirmarConversaoCliente(consumerId: number): Promise<void> {
  const [referral] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.indicadoConsumerId, consumerId), eq(referralsTable.status, "pendente")))
    .limit(1);

  if (!referral) return;

  const valor = REFERRAL_COMMISSION.CLIENTE_PRIMEIRO_PEDIDO;
  await db
    .update(referralsTable)
    .set({ status: "convertido", valorComissao: String(valor), convertidoEm: new Date() })
    .where(eq(referralsTable.id, referral.id));

  const [ambassador] = await db.select().from(ambassadorsTable).where(eq(ambassadorsTable.id, referral.ambassadorId)).limit(1);
  if (ambassador) {
    await db
      .update(ambassadorsTable)
      .set({ saldoComissao: String(Number(ambassador.saldoComissao) + valor) })
      .where(eq(ambassadorsTable.id, ambassador.id));
  }
}

export default router;
