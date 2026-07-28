import { Router, type IRouter } from "express";
import { and, eq, desc, avg, count, inArray } from "drizzle-orm";
import { db, productReviewsTable, orderItemsTable, ordersTable, consumersTable, coinTransactionsTable, COIN_RULES } from "@workspace/db";

const router: IRouter = Router();

export async function getProductRatingSummary(productId: string): Promise<{ rating: number; reviewCount: number }> {
  const [summary] = await db
    .select({ avgNota: avg(productReviewsTable.nota), total: count() })
    .from(productReviewsTable)
    .where(eq(productReviewsTable.productId, productId));

  return {
    rating: summary?.avgNota ? Math.round(Number(summary.avgNota) * 10) / 10 : 0,
    reviewCount: Number(summary?.total ?? 0),
  };
}

/**
 * Versão em lote de getProductRatingSummary — usada pra enriquecer listas
 * de produto (catalogService.ts) sem fazer uma query por produto. Catálogo
 * e avaliação vivem em bancos diferentes (catalogService usa vendorPool,
 * direto no banco do Vendor.ai; isso aqui é o banco próprio do Praça.ai),
 * então o merge acontece em JS, não em SQL — não dá pra fazer join direto.
 */
export async function getRatingsForProducts(productIds: string[]): Promise<Map<string, { rating: number; reviewCount: number }>> {
  const map = new Map<string, { rating: number; reviewCount: number }>();
  if (productIds.length === 0) return map;

  const rows = await db
    .select({ productId: productReviewsTable.productId, avgNota: avg(productReviewsTable.nota), total: count() })
    .from(productReviewsTable)
    .where(inArray(productReviewsTable.productId, productIds))
    .groupBy(productReviewsTable.productId);

  for (const row of rows) {
    map.set(row.productId, {
      rating: row.avgNota ? Math.round(Number(row.avgNota) * 10) / 10 : 0,
      reviewCount: Number(row.total ?? 0),
    });
  }
  return map;
}

/**
 * Nota média agregada de TODOS os produtos vendidos por um lojista — join
 * de avaliações com o item de pedido correspondente (mesmo orderId +
 * productId) pra achar o vendorId, já que product_reviews não guarda isso
 * direto. Usada em stores.ts, que antes deixava rating sempre zerado.
 */
export async function getVendorRatingSummary(vendorId: string): Promise<{ rating: number; reviewCount: number }> {
  const [summary] = await db
    .select({ avgNota: avg(productReviewsTable.nota), total: count() })
    .from(productReviewsTable)
    .innerJoin(
      orderItemsTable,
      and(
        eq(orderItemsTable.orderId, productReviewsTable.orderId),
        eq(orderItemsTable.productId, productReviewsTable.productId),
      ),
    )
    .where(eq(orderItemsTable.vendorId, vendorId));

  return {
    rating: summary?.avgNota ? Math.round(Number(summary.avgNota) * 10) / 10 : 0,
    reviewCount: Number(summary?.total ?? 0),
  };
}

router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const reviews = await db
    .select({
      id: productReviewsTable.id,
      nota: productReviewsTable.nota,
      comentario: productReviewsTable.comentario,
      midiaUrls: productReviewsTable.midiaUrls,
      createdAt: productReviewsTable.createdAt,
      authorName: consumersTable.name,
    })
    .from(productReviewsTable)
    .innerJoin(consumersTable, eq(consumersTable.id, productReviewsTable.consumerId))
    .where(eq(productReviewsTable.productId, id))
    .orderBy(desc(productReviewsTable.createdAt));

  res.json(
    reviews.map((r) => ({
      id: String(r.id),
      authorName: r.authorName,
      authorAvatarUrl: null,
      rating: r.nota,
      comment: r.comentario ?? "",
      date: r.createdAt,
      verified: true, // toda avaliação aqui já passou por verificação de compra
      helpfulCount: 0,
      midiaUrls: r.midiaUrls ?? [],
    })),
  );
});

router.post("/products/:id/reviews", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login para avaliar o produto." });
    return;
  }

  const { orderId, nota, comentario, midiaUrls } = req.body as {
    orderId?: number;
    nota?: number;
    comentario?: string;
    midiaUrls?: string[];
  };

  if (!orderId || !nota || nota < 1 || nota > 5) {
    res.status(400).json({ error: "Informe o pedido e uma nota de 1 a 5." });
    return;
  }

  // Verificação de compra real: o pedido precisa ser desse consumidor,
  // conter esse produto, e já estar entregue.
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order || order.consumerId !== consumerId) {
    res.status(403).json({ error: "Pedido não encontrado ou não pertence a você." });
    return;
  }
  if (order.status !== "delivered") {
    res.status(409).json({ error: "Só é possível avaliar após o pedido ser entregue." });
    return;
  }

  const [orderItem] = await db
    .select()
    .from(orderItemsTable)
    .where(and(eq(orderItemsTable.orderId, orderId), eq(orderItemsTable.productId, id)))
    .limit(1);
  if (!orderItem) {
    res.status(403).json({ error: "Esse produto não está nesse pedido." });
    return;
  }

  const temMidia = Array.isArray(midiaUrls) && midiaUrls.length > 0;
  const moedasGanhas = temMidia ? COIN_RULES.AVALIACAO_COM_MIDIA : COIN_RULES.AVALIACAO_SEM_MIDIA;

  const [review] = await db
    .insert(productReviewsTable)
    .values({
      productId: id,
      orderId,
      consumerId,
      nota,
      comentario: comentario ?? null,
      midiaUrls: midiaUrls ?? [],
      moedasGanhas,
    })
    .returning();

  const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
  if (consumer) {
    await db
      .update(consumersTable)
      .set({ saldoMoedas: consumer.saldoMoedas + moedasGanhas })
      .where(eq(consumersTable.id, consumerId));
    await db.insert(coinTransactionsTable).values({
      consumerId,
      tipo: "ganho",
      quantidade: moedasGanhas,
      motivo: temMidia ? "avaliacao_com_midia" : "avaliacao",
    });
  }

  res.status(201).json({ ...review, moedasGanhas });
});

export default router;
