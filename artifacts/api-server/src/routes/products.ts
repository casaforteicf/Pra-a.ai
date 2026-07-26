import { Router, type IRouter } from "express";
import { vendorPool } from "../lib/vendorDb";
import { mapCatalogRow, getProductById } from "../lib/catalogService";

const router: IRouter = Router();

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
  // "best_sellers", "rating" e "offers" dependem de dado que ainda não existe
  // real (vendas/avaliação/promoção) — caem no default até esses fluxos existirem

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
    res.json(product);
  } catch (err) {
    console.error("[products] erro ao buscar produto:", err);
    res.status(500).json({ error: "Não foi possível carregar o produto agora." });
  }
});

router.get("/products/:id/reviews", async (_req, res): Promise<void> => {
  // Avaliação real depende da seção 4/9.9 (avaliação de pedido) — lista vazia
  // até esse fluxo existir, em vez de review fake.
  res.json([]);
});

export default router;
