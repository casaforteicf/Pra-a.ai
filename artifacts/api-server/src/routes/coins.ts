import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, consumersTable, coinTransactionsTable, COIN_RULES } from "@workspace/db";

const router: IRouter = Router();

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

router.get("/moedas", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login para ver suas moedas." });
    return;
  }

  const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
  if (!consumer) {
    res.status(404).json({ error: "Consumidor não encontrado" });
    return;
  }

  const transacoes = await db
    .select()
    .from(coinTransactionsTable)
    .where(eq(coinTransactionsTable.consumerId, consumerId))
    .orderBy(desc(coinTransactionsTable.createdAt))
    .limit(50);

  res.json({ saldo: consumer.saldoMoedas, transacoes });
});

router.post("/moedas/checkin", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login para fazer check-in." });
    return;
  }

  const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
  if (!consumer) {
    res.status(404).json({ error: "Consumidor não encontrado" });
    return;
  }

  if (consumer.ultimoCheckinEm === todayStr()) {
    res.status(409).json({ error: "Você já fez check-in hoje. Volte amanhã!", saldo: consumer.saldoMoedas });
    return;
  }

  const novoSaldo = consumer.saldoMoedas + COIN_RULES.CHECKIN_DIARIO;
  await db
    .update(consumersTable)
    .set({ saldoMoedas: novoSaldo, ultimoCheckinEm: todayStr() })
    .where(eq(consumersTable.id, consumerId));

  await db.insert(coinTransactionsTable).values({
    consumerId,
    tipo: "ganho",
    quantidade: COIN_RULES.CHECKIN_DIARIO,
    motivo: "checkin",
  });

  res.json({ saldo: novoSaldo, ganho: COIN_RULES.CHECKIN_DIARIO });
});

router.post("/moedas/resgatar", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login para resgatar moedas." });
    return;
  }

  const { quantidade } = req.body as { quantidade?: number };
  if (!quantidade || quantidade <= 0) {
    res.status(400).json({ error: "Informe a quantidade de moedas a resgatar." });
    return;
  }

  const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
  if (!consumer) {
    res.status(404).json({ error: "Consumidor não encontrado" });
    return;
  }

  if (consumer.saldoMoedas < quantidade) {
    res.status(400).json({ error: "Saldo insuficiente.", saldo: consumer.saldoMoedas });
    return;
  }

  const novoSaldo = consumer.saldoMoedas - quantidade;
  await db.update(consumersTable).set({ saldoMoedas: novoSaldo }).where(eq(consumersTable.id, consumerId));

  await db.insert(coinTransactionsTable).values({
    consumerId,
    tipo: "resgate",
    quantidade,
    motivo: "resgate_cupom",
  });

  // Conversão simples: 100 moedas = R$ 1 de desconto. Calibrar depois —
  // não gera cupom real no sistema de cupons ainda (coupons.ts é fixo por
  // enquanto), só retorna o valor equivalente pro frontend aplicar.
  const valorDesconto = Math.round((quantidade / 100) * 100) / 100;

  res.json({ saldo: novoSaldo, valorDesconto });
});

export default router;
