import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { vendorPool } from "../lib/vendorDb";
import { mapCatalogRow } from "../lib/catalogService";

const router: IRouter = Router();

async function buildPost(product: any, consumerId?: number) {
  const likes = await pool.query<{ total: number; liked: boolean }>(
    `SELECT count(*)::int AS total,
            coalesce(bool_or(consumer_id = $2), false) AS liked
     FROM feed_likes WHERE product_id = $1`,
    [product.id, consumerId ?? -1],
  );
  const promotional = product.originalPrice && product.originalPrice > product.price;
  return {
    id: product.id,
    vendorId: product.vendorId,
    vendorName: product.vendorName,
    vendorLogoUrl: product.vendorLogoUrl,
    content: promotional
      ? `${product.name} está com condição especial no Praça.ai. Consulte preço, disponibilidade e entrega diretamente no anúncio.`
      : `${product.name} disponível agora no catálogo de ${product.vendorName}. Consulte os detalhes e condições no anúncio.`,
    imageUrl: product.imageUrl,
    likeCount: likes.rows[0]?.total ?? 0,
    commentCount: 0,
    isLiked: likes.rows[0]?.liked ?? false,
    productId: product.id,
    productName: product.name,
    productPrice: product.price,
    createdAt: product.createdAt ?? new Date().toISOString(),
  };
}

router.get("/feed", async (req, res): Promise<void> => {
  try {
    const result = await vendorPool.query(
      `SELECT pc.*, cp.nome AS categoria_nome, t.nome_empresa
       FROM produtos_catalogo pc
       JOIN tenants t ON t.id = pc.tenant_id
       LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
       WHERE t.vende_no_praca_ai = true AND pc.ativo = true
         AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
       ORDER BY pc.destaque DESC, pc.updated_at DESC NULLS LAST, pc.created_at DESC
       LIMIT 30`,
    );
    const products = result.rows.map((row) => ({ ...mapCatalogRow(row), createdAt: row.updated_at ?? row.created_at }));
    const posts = await Promise.all(products.map((product) => buildPost(product, req.session?.consumerId)));
    res.json(posts);
  } catch (error) {
    console.error("[feed] erro ao carregar catálogo:", error);
    res.status(500).json({ error: "Não foi possível carregar as novidades agora." });
  }
});

router.post("/feed/:id/like", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Entre na sua conta para curtir." });
    return;
  }
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const productResult = await vendorPool.query(
    `SELECT pc.*, cp.nome AS categoria_nome, t.nome_empresa
     FROM produtos_catalogo pc
     JOIN tenants t ON t.id = pc.tenant_id
     LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
     WHERE pc.id = $1 AND t.vende_no_praca_ai = true AND pc.ativo = true
       AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
     LIMIT 1`,
    [productId],
  );
  if (!productResult.rowCount) {
    res.status(404).json({ error: "Publicação não encontrada." });
    return;
  }
  const existing = await pool.query("SELECT id FROM feed_likes WHERE consumer_id = $1 AND product_id = $2 LIMIT 1", [consumerId, productId]);
  if (existing.rowCount) await pool.query("DELETE FROM feed_likes WHERE consumer_id = $1 AND product_id = $2", [consumerId, productId]);
  else await pool.query("INSERT INTO feed_likes (consumer_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [consumerId, productId]);
  const row = productResult.rows[0];
  res.json(await buildPost({ ...mapCatalogRow(row), createdAt: row.updated_at ?? row.created_at }, consumerId));
});

export default router;
