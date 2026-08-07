import { vendorPool } from "./vendorDb";

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Taxonomia oficial de itens compartilhada com o Vendor.ai. As quantidades
// nunca ficam fixas aqui: são calculadas a partir dos produtos publicados.
export const ITEM_CATEGORIES = [
  "Acessórios para Veículos",
  "Agro",
  "Arte, Papelaria e Armarinho",
  "Bebês",
  "Beleza e Cuidado Pessoal",
  "Brinquedos e Hobbies",
  "Calçados, Roupas e Bolsas",
  "Casa, Móveis e Decoração",
  "Celulares e Telefones",
  "Construção",
  "Eletrodomésticos",
  "Eletrônicos, Câmeras e Áudio",
  "Esportes e Fitness",
  "Ferramentas",
  "Festas e Lembrancinhas",
  "Games",
  "Indústria e Comércio",
  "Informática",
  "Instrumentos Musicais",
  "Joias e Relógios",
  "Livros, Revistas e Comics",
  "Pet Shop",
  "Saúde",
] as const;

export function mapCatalogRow(row: any) {
  // Preço específico do Praça.ai (Complemento) — quando o lojista configura
  // um valor diferente só pra vitrine do Praça.ai, ele sobrepõe TUDO (preço
  // base e promoção), é o preço final mostrado ao cliente do Praça.ai.
  const temPrecoPracaAi = row.preco_praca_ai != null;
  const precoBase = temPrecoPracaAi ? Number(row.preco_praca_ai) : Number(row.preco_base ?? 0);
  const imagens: string[] = Array.isArray(row.imagens) ? row.imagens : [];
  const imageUrl = row.imagem_url || imagens[0] || null;

  // Promoção real (Vendor.ai, migration 036) — só considera ativa se
  // promocao_ativa_ate ainda não passou. Não se aplica quando há preço
  // específico do Praça.ai (esse já é o valor final, sem desconto por cima).
  const promocaoAtiva =
    !temPrecoPracaAi &&
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
    // Estoque real agora (migration adicionada no boot do api-server).
    // Produto sem controle de estoque ativado (controla_estoque=false)
    // continua sem limite — null aqui significa "não controla".
    stock: row.controla_estoque ? Number(row.estoque_quantidade ?? 0) : null,
    controlaEstoque: Boolean(row.controla_estoque),
    isFavorited: false,
    sizes: null,
    deliveryDays: null, // depende do frete real (seção 9.2)
    // Real agora: mesma regra de frete grátis progressivo já usada no
    // checkout (tenants.frete_gratis_acima_de), aplicada por produto pra
    // já sinalizar na vitrine, estilo Mercado Livre.
    freeShipping: row.frete_gratis_acima_de != null
      ? (promocaoAtiva ? Number(row.preco_promocional) : precoBase) >= Number(row.frete_gratis_acima_de)
      : false,
    vendorRating: 0,
    vendorSalesCount: 0,
    vendorDescription: "",
    shippingInfo: "Frete calculado no checkout.",
    returnPolicy: "7 dias para devolução, conforme CDC.",
    // Tabela de especificações (item 3, paridade com Mercado Livre): Marca
    // sempre entra primeiro quando preenchida, seguida de qualquer par
    // label/value cadastrado pelo lojista em especificacoes (jsonb livre).
    specs: [
      ...(row.marca ? [{ label: "Marca", value: row.marca }] : []),
      ...(Array.isArray(row.especificacoes) ? row.especificacoes : []),
    ],
    // Filtro "selecione seu carro" (categoria Acessórios para Veículos).
    compatibilidadeVeicular: Array.isArray(row.compatibilidade_veicular) ? row.compatibilidade_veicular : [],
  };
}

const BASE_QUERY = `
  SELECT pc.*, cp.nome AS categoria_nome, t.nome_empresa, t.frete_gratis_acima_de
  FROM produtos_catalogo pc
  JOIN tenants t ON t.id = pc.tenant_id
  LEFT JOIN categorias_produto cp ON cp.id = pc.categoria_id
`;

export async function getProductById(id: string) {
  const result = await vendorPool.query(
    `${BASE_QUERY} WHERE pc.id = $1 AND t.vende_no_praca_ai = true AND pc.ativo = true AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return mapCatalogRow(result.rows[0]);
}

export async function getRealCategories(limit?: number) {
  const result = await vendorPool.query(
    `WITH categorias_oficiais AS (
       SELECT nome, ordem
       FROM unnest($1::text[]) WITH ORDINALITY AS categoria(nome, ordem)
     ), contagens AS (
       SELECT cp.nome, count(*)::int AS product_count
       FROM produtos_catalogo pc
       JOIN tenants t ON t.id = pc.tenant_id
       JOIN categorias_produto cp ON cp.id = pc.categoria_id
       WHERE t.vende_no_praca_ai = true
         AND pc.ativo = true
         AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
       GROUP BY cp.nome
     )
     SELECT categoria.nome AS categoria_nome, COALESCE(contagens.product_count, 0)::int AS product_count
     FROM categorias_oficiais categoria
     LEFT JOIN contagens ON lower(contagens.nome) = lower(categoria.nome)
     ORDER BY categoria.ordem
     ${limit ? `LIMIT ${Number(limit)}` : ""}`,
    [ITEM_CATEGORIES],
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
     WHERE t.vende_no_praca_ai = true AND pc.ativo = true AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true) AND pc.destaque = true
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
     WHERE t.vende_no_praca_ai = true AND pc.ativo = true AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
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
     WHERE t.vende_no_praca_ai = true AND pc.ativo = true AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true) AND cp.nome = $1
     ORDER BY pc.destaque DESC, pc.created_at DESC
     LIMIT $2`,
    [categoriaNome, limit],
  );
  return result.rows.map(mapCatalogRow);
}

