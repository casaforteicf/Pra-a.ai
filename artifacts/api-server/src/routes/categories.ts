import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CATEGORIES = [
  { id: "cat1", name: "Moda", slug: "moda", icon: "shirt", productCount: 342 },
  { id: "cat2", name: "Delivery", slug: "delivery", icon: "bike", productCount: 87 },
  { id: "cat3", name: "Eletrônicos", slug: "eletronicos", icon: "smartphone", productCount: 215 },
  { id: "cat4", name: "Móveis", slug: "moveis", icon: "sofa", productCount: 128 },
  { id: "cat5", name: "Serviços", slug: "servicos", icon: "wrench", productCount: 64 },
  { id: "cat6", name: "Mercado", slug: "mercado", icon: "shopping-cart", productCount: 891 },
  { id: "cat7", name: "Farmácia", slug: "farmacia", icon: "pill", productCount: 203 },
  { id: "cat8", name: "Esportes", slug: "esportes", icon: "dumbbell", productCount: 156 },
];

router.get("/categories", async (req, res): Promise<void> => {
  res.json(CATEGORIES);
});

export default router;
