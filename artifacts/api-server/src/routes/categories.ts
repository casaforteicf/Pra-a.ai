import { Router, type IRouter } from "express";
import { getRealCategories } from "../lib/catalogService";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  try {
    const categories = await getRealCategories();
    res.json(categories);
  } catch (err) {
    console.error("[categories] erro ao consultar categorias reais:", err);
    res.status(500).json({ error: "Não foi possível carregar as categorias agora." });
  }
});

export default router;
