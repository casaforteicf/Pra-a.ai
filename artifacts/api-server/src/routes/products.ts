import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ALL_PRODUCTS = [
  {
    id: "p1",
    name: "Tênis Esportivo Air Run Pro",
    description: "Tênis de corrida com tecnologia de amortecimento avançada. Solado em borracha de alta resistência, cabedal em mesh respirável. Ideal para corridas de longa distância e treinos intensos.",
    price: 189.90,
    originalPrice: 299.90,
    discountPct: 37,
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
      "https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80",
      "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=80",
    ],
    category: "Esportes",
    categorySlug: "esportes",
    vendorId: "v1",
    vendorName: "SportCO Chapecó",
    vendorLogoUrl: null,
    rating: 4.8,
    reviewCount: 234,
    salesCount: 1204,
    stock: 42,
    isFavorited: false,
    sizes: ["36", "37", "38", "39", "40", "41", "42", "43"],
    deliveryDays: 2,
    freeShipping: true,
    vendorRating: 4.9,
    vendorSalesCount: 8934,
    vendorDescription: "Loja especializada em artigos esportivos em Chapecó desde 2010.",
    shippingInfo: "Entrega expressa em 2 dias úteis para Chapecó. Frete grátis acima de R$ 79.",
    returnPolicy: "30 dias para troca ou devolução sem custo adicional.",
  },
  {
    id: "p2",
    name: "Smartphone Samsung Galaxy A55",
    description: "128GB de armazenamento, 6GB de RAM. Câmera tripla de 50MP + 12MP + 5MP. Tela Super AMOLED de 6.6 polegadas. Bateria de 5000mAh com carregamento rápido de 25W.",
    price: 1649.00,
    originalPrice: 1999.00,
    discountPct: 18,
    imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80",
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80",
    ],
    category: "Eletrônicos",
    categorySlug: "eletronicos",
    vendorId: "v2",
    vendorName: "TechStore Chape",
    vendorLogoUrl: null,
    rating: 4.7,
    reviewCount: 512,
    salesCount: 2890,
    stock: 15,
    isFavorited: true,
    sizes: null,
    deliveryDays: 1,
    freeShipping: true,
    vendorRating: 4.8,
    vendorSalesCount: 15200,
    vendorDescription: "Maior loja de eletrônicos do Oeste Catarinense.",
    shippingInfo: "Entrega no dia seguinte para Chapecó. Retirada na loja disponível.",
    returnPolicy: "7 dias para devolução conforme Código de Defesa do Consumidor.",
  },
  {
    id: "p3",
    name: "Vestido Floral Verão",
    description: "Vestido leve em viscose estampada, perfeito para o calor chapecoense. Modelagem soltinha e confortável. Lavável à máquina.",
    price: 79.90,
    originalPrice: 129.90,
    discountPct: 38,
    imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
    ],
    category: "Moda",
    categorySlug: "moda",
    vendorId: "v3",
    vendorName: "Boutique Bella CO",
    vendorLogoUrl: null,
    rating: 4.6,
    reviewCount: 89,
    salesCount: 445,
    stock: 28,
    isFavorited: false,
    sizes: ["P", "M", "G", "GG"],
    deliveryDays: 3,
    freeShipping: false,
    vendorRating: 4.7,
    vendorSalesCount: 3120,
    vendorDescription: "Moda feminina contemporânea com o estilo do Sul do Brasil.",
    shippingInfo: "Entrega em 3 dias úteis para Chapecó e região.",
    returnPolicy: "Troca em até 30 dias para produtos sem uso.",
  },
  {
    id: "p4",
    name: "Camisa Social Slim Fit",
    description: "Camisa masculina 100% algodão premium, corte slim moderno. Disponível em azul, branco e cinza. Perfeita para o ambiente de trabalho ou ocasiões especiais.",
    price: 89.90,
    originalPrice: null,
    discountPct: null,
    imageUrl: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&q=80"],
    category: "Moda",
    categorySlug: "moda",
    vendorId: "v4",
    vendorName: "Moda Masculina SC",
    vendorLogoUrl: null,
    rating: 4.5,
    reviewCount: 67,
    salesCount: 312,
    stock: 19,
    isFavorited: false,
    sizes: ["P", "M", "G", "GG", "XGG"],
    deliveryDays: 3,
    freeShipping: true,
    vendorRating: 4.6,
    vendorSalesCount: 2890,
    vendorDescription: "Referência em moda masculina em Chapecó.",
    shippingInfo: "Frete grátis para Chapecó em compras acima de R$ 79.",
    returnPolicy: "30 dias para troca de tamanho.",
  },
  {
    id: "p5",
    name: "Tênis Casual Feminino",
    description: "Tênis confortável e estiloso para o dia a dia. Solado antiderrapante, palmilha anatômica. Ideal para caminhadas e uso urbano.",
    price: 159.90,
    originalPrice: 199.90,
    discountPct: 20,
    imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80"],
    category: "Moda",
    categorySlug: "moda",
    vendorId: "v3",
    vendorName: "Boutique Bella CO",
    vendorLogoUrl: null,
    rating: 4.7,
    reviewCount: 145,
    salesCount: 678,
    stock: 33,
    isFavorited: true,
    sizes: ["35", "36", "37", "38", "39", "40"],
    deliveryDays: 2,
    freeShipping: true,
    vendorRating: 4.7,
    vendorSalesCount: 3120,
    vendorDescription: "Moda feminina contemporânea com o estilo do Sul do Brasil.",
    shippingInfo: "Entrega em 2-3 dias úteis para Chapecó.",
    returnPolicy: "Troca em até 30 dias para produtos sem uso.",
  },
  {
    id: "p6",
    name: "Cesta Básica Completa",
    description: "17 itens essenciais de qualidade cuidadosamente selecionados: arroz, feijão, óleo, açúcar, macarrão, molho de tomate, café, biscoito, farinha de trigo, leite, achocolatado, sal, vinagre, sabão em pó, amaciante, papel higiênico e sabonete.",
    price: 149.90,
    originalPrice: 189.90,
    discountPct: 21,
    imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80"],
    category: "Mercado",
    categorySlug: "mercado",
    vendorId: "v5",
    vendorName: "Supermercado Nobre",
    vendorLogoUrl: null,
    rating: 4.4,
    reviewCount: 203,
    salesCount: 1567,
    stock: 100,
    isFavorited: false,
    sizes: null,
    deliveryDays: 1,
    freeShipping: true,
    vendorRating: 4.5,
    vendorSalesCount: 22100,
    vendorDescription: "Supermercado tradicional de Chapecó com mais de 20 anos no mercado.",
    shippingInfo: "Entrega expressa no mesmo dia para regiões selecionadas de Chapecó.",
    returnPolicy: "Garantia de qualidade nos produtos. Troca imediata em caso de problemas.",
  },
  {
    id: "p7",
    name: "Kit Café Premium Serra do Chapecó",
    description: "Café moído 500g + açúcar orgânico 1kg. Café cultivado na Serra do Chapecó, torra média-escura, aroma intenso e sabor encorpado.",
    price: 34.90,
    originalPrice: null,
    discountPct: null,
    imageUrl: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80"],
    category: "Mercado",
    categorySlug: "mercado",
    vendorId: "v5",
    vendorName: "Supermercado Nobre",
    vendorLogoUrl: null,
    rating: 4.9,
    reviewCount: 312,
    salesCount: 2103,
    stock: 200,
    isFavorited: false,
    sizes: null,
    deliveryDays: 1,
    freeShipping: false,
    vendorRating: 4.5,
    vendorSalesCount: 22100,
    vendorDescription: "Supermercado tradicional de Chapecó.",
    shippingInfo: "Entrega expressa para Chapecó.",
    returnPolicy: "Garantia de qualidade.",
  },
  {
    id: "p8",
    name: "Fone de Ouvido Bluetooth JBL",
    description: "Som HD com graves profundos, 30 horas de bateria, cancelamento de ruído ativo. Dobrável, ideal para viagens. Compatível com Siri e Google Assistant.",
    price: 199.90,
    originalPrice: 299.90,
    discountPct: 33,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80"],
    category: "Eletrônicos",
    categorySlug: "eletronicos",
    vendorId: "v2",
    vendorName: "TechStore Chape",
    vendorLogoUrl: null,
    rating: 4.6,
    reviewCount: 278,
    salesCount: 1432,
    stock: 38,
    isFavorited: false,
    sizes: null,
    deliveryDays: 2,
    freeShipping: true,
    vendorRating: 4.8,
    vendorSalesCount: 15200,
    vendorDescription: "Maior loja de eletrônicos do Oeste Catarinense.",
    shippingInfo: "Entrega em 2 dias para Chapecó.",
    returnPolicy: "7 dias para devolução.",
  },
  {
    id: "p9",
    name: "Mochila Escolar Reforçada 35L",
    description: "Mochila impermeável com 35 litros de capacidade. Compartimento exclusivo para notebook até 15.6\", múltiplos bolsos organizadores, alças acolchoadas ergonômicas.",
    price: 89.90,
    originalPrice: 179.90,
    discountPct: 50,
    imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80"],
    category: "Esportes",
    categorySlug: "esportes",
    vendorId: "v1",
    vendorName: "SportCO Chapecó",
    vendorLogoUrl: null,
    rating: 4.5,
    reviewCount: 156,
    salesCount: 892,
    stock: 7,
    isFavorited: false,
    sizes: null,
    deliveryDays: 2,
    freeShipping: true,
    vendorRating: 4.9,
    vendorSalesCount: 8934,
    vendorDescription: "Loja especializada em artigos esportivos em Chapecó desde 2010.",
    shippingInfo: "Entrega em 2 dias para Chapecó. Frete grátis.",
    returnPolicy: "30 dias para troca ou devolução.",
  },
  {
    id: "p10",
    name: "Vitamina C 1000mg + Zinco",
    description: "60 cápsulas. Suplemento vitamínico para imunidade. Vitamina C + Zinco + Vitamina D3. Produzido com matéria-prima de alta qualidade.",
    price: 39.90,
    originalPrice: 59.90,
    discountPct: 33,
    imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80"],
    category: "Farmácia",
    categorySlug: "farmacia",
    vendorId: "v6",
    vendorName: "Farmácia Central Chapecó",
    vendorLogoUrl: null,
    rating: 4.8,
    reviewCount: 421,
    salesCount: 3201,
    stock: 85,
    isFavorited: false,
    sizes: null,
    deliveryDays: 1,
    freeShipping: false,
    vendorRating: 4.9,
    vendorSalesCount: 45000,
    vendorDescription: "Farmácia e drogaria com 30 anos atendendo Chapecó.",
    shippingInfo: "Entrega expressa no mesmo dia.",
    returnPolicy: "Troca conforme legislação sanitária.",
  },
];

