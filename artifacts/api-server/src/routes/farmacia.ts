import { Router, type IRouter } from "express";
import { db, consumersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listFarmaciaProdutos, getFarmaciaProdutoById } from "../lib/pharmacyService";
import { findOrCreateLead } from "../lib/vendorSyncService";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

router.get("/farmacia/produtos", async (req, res): Promise<void> => {
  const { categoria, nome } = req.query as { categoria?: string; nome?: string };
  const produtos = await listFarmaciaProdutos({ categoria, nome });
  res.json(produtos);
});

router.get("/farmacia/produtos/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const produto = await getFarmaciaProdutoById(id);
  if (!produto) {
    res.status(404).json({ error: "Produto não encontrado ou indisponível." });
    return;
  }
  res.json(produto);
});

// Pedido de farmácia não passa pelo carrinho/checkout normal — cada
// pedido é de uma farmácia só (carrinho multi-vendedor não se aplica
// aqui). Se algum item exige receita e nenhuma foi anexada (ainda não
// temos upload de imagem no Praça.ai — a farmácia pede a foto direto pelo
// WhatsApp depois), o pedido nasce em "aguardando_receita", igual à regra
// que já existe no Vendor.ai.
router.post("/farmacia/pedido", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId ?? null;
  const { produtoId, quantidade, enderecoEntrega, receitaUrl, guestName, guestPhone } = req.body as {
    produtoId?: string;
    quantidade?: number;
    enderecoEntrega?: string;
    receitaUrl?: string;
    guestName?: string;
    guestPhone?: string;
  };

  if (!produtoId || !quantidade || quantidade < 1) {
    res.status(400).json({ error: "Produto e quantidade são obrigatórios." });
    return;
  }
  if (!enderecoEntrega || !enderecoEntrega.trim()) {
    res.status(400).json({ error: "Endereço de entrega é obrigatório." });
    return;
  }

  const produto = await getFarmaciaProdutoById(produtoId);
  if (!produto) {
    res.status(404).json({ error: "Produto não encontrado ou indisponível." });
    return;
  }

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

  const temItemControlado = produto.exigeReceita;
  const status = temItemControlado && !receitaUrl ? "aguardando_receita" : "aguardando_confirmacao";
  const valorTotal = produto.preco * quantidade;

  const leadId = await findOrCreateLead(produto.vendorId, { nome, telefone, email: email ?? null, endereco: enderecoEntrega });

  const { rows } = await vendorPool.query(
    `INSERT INTO farmacia_pedidos (id, tenant_id, lead_id, origem, status, endereco_entrega, tem_item_controlado, receita_url, valor_total)
     VALUES (gen_random_uuid()::text, $1, $2, 'app', $3, $4, $5, $6, $7)
     RETURNING id, status`,
    [produto.vendorId, leadId, status, enderecoEntrega, temItemControlado, receitaUrl ?? null, valorTotal],
  );

  const pedidoId = rows[0].id;

  await vendorPool.query(
    `INSERT INTO farmacia_pedido_itens (id, pedido_id, produto_id, nome_produto, exige_receita, quantidade, preco_unitario, subtotal)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)`,
    [pedidoId, produto.id, produto.nome, produto.exigeReceita, quantidade, produto.preco, valorTotal],
  );

  res.status(201).json({
    pedido: { id: pedidoId, status: rows[0].status, valorTotal },
    precisaReceita: status === "aguardando_receita",
    vendorName: produto.vendorName,
  });
});

export default router;
