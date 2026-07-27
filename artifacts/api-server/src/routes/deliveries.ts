import { Router, type IRouter } from "express";
import { eq, and, inArray, ne, sql } from "drizzle-orm";
import { db, deliveriesTable, deliveryPartnersTable, ordersTable } from "@workspace/db";

const router: IRouter = Router();

// Limite realista de encomendas simultâneas por parceiro motorista (moto/
// carro não carrega infinitas entregas de uma vez).
const MAX_ENTREGAS_SIMULTANEAS = 3;
const STATUS_ATIVOS = ["aceita", "coletada", "a_caminho"] as const;

function extrairCidade(deliveryAddressJson: string): string | null {
  try {
    const addr = JSON.parse(deliveryAddressJson);
    return typeof addr?.city === "string" ? addr.city.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Matching por carga + agrupamento por região: entre os parceiros não
 * offline com menos de MAX_ENTREGAS_SIMULTANEAS entregas ativas, prioriza
 * quem já está com uma entrega ativa pra MESMA cidade de destino (evita
 * mandar dois motoristas pro mesmo bairro enquanto outro fica ocioso do
 * outro lado da praça) — depois desempata pelo parceiro com MENOS entregas
 * ativas no momento (balanceamento de carga, não sempre o primeiro
 * cadastrado).
 *
 * Ainda não é roteirização real por distância (sem chave de geocoding,
 * mesma limitação já documentada em freteService.ts) — é aproximação por
 * cidade + carga, mas já resolve os dois problemas reais do matching
 * anterior: nunca balanceava carga, e nunca agrupava por região.
 */
async function encontrarParceiroOtimo(praca: string, cidadeDestino: string | null) {
  const candidatos = await db
    .select()
    .from(deliveryPartnersTable)
    .where(and(eq(deliveryPartnersTable.praca, praca), ne(deliveryPartnersTable.status, "offline")));

  if (candidatos.length === 0) return null;

  const entregasAtivas = await db
    .select({
      partnerId: deliveriesTable.partnerId,
      orderId: deliveriesTable.orderId,
    })
    .from(deliveriesTable)
    .where(inArray(deliveriesTable.status, STATUS_ATIVOS as unknown as string[]));

  // Carrega o endereço de cada pedido em rota, pra saber a cidade de cada
  // entrega ativa por parceiro.
  const orderIds = [...new Set(entregasAtivas.map((e) => e.orderId))];
  const orders = orderIds.length
    ? await db.select({ id: ordersTable.id, deliveryAddress: ordersTable.deliveryAddress })
        .from(ordersTable).where(inArray(ordersTable.id, orderIds))
    : [];
  const cidadePorOrder = new Map(orders.map((o) => [o.id, extrairCidade(o.deliveryAddress)]));

  const cargaPorParceiro = new Map<number, { total: number; mesmaCidade: boolean }>();
  for (const partner of candidatos) {
    cargaPorParceiro.set(partner.id, { total: 0, mesmaCidade: false });
  }
  for (const entrega of entregasAtivas) {
    if (entrega.partnerId == null || !cargaPorParceiro.has(entrega.partnerId)) continue;
    const info = cargaPorParceiro.get(entrega.partnerId)!;
    info.total += 1;
    if (cidadeDestino && cidadePorOrder.get(entrega.orderId) === cidadeDestino) {
      info.mesmaCidade = true;
    }
  }

  const disponiveis = candidatos.filter((p) => (cargaPorParceiro.get(p.id)?.total ?? 0) < MAX_ENTREGAS_SIMULTANEAS);
  if (disponiveis.length === 0) return null;

  disponiveis.sort((a, b) => {
    const ca = cargaPorParceiro.get(a.id)!;
    const cb = cargaPorParceiro.get(b.id)!;
    if (ca.mesmaCidade !== cb.mesmaCidade) return ca.mesmaCidade ? -1 : 1; // mesma cidade primeiro
    return ca.total - cb.total; // menos carregado primeiro
  });

  return disponiveis[0];
}

router.post("/pedidos/:id/entrega", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orderId = parseInt(id, 10);
  const { vendorId, supportPointId } = req.body as { vendorId?: string; supportPointId?: number };

  if (isNaN(orderId) || !vendorId) {
    res.status(400).json({ error: "Pedido e vendorId são obrigatórios." });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const cidadeDestino = extrairCidade(order.deliveryAddress);
  const partner = await encontrarParceiroOtimo("Chapecó", cidadeDestino);

  const [delivery] = await db
    .insert(deliveriesTable)
    .values({
      orderId,
      vendorId,
      partnerId: partner?.id ?? null,
      supportPointId: supportPointId ?? null,
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

  // Libera o parceiro motorista só quando ele não tem MAIS NENHUMA entrega
  // ativa — agora que um parceiro pode carregar até MAX_ENTREGAS_SIMULTANEAS
  // ao mesmo tempo, marcar 'disponivel' de volta na primeira entrega
  // concluída soltaria ele mesmo com outras encomendas ainda na mão.
  if ((status === "entregue" || status === "cancelada") && delivery.partnerId) {
    const [{ restantes }] = await db
      .select({ restantes: sql<number>`count(*)` })
      .from(deliveriesTable)
      .where(and(eq(deliveriesTable.partnerId, delivery.partnerId), inArray(deliveriesTable.status, STATUS_ATIVOS as unknown as string[])));

    if (Number(restantes) === 0) {
      await db.update(deliveryPartnersTable).set({ status: "disponivel" }).where(eq(deliveryPartnersTable.id, delivery.partnerId));
    }
  }

  // TODO (documentado, não implementado nesta rodada): refletir esse status
  // também no deal do Vendor.ai (pipeline pós-venda, seção 11.7) — como o
  // deal foi criado direto via SQL (vendorSyncService), qualquer lógica de
  // transição de estágio que exista só em código Node do Vendor.ai não
  // dispara automaticamente daqui. Precisa confirmar isso quando o Agent
  // do Vendor.ai estiver disponível de novo.

  res.json(delivery);
});

// Tenta de novo o matching de uma entrega presa em 'aguardando' (nenhum
// parceiro disponível no momento da criação) — sem isso, ficava parada pra
// sempre sem ninguém tentar de novo.
router.post("/entregas/:id/tentar-atribuir", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deliveryId = parseInt(id, 10);
  if (isNaN(deliveryId)) {
    res.status(404).json({ error: "Entrega não encontrada" });
    return;
  }

  const [delivery] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, deliveryId)).limit(1);
  if (!delivery) {
    res.status(404).json({ error: "Entrega não encontrada" });
    return;
  }
  if (delivery.status !== "aguardando") {
    res.status(409).json({ error: "Essa entrega já tem parceiro atribuído ou não está mais aguardando." });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, delivery.orderId)).limit(1);
  const cidadeDestino = order ? extrairCidade(order.deliveryAddress) : null;
  const partner = await encontrarParceiroOtimo("Chapecó", cidadeDestino);

  if (!partner) {
    res.status(200).json({ ...delivery, atribuido: false });
    return;
  }

  const [updated] = await db
    .update(deliveriesTable)
    .set({ partnerId: partner.id, status: "aceita", aceitaEm: new Date() })
    .where(eq(deliveriesTable.id, deliveryId))
    .returning();

  await db.update(deliveryPartnersTable).set({ status: "em_entrega" }).where(eq(deliveryPartnersTable.id, partner.id));

  res.json({ ...updated, atribuido: true });
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
