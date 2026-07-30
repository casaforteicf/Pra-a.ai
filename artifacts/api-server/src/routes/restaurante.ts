import { Router, type IRouter } from "express";
import { db, consumersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listRestaurantes, listCardapio, getCardapioItemById } from "../lib/restaurantService";
import { findOrCreateLead } from "../lib/vendorSyncService";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

router.get("/restaurantes", async (_req, res): Promise<void> => {
  const restaurantes = await listRestaurantes();
  res.json(restaurantes);
});

router.get("/restaurantes/:vendorId/cardapio", async (req, res): Promise<void> => {
  const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
  const cardapio = await listCardapio({ vendorId });
  res.json(cardapio);
});

// Pedido de restaurante é sempre de um restaurante só (carrinho
// multi-vendedor não se aplica aqui) — corpo já vem com os itens (id do
// item do cardápio + quantidade), diferente do carrinho persistente
// normal do Praça.ai.
router.post("/restaurante/pedido", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId ?? null;
  const { itens, enderecoEntrega, observacoes, guestName, guestPhone } = req.body as {
    itens?: { cardapioItemId: string; quantidade: number; observacao?: string }[];
    enderecoEntrega?: string;
    observacoes?: string;
    guestName?: string;
    guestPhone?: string;
  };

  if (!itens || itens.length === 0) {
    res.status(400).json({ error: "Carrinho vazio." });
    return;
  }
  if (!enderecoEntrega || !enderecoEntrega.trim()) {
    res.status(400).json({ error: "Endereço de entrega é obrigatório." });
    return;
  }

  const itemsResolved = await Promise.all(itens.map((i) => getCardapioItemById(i.cardapioItemId)));
  const missing = itemsResolved.findIndex((r) => r === null);
  if (missing !== -1) {
    res.status(409).json({ error: "Algum item do pedido não está mais disponível." });
    return;
  }

  const vendorIds = new Set(itemsResolved.map((i) => i!.vendorId));
  if (vendorIds.size > 1) {
    res.status(400).json({ error: "Todos os itens precisam ser do mesmo restaurante." });
    return;
  }
  const vendorId = [...vendorIds][0]!;
  const vendorName = itemsResolved[0]!.vendorName;

  let nome = guestName?.trim();
  let telefone = guestPhone?.trim();
  let email: string | undefined;

  if (consumerId) {
    const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
    if (consumer) {
      nome = consumer.name;
      telefone = consumer.phone ?? undefined;
      email = consumer.email;
    }
  }

  if (!nome || !telefone) {
    res.status(400).json({ error: "Nome e telefone são obrigatórios pra fazer o pedido." });
    return;
  }

  const valorTotal = itemsResolved.reduce((sum, item, idx) => sum + item!.preco * itens[idx]!.quantidade, 0);

  const leadId = await findOrCreateLead(vendorId, { nome, telefone, email: email ?? null, endereco: enderecoEntrega });

  const { rows } = await vendorPool.query(
    `INSERT INTO restaurante_pedidos (id, tenant_id, lead_id, origem, status, endereco_entrega, observacoes, valor_total)
     VALUES (gen_random_uuid()::text, $1, $2, 'app', 'aguardando_confirmacao', $3, $4, $5)
     RETURNING id, status`,
    [vendorId, leadId, enderecoEntrega, observacoes ?? null, valorTotal],
  );

  const pedidoId = rows[0].id;

  for (let i = 0; i < itens.length; i++) {
    const item = itemsResolved[i]!;
    const solicitado = itens[i]!;
    await vendorPool.query(
      `INSERT INTO restaurante_pedido_itens (id, pedido_id, cardapio_item_id, nome_item, observacao_item, quantidade, preco_unitario, subtotal)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)`,
      [pedidoId, item.id, item.nome, solicitado.observacao ?? null, solicitado.quantidade, item.preco, item.preco * solicitado.quantidade],
    );
  }

  res.status(201).json({ pedido: { id: pedidoId, status: rows[0].status, valorTotal }, vendorName });
});

export default router;