router.get("/products", async (req, res): Promise<void> => {
  const { category, search, sort, page = "1", limit = "20" } = req.query as Record<string, string>;

  let filtered = [...ALL_PRODUCTS];

  if (category) {
    filtered = filtered.filter((p) => p.categorySlug === category);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }

  if (sort === "price_asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sort === "price_desc") {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sort === "best_sellers") {
    filtered.sort((a, b) => b.salesCount - a.salesCount);
  } else if (sort === "rating") {
    filtered.sort((a, b) => b.rating - a.rating);
  } else if (sort === "offers") {
    filtered = filtered.filter((p) => p.discountPct !== null && p.discountPct > 0);
    filtered.sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0));
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const start = (pageNum - 1) * limitNum;
  const end = start + limitNum;
  const paginated = filtered.slice(start, end);

  res.json({
    products: paginated,
    total: filtered.length,
    page: pageNum,
    hasMore: end < filtered.length,
  });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const product = ALL_PRODUCTS.find((p) => p.id === id);

  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  res.json(product);
});

router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  res.json([
    {
      id: "r1",
      authorName: "Ana Paula S.",
      authorAvatarUrl: null,
      rating: 5,
      comment: "Produto excelente! Chegou antes do prazo e a qualidade superou as expectativas. Recomendo muito!",
      date: "2025-07-10",
      verified: true,
      helpfulCount: 24,
    },
    {
      id: "r2",
      authorName: "Carlos Eduardo M.",
      authorAvatarUrl: null,
      rating: 4,
      comment: "Muito bom, apenas a embalagem veio um pouco amassada. O produto em si está perfeito.",
      date: "2025-07-05",
      verified: true,
      helpfulCount: 11,
    },
    {
      id: "r3",
      authorName: "Fernanda L.",
      authorAvatarUrl: null,
      rating: 5,
      comment: "Comprei para meu filho e ele adorou! Ótimo custo-benefício para Chapecó. Entrega rápida.",
      date: "2025-06-28",
      verified: true,
      helpfulCount: 8,
    },
    {
      id: "r4",
      authorName: "Roberto K.",
      authorAvatarUrl: null,
      rating: 4,
      comment: "Produto conforme descrito. Loja séria e atenciosa. Voltarei a comprar.",
      date: "2025-06-20",
      verified: false,
      helpfulCount: 3,
    },
  ]);
});

export default router;
