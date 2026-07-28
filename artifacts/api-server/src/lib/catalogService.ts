import { vendorPool } from "./vendorDb";

// Estoque ainda não existe como campo em produtos_catalogo (Vendor.ai) —
// gap real identificado na auditoria de riscos (item 5: risco de overselling).
// Placeholder até esse campo existir do lado do Vendor.ai.
const STOCK_PLACEHOLDER = 999;

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function mapCatalogRow(row: any) {
  const precoBase = Number(row.preco_base ?? 0);
  const imagens: string[] = Array.isArray(row.imagens) ? row.imagens : [];
  const imageUrl = row.imagem_url || imagens[0] || null;

  // Promoção real (Vendor.ai, migration 036) — só considera ativa se
  // promocao_ativa_ate ainda não passou.
  const promocaoAtiva =
    row.preco_promocional != null &&
    row.promocao_ativa_ate != null &&
    new Date(row.promocao_ativa_ate).getTime() > Date.now();
  const precoPromocional = promocaoAtiva ? Number(row.preco_promocional) : null;
  const discountPct = promocaoAtiva && precoBase > 0
    ? Math.round((1 - precoPromocional! / precoBase) * 100)
    : null;

  return {
    id: row.id,
    name: row.nome,
    description: row.descricao_longa || row.descricao || "",
    price: promocaoAtiva ? precoPromocional! : precoBase,
    originalPrice: promocaoAtiva ? precoBase : null,
    discountPct,
    imageUrl,
    images: imagens.length > 0 ? imagens : imageUrl ? [imageUrl] : [],
    videoUrl: row.video_url || null,
    category: row.categoria_nome || "Outros",
    categorySlug: row.categoria_nome ? slugify(row.categoria_nome) : "outros",
    vendorId: row.tenant_id,
    vendorName: row.nome_empresa || "Loja Parceira",
    vendorLogoUrl: null,
    // Reputação/avaliação real ainda depende da seção 9.3 e seção 4 — zerado
    // até esses fluxos existirem.
    rating: 0,
    reviewCount: 0,
    salesCount: 0,
    stock: STOCK_PLACEHOLDER,
    isFavorited: false,
    sizes: null,
    deliveryDays: null, // depende do frete real (seção 9.2)
    freeShipping: false,
    vendorRating: 0,
    vendorSalesCount: 0,
    vendorDescription: "",
    shippingInfo: "Frete calculado no checkout.",
    returnPolicy: "7 dias para devolução, conforme CDC.",
  };
}

const BASE_QUERY = `
  SELECT pc.*, cp.nome AS categoria_nome, t.nome_empresa
  FROM produtos_catalogo pc
  JOIN tenants t ON t.id = pc.tenant_id
  LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
`;

export async function getProductById(id: string) {
  const result = await vendorPool.query(
    `${BASE_QUERY} WHERE pc.id = $1 AND t.vende_no_praca_ai = true AND pc.ativo = true`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return mapCatalogRow(result.rows[0]);
}

export async function getRealCategories(limit?: number) {
  const result = await vendorPool.query(
    `SELECT cp.nome AS categoria_nome, count(*)::int AS product_count
     FROM produtos_catalogo pc
     JOIN tenants t ON t.id = pc.tenant_id
     LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
     WHERE t.vende_no_praca_ai = true AND pc.ativo = true
     GROUP BY cp.nome
     ORDER BY product_count DESC
     ${limit ? `LIMIT ${Number(limit)}` : ""}`,
  );

  return result.rows
    .filter((row) => row.categoria_nome)
    .map((row, idx) => {
      const slug = slugify(row.categoria_nome);
      return {
        id: `cat-${idx}`,
        name: row.categoria_nome,
        slug,
        icon: ICON_BY_NAME[slug] || ICON_BY_NAME[row.categoria_nome.toLowerCase()] || "tag",
        productCount: row.product_count,
      };
    });
}

export async function getFeaturedProducts(limit = 6) {
  const result = await vendorPool.query(
    `SELECT pc.*, cp.nome AS categoria_nome, t.nome_empresa
     FROM produtos_catalogo pc
     JOIN tenants t ON t.id = pc.tenant_id
     LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
     WHERE t.vende_no_praca_ai = true AND pc.ativo = true AND pc.destaque = true
     ORDER BY pc.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(mapCatalogRow);
}

/**
 * Produtos com promoção real ativa (Vendor.ai, migration 036) — usada pras
 * "Ofertas relâmpago" da home, que antes ficava sempre vazia porque a
 * feature de promoção configurável não existia ainda quando essa seção foi
 * escrita. Já existe e já está conectada no catálogo (mapCatalogRow), só
 * faltava essa consulta específica.
 */
export async function getPromotedProducts(limit = 8) {
  const result = await vendorPool.query(
    `SELECT pc.*, cp.nome AS categoria_nome, t.nome_empresa
     FROM produtos_catalogo pc
     JOIN tenants t ON t.id = pc.tenant_id
     LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
     WHERE t.vende_no_praca_ai = true AND pc.ativo = true
       AND pc.preco_promocional IS NOT NULL
       AND pc.promocao_ativa_ate IS NOT NULL
       AND pc.promocao_ativa_ate > now()
     ORDER BY pc.promocao_ativa_ate ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(mapCatalogRow);
}

export async function getProductsByCategoryName(categoriaNome: string, limit = 4) {
  const result = await vendorPool.query(
    `SELECT pc.*, cp.nome AS categoria_nome, t.nome_empresa
     FROM produtos_catalogo pc
     JOIN tenants t ON t.id = pc.tenant_id
     LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
     WHERE t.vende_no_praca_ai = true AND pc.ativo = true AND cp.nome = $1
     ORDER BY pc.destaque DESC, pc.created_at DESC
     LIMIT $2`,
    [categoriaNome, limit],
  );
  return result.rows.map(mapCatalogRow);
}

const ICON_BY_NAME: Record<string, string> = {
  moda: "shirt",
  delivery: "bike",
  restaurantes: "bike",
  eletronicos: "smartphone",
  "eletrônicos": "smartphone",
  moveis: "sofa",
  "móveis": "sofa",
  servicos: "wrench",
  "serviços": "wrench",
  mercado: "shopping-cart",
  farmacia: "pill",
  "farmácia": "pill",
  esportes: "dumbbell",
  imoveis: "home",
  "imóveis": "home",
  veiculos: "car",
  "veículos": "car",
  fretes: "truck",
};

export async function getProductsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const result = await vendorPool.query(
    `${BASE_QUERY} WHERE pc.id = ANY($1) AND t.vende_no_praca_ai = true AND pc.ativo = true`,
    [ids],
  );
  return result.rows.map(mapCatalogRow);
}
