import { Router, type IRouter } from "express";

const router: IRouter = Router();

const FEED_POSTS = [
  {
    id: "f1",
    vendorId: "v1",
    vendorName: "SportCO Chapecó",
    vendorLogoUrl: null,
    content: "Chegou a nova coleção de tênis de corrida! Veja os modelos com até 40% OFF. Aproveite, estoque limitado. Venha correr com estilo por Chapecó!",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
    likeCount: 127,
    commentCount: 23,
    isLiked: false,
    productId: "p1",
    productName: "Tênis Esportivo Air Run Pro",
    productPrice: 189.90,
    createdAt: "2025-07-26T08:30:00",
  },
  {
    id: "f2",
    vendorId: "v3",
    vendorName: "Boutique Bella CO",
    vendorLogoUrl: null,
    content: "Verão chegando e a Bella CO já tem as melhores peças para você arrasar! Vestidos, saias e blusas com os tecidos mais leves e fresquinhos. Perfeito para o calor de Chapecó.",
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80",
    likeCount: 89,
    commentCount: 12,
    isLiked: true,
    productId: "p3",
    productName: "Vestido Floral Verão",
    productPrice: 79.90,
    createdAt: "2025-07-25T14:00:00",
  },
  {
    id: "f3",
    vendorId: "v5",
    vendorName: "Supermercado Nobre",
    vendorLogoUrl: null,
    content: "Promoção especial de quinta-feira! Cesta básica com 17 itens de qualidade por apenas R$ 149,90. Entrega gratuita para todo Chapecó. Compre agora e garanta o melhor para sua família!",
    imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80",
    likeCount: 203,
    commentCount: 45,
    isLiked: false,
    productId: "p6",
    productName: "Cesta Básica Completa",
    productPrice: 149.90,
    createdAt: "2025-07-25T10:00:00",
  },
  {
    id: "f4",
    vendorId: "v2",
    vendorName: "TechStore Chape",
    vendorLogoUrl: null,
    content: "Galaxy A55 em promoção relâmpago! Pague com Pix e ganhe 10% de desconto adicional. Parcele em até 12x sem juros no cartão. Venha à nossa loja ou compre aqui na Praça.ai!",
    imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&q=80",
    likeCount: 314,
    commentCount: 67,
    isLiked: false,
    productId: "p2",
    productName: "Smartphone Samsung Galaxy A55",
    productPrice: 1649.00,
    createdAt: "2025-07-24T16:00:00",
  },
  {
    id: "f5",
    vendorId: "v6",
    vendorName: "Farmácia Central Chapecó",
    vendorLogoUrl: null,
    content: "Cuide da sua saúde com os melhores suplementos! Vitamina C + Zinco com 33% de desconto essa semana. Entrega expressa no mesmo dia para todo Chapecó.",
    imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80",
    likeCount: 156,
    commentCount: 28,
    isLiked: true,
    productId: "p10",
    productName: "Vitamina C 1000mg + Zinco",
    productPrice: 39.90,
    createdAt: "2025-07-24T09:00:00",
  },
];

const likeCounts: Record<string, number> = {};
const likedPosts: Set<string> = new Set();

router.get("/feed", async (req, res): Promise<void> => {
  const posts = FEED_POSTS.map((p) => ({
    ...p,
    likeCount: (likeCounts[p.id] ?? 0) + p.likeCount,
    isLiked: likedPosts.has(p.id),
  }));
  res.json(posts);
});

router.post("/feed/:id/like", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const post = FEED_POSTS.find((p) => p.id === id);

  if (!post) {
    res.status(404).json({ error: "Post não encontrado" });
    return;
  }

  if (likedPosts.has(id)) {
    likedPosts.delete(id);
    likeCounts[id] = (likeCounts[id] ?? 0) - 1;
  } else {
    likedPosts.add(id);
    likeCounts[id] = (likeCounts[id] ?? 0) + 1;
  }

  res.json({
    ...post,
    likeCount: post.likeCount + (likeCounts[id] ?? 0),
    isLiked: likedPosts.has(id),
  });
});

export default router;
