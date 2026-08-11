import { Router, type IRouter } from "express";
import { getRealCategories } from "../lib/catalogService";
import { db, marketplaceListingsTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  try {
    const categories = await getRealCategories();
    const [marketplace] = await db.select({ total: count() }).from(marketplaceListingsTable).where(eq(marketplaceListingsTable.status, "active"));
    const result = categories.map((category) => category.slug === "marketplace" ? { ...category, productCount: marketplace?.total ?? 0 } : category);
    res.json(result);
  } catch (err) {
    console.error("[categories] erro ao consultar categorias reais:", err);
    res.status(500).json({ error: "Não foi possível carregar as categorias agora." });
  }
});

export default router;
