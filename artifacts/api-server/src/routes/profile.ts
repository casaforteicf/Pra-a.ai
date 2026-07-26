import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, consumersTable, ordersTable, favoritesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/profile", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }

  const [consumer] = await db
    .select()
    .from(consumersTable)
    .where(eq(consumersTable.id, consumerId))
    .limit(1);

  if (!consumer) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  const orderRows = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.consumerId, consumerId));

  const favRows = await db
    .select({ id: favoritesTable.id })
    .from(favoritesTable)
    .where(eq(favoritesTable.consumerId, consumerId));

  res.json({
    id: String(consumer.id),
    name: consumer.name,
    email: consumer.email,
    phone: consumer.phone,
    avatarUrl: null,
    cpf: null,
    addresses: [],
    orderCount: orderRows.length,
    favoriteCount: favRows.length,
  });
});

router.patch("/profile", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }

  const { name, phone } = req.body;
  const updates: Partial<{ name: string; phone: string | null }> = {};
  if (name) updates.name = name;
  if (phone !== undefined) updates.phone = phone || null;

  const [consumer] = await db
    .update(consumersTable)
    .set(updates)
    .where(eq(consumersTable.id, consumerId))
    .returning();

  const orderRows = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.consumerId, consumerId));

  const favRows = await db
    .select({ id: favoritesTable.id })
    .from(favoritesTable)
    .where(eq(favoritesTable.consumerId, consumerId));

  res.json({
    id: String(consumer.id),
    name: consumer.name,
    email: consumer.email,
    phone: consumer.phone,
    avatarUrl: null,
    cpf: null,
    addresses: [],
    orderCount: orderRows.length,
    favoriteCount: favRows.length,
  });
});

export default router;
