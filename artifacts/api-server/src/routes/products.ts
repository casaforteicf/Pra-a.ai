import { Router, type IRouter } from "express";
import { vendorPool } from "../lib/vendorDb";
import { mapCatalogRow, getProductById } from "../lib/catalogService";
import { getProductRatingSummary } from "./reviews";
import { db, orderItemsTable, ordersTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

// Prova social de urgência (9.11): só a contagem real de compras nas
// últimas 24h é implementada — "restam Y unidades" precisaria de estoque
// real, que produtos_catalogo não tem hoje (mesmo gap já documentado no
// catalogService). Não exibe abaixo de um mínimo, pra não parecer vazio.
const MIN_COMPRAS_PARA_EXIBIR = 5;

async function getComprasUltimas24h(productId: string): Promise<number> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [result] = await db
    .select({ total: sql<number>`count(distinct ${orderItemsTable.orderId})` })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .where(and(eq(orderItemsTable.productId, productId), gte(ordersTable.createdAt, desde)));
  return Number(result?.total ?? 0);
}

router.get("/products", async (req, res): Promise<void> => {
  const { category, search, sort, page = "1", limit = "20", precoMin, precoMax, marca, cidade } =
    req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = ["t.vende_no_praca_ai = true", "pc.ativo = true"];
  const params: any[] = [];

  if (category) {
    params.push(category);
    conditions.push(
      `lower(regexp_replace(unaccent(cp.nome), '[^a-zA-Z0-9]+', '-', 'g')) = $${params.length}`,
    );
  }

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(
      `(lower(pc.nome) LIKE $${params.length} OR lower(coalesce(pc.descricao, '')) LIKE $${params.length})`,
    );
  }

  if (precoMin) {
    params.push(Number(precoMin));
    conditions.push(`pc.preco_base >= $${params.length}`);
  }

  if (precoMax) {
    params.push(Number(precoMax));
    conditions.push(`pc.preco_base <= $${params.length}`);
  }

  if (marca) {
    params.push(marca);
    conditions.push(`pc.marca = $${params.length}`);
  }

  if (req.query.vendorId) {
    params.push(req.query.vendorId as string);
    conditions.push(`t.id = $${params.length}`);
  }

  // Filtro de localização: sem chave de geocoding (Google Maps/Mapbox), não dá
  // pra filtrar por raio real em km — comparação por cidade cadastrada do
  // lojista é a aproximação disponível hoje. TODO: trocar por raio real
  // quando existir geocoding (mesma limitação do cálculo de frete).
  if (cidade) {
    params.push(cidade);
    conditions.push(`lower(t.cidade) = lower($${params.length})`);
  }

  let orderBy = "pc.destaque DESC, pc.created_at DESC";
  if (sort === "price_asc") orderBy = "pc.preco_base ASC";
  else if (sort === "price_desc") orderBy = "pc.preco_base DESC";
  else if (sort === "offers") {
    conditions.push("pc.preco_promocional IS NOT NULL", "pc.promocao_ativa_ate > now()");
    orderBy = "(1 - pc.preco_promocional / pc.preco_base) DESC"; // maior desconto primeiro
  }
  // "best_sellers" e "rating" ainda dependem de dado que não existe real
  // (vendas/avaliação agregada por ordenação) — caem no default por enquanto

  const whereClause = conditions.join(" AND ");

  try {
    const countResult = await vendorPool.query(
      `SELECT count(*)::int AS total
       FROM produtos_catalogo pc
       JOIN tenants t ON t.id = pc.tenant_id
       LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
       WHERE ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total ?? 0;

    params.push(limitNum, offset);
    const dataResult = await vendorPool.query(
      `SELECT pc.*, cp.nome AS categoria_nome, t.nome_empresa
       FROM produtos_catalogo pc
       JOIN tenants t ON t.id = pc.tenant_id
       LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const products = dataResult.rows.map(mapCatalogRow);

    res.json({
      products,
      total,
      page: pageNum,
      hasMore: offset + products.length < total,
    });
  } catch (err) {
    console.error("[products] erro ao consultar catálogo real:", err);
    res.status(500).json({ error: "Não foi possível carregar os produtos agora." });
  }
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const product = await getProductById(id);
    if (!product) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }
    const ratingSummary = await getProductRatingSummary(id);
    const comprasUltimas24h = await getComprasUltimas24h(id);
    res.json({
      ...product,
      ...ratingSummary,
      comprasUltimas24h: comprasUltimas24h >= MIN_COMPRAS_PARA_EXIBIR ? comprasUltimas24h : null,
    });
  } catch (err) {
    console.error("[products] erro ao buscar produto:", err);
    res.status(500).json({ error: "Não foi possível carregar o produto agora." });
  }
});

export default router;
