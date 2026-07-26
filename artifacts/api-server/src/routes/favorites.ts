import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, favoritesTable } from "@workspace/db";
import { getProductsByIds } from "../lib/catalogService";

const router: IRouter = Router();

router.get("/favorites", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.json([]);
    return;
  }

  const rows = await db
    .select()
    .from(favoritesTable)
    .where(eq(favoritesTable.consumerId, consumerId));

  const products = (await getProductsByIds(rows.map((r) => r.productId))).map((p) => ({
    ...p,
    isFavorited: true,
  }));

  res.json(products);
});

router.post("/favorites/:productId", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login para favoritar produtos." });
    return;
  }

  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;

  const [existing] = await db
    .select()
    .from(favoritesTable)
    .where(
      and(
        eq(favoritesTable.consumerId, consumerId),
        eq(favoritesTable.productId, productId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(favoritesTable)
      .where(eq(favoritesTable.id, existing.id));
    res.json({ productId, isFavorited: false });
  } else {
    await db.insert(favoritesTable).values({ consumerId, productId });
    res.json({ productId, isFavorited: true });
  }
});

export default router;
