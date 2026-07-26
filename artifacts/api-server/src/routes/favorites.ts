import { Router, type IRouter } from "express";

const router: IRouter = Router();

const PRODUCTS_MAP: Record<string, object> = {
  p2: {
    id: "p2",
    name: "Smartphone Samsung Galaxy A55",
    description: "128GB, 6GB RAM, câmera 50MP",
    price: 1649.00,
    originalPrice: 1999.00,
    discountPct: 18,
    imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80",
    images: ["https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80"],
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
  },
  p5: {
    id: "p5",
    name: "Tênis Casual Feminino",
    description: "Confortável e estiloso para o dia a dia",
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
  },
};

const userFavorites = new Set(["p2", "p5"]);

router.get("/favorites", async (req, res): Promise<void> => {
  const products = Array.from(userFavorites)
    .filter((id) => PRODUCTS_MAP[id])
    .map((id) => PRODUCTS_MAP[id]);
  res.json(products);
});

router.post("/favorites/:productId", async (req, res): Promise<void> => {
  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;

  if (userFavorites.has(productId)) {
    userFavorites.delete(productId);
    res.json({ productId, isFavorited: false });
  } else {
    userFavorites.add(productId);
    res.json({ productId, isFavorited: true });
  }
});

export default router;
