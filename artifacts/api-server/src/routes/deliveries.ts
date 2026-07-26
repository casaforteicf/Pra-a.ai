import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, deliveriesTable, deliveryPartnersTable, ordersTable } from "@workspace/db";

const router: IRouter = Router();

/**
 * Matching básico: pega o primeiro parceiro motorista disponível na praça.
 * Sem otimização de rota/coleta múltipla ainda (seção 11/24.2 do plano) —
 * isso é significativamente mais complexo e fica pra uma próxima rodada.
 * Aqui só resolve "existe alguém pra aceitar essa entrega, sim ou não".
 */
async function encontrarParceiroDisponivel(praca: string) {
  const [partner] = await db
    .select()
    .from(deliveryPartnersTable)
    .where(and(eq(deliveryPartnersTable.praca, praca), eq(deliveryPartnersTable.status, "disponivel")))
    .limit(1);
  return partner ?? null;
}

router.post("/pedidos/:id/entrega", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orderId = parseInt(id, 10);
  const { vendorId } = req.body as { vendorId?: string };

  if (isNaN(orderId) || !vendorId) {
    res.status(400).json({ error: "Pedido e vendorId são obrigatórios." });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const partner = await encontrarParceiroDisponivel("Chapecó");

  const [delivery] = await db
    .insert(deliveriesTable)
    .values({
      orderId,
      vendorId,
      partnerId: partner?.id ?? null,
      status: partner ? "aceita" : "aguardando",
      aceitaEm: partner ? new Date() : null,
    })
    .returning();

  if (partner) {
    await db.update(deliveryPartnersTable).set({ status: "em_entrega" }).where(eq(deliveryPartnersTable.id, partner.id));
  }

  res.status(201).json(delivery);
});

router.patch("/entregas/:id/status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deliveryId = parseInt(id, 10);
  const { status } = req.body as { status?: string };

  const statusValidos = ["aceita", "coletada", "a_caminho", "entregue", "cancelada"];
  if (isNaN(deliveryId) || !status || !statusValidos.includes(status)) {
    res.status(400).json({ error: "Status inválido." });
    return;
  }

  const updates: Record<string, unknown> = { status };
  if (status === "coletada") updates.coletadaEm = new Date();
  if (status === "entregue") updates.entregueEm = new Date();

  const [delivery] = await db.update(deliveriesTable).set(updates).where(eq(deliveriesTable.id, deliveryId)).returning();
  if (!delivery) {
    res.status(404).json({ error: "Entrega não encontrada" });
    return;
  }

  // Reflete no status do pedido — a tela de rastreio (Sucesso, Meus Pedidos)
  // já lê orders.status hoje.
  if (status === "entregue") {
    await db.update(ordersTable).set({ status: "delivered" }).where(eq(ordersTable.id, delivery.orderId));
  } else if (status === "a_caminho") {
    await db.update(ordersTable).set({ status: "out_for_delivery" }).where(eq(ordersTable.id, delivery.orderId));
  }

  // Libera o parceiro motorista quando a entrega termina (ou é cancelada).
  if ((status === "entregue" || status === "cancelada") && delivery.partnerId) {
    await db.update(deliveryPartnersTable).set({ status: "disponivel" }).where(eq(deliveryPartnersTable.id, delivery.partnerId));
  }

  // TODO (documentado, não implementado nesta rodada): refletir esse status
  // também no deal do Vendor.ai (pipeline pós-venda, seção 11.7) — como o
  // deal foi criado direto via SQL (vendorSyncService), qualquer lógica de
  // transição de estágio que exista só em código Node do Vendor.ai não
  // dispara automaticamente daqui. Precisa confirmar isso quando o Agent
  // do Vendor.ai estiver disponível de novo.

  res.json(delivery);
});

router.get("/pedidos/:id/rastreio", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const [delivery] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.orderId, orderId)).limit(1);
  if (!delivery) {
    res.status(404).json({ error: "Nenhuma entrega associada a esse pedido ainda." });
    return;
  }

  res.json(delivery);
});

export default router;
