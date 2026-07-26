import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, disputesTable, ordersTable } from "@workspace/db";

const router: IRouter = Router();

const MOTIVOS_ERRO_LOJISTA = new Set(["defeito", "produto_errado"]);

router.post("/orders/:id/disputa", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const { motivo, descricao, evidenciaUrl } = req.body as {
    motivo?: string;
    descricao?: string;
    evidenciaUrl?: string;
  };

  if (!motivo || !descricao) {
    res.status(400).json({ error: "Informe o motivo e a descrição da disputa." });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const consumerId = req.session?.consumerId ?? null;
  const shippingValue = Number(order.shipping ?? 0);

  // Regra decidida: custo do frete de devolução nunca fica com o cliente.
  const isErroLojista = MOTIVOS_ERRO_LOJISTA.has(motivo);
  const freteDevolucaoResponsavel = isErroLojista ? "lojista" : "rateado";
  const freteDevolucaoValorVendedor = isErroLojista ? shippingValue : Math.round((shippingValue / 2) * 100) / 100;
  const freteDevolucaoValorEntregador = isErroLojista ? 0 : Math.round((shippingValue / 2) * 100) / 100;

  const [dispute] = await db
    .insert(disputesTable)
    .values({
      orderId,
      consumerId,
      motivo,
      descricao,
      evidenciaUrl: evidenciaUrl ?? null,
      status: "aberta",
      freteDevolucaoResponsavel,
      freteDevolucaoValorVendedor: String(freteDevolucaoValorVendedor),
      freteDevolucaoValorEntregador: String(freteDevolucaoValorEntregador),
    })
    .returning();

  res.status(201).json(dispute);
});

router.get("/disputas/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const disputeId = parseInt(id, 10);
  if (isNaN(disputeId)) {
    res.status(404).json({ error: "Disputa não encontrada" });
    return;
  }

  const [dispute] = await db.select().from(disputesTable).where(eq(disputesTable.id, disputeId)).limit(1);
  if (!dispute) {
    res.status(404).json({ error: "Disputa não encontrada" });
    return;
  }

  res.json(dispute);
});

// Uso interno/admin — sem tela de administração própria ainda; endpoint pronto
// pra quando o painel de suporte existir.
router.patch("/disputas/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const disputeId = parseInt(id, 10);
  if (isNaN(disputeId)) {
    res.status(404).json({ error: "Disputa não encontrada" });
    return;
  }

  const { status, resolucaoTexto } = req.body as { status?: string; resolucaoTexto?: string };
  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (resolucaoTexto) updates.resolucaoTexto = resolucaoTexto;
  if (status === "resolvida") updates.resolvidoEm = new Date();

  const [updated] = await db
    .update(disputesTable)
    .set(updates)
    .where(eq(disputesTable.id, disputeId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Disputa não encontrada" });
    return;
  }

  res.json(updated);
});

export default router;
