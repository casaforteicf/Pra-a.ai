import { Router, type IRouter } from "express";
import { vendorPool } from "../lib/vendorDb";
import { expandCategorySlugs, mapCatalogRow, getProductById, getRelatedProducts, getVehicleFilterOptions, getProductsByVehicleCompatibility } from "../lib/catalogService";
import { getVendorSalesCount } from "./stores";
import { getProductRatingSummary, getRatingsForProducts, getVendorRatingSummary } from "./reviews";
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

// Filtro "selecione seu carro" (categoria Acessórios para Veículos, tipo
// Tuning Parts). Opções vêm só do que existe de verdade cadastrado —
// sem base externa de veículos.
router.get("/vehicle-filter-options", async (_req, res): Promise<void> => {
  const options = await getVehicleFilterOptions();
  res.json(options);
});

router.get("/products/compatibilidade-veicular", async (req, res): Promise<void> => {
  const { marca, modelo, ano } = req.query as Record<string, string>;
  const anoNum = Number(ano);
  if (!marca || !modelo || !ano || Number.isNaN(anoNum)) {
    res.status(422).json({ error: "marca, modelo e ano são obrigatórios" });
    return;
  }
  const products = await getProductsByVehicleCompatibility(marca, modelo, anoNum);
  const ratings = await getRatingsForProducts(products.map((p) => p.id));
  res.json(products.map((p) => ({ ...p, ...(ratings.get(p.id) ?? { rating: 0, reviewCount: 0 }) })));
});

// Facetas pro filtro lateral (categorias marcáveis + atributos tipo
// altura/ângulo, que vêm das especificações reais já cadastradas — não é
// lista fixa, só aparece o que os lojistas realmente preencheram).
router.get("/products/filters", async (req, res): Promise<void> => {
  const { categories } = req.query as Record<string, string>;
  const categorySlugs = expandCategorySlugs(categories ? categories.split(",").filter(Boolean) : []);

  try {
    const categoriesResult = await vendorPool.query(`
      SELECT cp.nome,
             lower(regexp_replace(unaccent(cp.nome), '[^a-zA-Z0-9]+', '-', 'g')) AS slug,
             count(*)::int AS total
      FROM produtos_catalogo pc
      JOIN tenants t ON t.id = pc.tenant_id
      JOIN categorias_produto cp ON cp.id = pc.categoria_id
      WHERE t.vende_no_praca_ai = true AND pc.ativo = true
        AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
      GROUP BY cp.nome
      ORDER BY total DESC
    `);

    const specsParams: any[] = [];
    let specsCategoryClause = "";
    if (categorySlugs.length > 0) {
      specsParams.push(categorySlugs);
      specsCategoryClause = `AND lower(regexp_replace(unaccent(cp.nome), '[^a-zA-Z0-9]+', '-', 'g')) = ANY($${specsParams.length})`;
    }
    const specsResult = await vendorPool.query(`
      SELECT spec->>'label' AS label, spec->>'value' AS value, count(*)::int AS total
      FROM produtos_catalogo pc
      JOIN tenants t ON t.id = pc.tenant_id
      LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
      JOIN LATERAL jsonb_array_elements(COALESCE(pc.especificacoes, '[]'::jsonb)) AS spec ON true
      WHERE t.vende_no_praca_ai = true AND pc.ativo = true
        AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
        ${specsCategoryClause}
      GROUP BY spec->>'label', spec->>'value'
      ORDER BY spec->>'label', total DESC
    `, specsParams);

    const specsByLabel = new Map<string, { value: string; total: number }[]>();
    for (const row of specsResult.rows) {
      if (!row.label || !row.value) continue;
      const arr = specsByLabel.get(row.label) ?? [];
      arr.push({ value: row.value, total: row.total });
      specsByLabel.set(row.label, arr);
    }

    res.json({
      categories: categoriesResult.rows,
      specs: Array.from(specsByLabel.entries()).map(([label, values]) => ({ label, values })),
    });
  } catch (err) {
    console.error("[products/filters] erro ao montar facetas:", err);
    res.status(500).json({ error: "Não foi possível carregar os filtros agora." });
  }
});

router.get("/products", async (req, res): Promise<void> => {
  const { category, categories, search, sort, page = "1", limit = "20", precoMin, precoMax, marca, cidade, specs } =
    req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = ["t.vende_no_praca_ai = true", "pc.ativo = true"];
  const params: any[] = [];

  const categorySlugs = expandCategorySlugs(categories ? categories.split(",").filter(Boolean) : (category ? [category] : []));
  if (categorySlugs.length > 0) {
    params.push(categorySlugs);
    conditions.push(
      `lower(regexp_replace(unaccent(cp.nome), '[^a-zA-Z0-9]+', '-', 'g')) = ANY($${params.length})`,
    );
  }

  // Filtro por atributo (ex: Altura=19/3 Cm, Ângulo de peça (graus)=90) — vem
  // das especificações reais cadastradas pelo lojista, não é lista fixa.
  if (specs) {
    try {
      const specPairs = JSON.parse(specs) as { label: string; value: string }[];
      for (const { label, value } of specPairs) {
        if (label === "Marca") {
          params.push(value);
          conditions.push(`pc.marca = $${params.length}`);
        } else {
          params.push(JSON.stringify([{ label, value }]));
          conditions.push(`pc.especificacoes @> $${params.length}::jsonb`);
        }
      }
    } catch {
      // specs mal-formado — ignora silenciosamente, sem quebrar a listagem
    }
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

    // Nota real por produto (Praça.ai tem banco próprio, não dá join direto
    // com o catálogo do Vendor.ai — busca em lote e mescla em JS).
    const ratings = await getRatingsForProducts(products.map((p) => p.id));
    const productsWithRating = products.map((p) => ({
      ...p,
      ...(ratings.get(p.id) ?? { rating: 0, reviewCount: 0 }),
    }));

    res.json({
      products: productsWithRating,
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
    // Reputação do vendedor (bug real: mapCatalogRow sempre zerava
    // vendorRating/vendorSalesCount — nunca eram preenchidos de verdade).
    const vendorRatingSummary = await getVendorRatingSummary(product.vendorId);
    const vendorSalesCount = await getVendorSalesCount(product.vendorId);
    const relatedProductsRaw = await getRelatedProducts(id, product.category);
    const relatedRatings = await getRatingsForProducts(relatedProductsRaw.map((p) => p.id));
    const relatedProducts = relatedProductsRaw.map((p) => ({
      ...p,
      ...(relatedRatings.get(p.id) ?? { rating: 0, reviewCount: 0 }),
    }));
    res.json({
      ...product,
      ...ratingSummary,
      vendorRating: vendorRatingSummary.rating,
      vendorReviewCount: vendorRatingSummary.reviewCount,
      vendorSalesCount,
      relatedProducts,
      comprasUltimas24h: comprasUltimas24h >= MIN_COMPRAS_PARA_EXIBIR ? comprasUltimas24h : null,
    });
  } catch (err) {
    console.error("[products] erro ao buscar produto:", err);
    res.status(500).json({ error: "Não foi possível carregar o produto agora." });
  }
});

export default router;