const ICON_BY_NAME: Record<string, string> = {
  "acessorios-para-veiculos": "car",
  agro: "trees",
  "arte-papelaria-e-armarinho": "paintbrush",
  bebes: "package",
  "beleza-e-cuidado-pessoal": "sparkles",
  "brinquedos-e-hobbies": "gamepad",
  "calcados-roupas-e-bolsas": "shirt",
  "casa-moveis-e-decoracao": "sofa",
  "celulares-e-telefones": "smartphone",
  construcao: "blocks",
  eletrodomesticos: "zap",
  "esportes-e-fitness": "dumbbell",
  ferramentas: "wrench",
  "festas-e-lembrancinhas": "package",
  games: "gamepad",
  "industria-e-comercio": "blocks",
  informatica: "smartphone",
  "instrumentos-musicais": "music",
  "joias-e-relogios": "watch",
  "livros-revistas-e-comics": "book",
  "pet-shop": "paw-print",
  saude: "pill",
  moda: "shirt",
  delivery: "bike",
  restaurantes: "bike",
  eletronicos: "smartphone",
  "eletronicos-cameras-e-audio": "camera",
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
  // Categorias reais do negócio (material de construção — Chapecó/SC)
  acabamento: "paintbrush",
  hidraulica: "droplet",
  "hidráulica": "droplet",
  revestimento: "grid",
  "area-externa": "trees",
  "área externa": "trees",
  esquadria: "door-open",
  eletrica: "zap",
  "elétrica": "zap",
  lazer: "waves",
  estrutura: "blocks",
};

export async function getProductsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const result = await vendorPool.query(
    `${BASE_QUERY} WHERE pc.id = ANY($1) AND t.vende_no_praca_ai = true AND pc.ativo = true AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)`,
    [ids],
  );
  return result.rows.map(mapCatalogRow);
}

// Produtos relacionados (item 4, paridade com Mercado Livre) — mesma
// categoria do produto atual, excluindo ele mesmo. Prioriza produtos em
// destaque, depois mais recentes. Sem categoria (categoriaId nulo), não dá
// pra relacionar por afinidade real, então retorna vazio em vez de
// mostrar produtos aleatórios.
export async function getRelatedProducts(productId: string, categoriaNome: string | null, limit = 6) {
  if (!categoriaNome) return [];
  const result = await vendorPool.query(
    `${BASE_QUERY} WHERE pc.id != $1 AND cp.nome = $2 AND t.vende_no_praca_ai = true AND pc.ativo = true AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
     ORDER BY pc.destaque DESC, pc.created_at DESC
     LIMIT $3`,
    [productId, categoriaNome, limit],
  );
  return result.rows.map(mapCatalogRow);
}

// Filtro "selecione seu carro" da categoria Acessórios para Veículos —
// opções vêm só do que existe de verdade em compatibilidade_veicular (sem
// base externa de veículos), então o filtro nunca mostra marca/modelo sem
// produto disponível.
export async function getVehicleFilterOptions(): Promise<{ marca: string; modelo: string }[]> {
  const result = await vendorPool.query(`
    SELECT DISTINCT comp->>'marca' AS marca, comp->>'modelo' AS modelo
    FROM produtos_catalogo pc
    JOIN tenants t ON t.id = pc.tenant_id
    JOIN LATERAL jsonb_array_elements(COALESCE(pc.compatibilidade_veicular, '[]'::jsonb)) AS comp ON true
    WHERE t.vende_no_praca_ai = true AND pc.ativo = true
      AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
    ORDER BY marca, modelo
  `);
  return result.rows as { marca: string; modelo: string }[];
}

export async function getProductsByVehicleCompatibility(
  marca: string,
  modelo: string,
  ano: number,
  limit = 24,
) {
  const result = await vendorPool.query(
    `${BASE_QUERY}
     JOIN LATERAL jsonb_array_elements(COALESCE(pc.compatibilidade_veicular, '[]'::jsonb)) AS comp ON true
     WHERE t.vende_no_praca_ai = true AND pc.ativo = true AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
       AND comp->>'marca' = $1 AND comp->>'modelo' = $2
       AND (comp->>'anoInicio')::int <= $3
       AND (comp->>'anoFim' IS NULL OR (comp->>'anoFim')::int >= $3)
     ORDER BY pc.destaque DESC, pc.created_at DESC
     LIMIT $4`,
    [marca, modelo, ano, limit],
  );
  return result.rows.map(mapCatalogRow);
}

