import { Router, type IRouter } from "express";
import { ALL_PRODUCTS, PRODUCTS_BY_ID } from "./productData";

const router: IRouter = Router();

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
