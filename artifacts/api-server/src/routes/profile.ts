import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, consumerAddressesTable, consumersTable, ordersTable, favoritesTable } from "@workspace/db";

const router: IRouter = Router();

async function profileResponse(consumerId: number) {
  const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
  if (!consumer) return null;
  const [orderRows, favRows, addresses] = await Promise.all([
    db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.consumerId, consumerId)),
    db.select({ id: favoritesTable.id }).from(favoritesTable).where(eq(favoritesTable.consumerId, consumerId)),
    db.select().from(consumerAddressesTable).where(eq(consumerAddressesTable.consumerId, consumerId)).orderBy(consumerAddressesTable.id),
  ]);
  return {
    id: String(consumer.id), name: consumer.name, email: consumer.email, phone: consumer.phone,
    avatarUrl: null, cpf: consumer.cpf, addresses: addresses.map((address) => ({ ...address, id: String(address.id) })),
    orderCount: orderRows.length, favoriteCount: favRows.length,
  };
}

router.get("/profile", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }

  const profile = await profileResponse(consumerId);
  if (!profile) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  res.json(profile);
});

router.patch("/profile", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }

  const { name, phone, cpf } = req.body;
  const updates: Partial<{ name: string; phone: string | null; cpf: string | null }> = {};
  if (name) updates.name = name;
  if (phone !== undefined) updates.phone = phone || null;
  if (cpf !== undefined) updates.cpf = cpf || null;

  await db
    .update(consumersTable)
    .set(updates)
    .where(eq(consumersTable.id, consumerId))
    .returning();
  res.json(await profileResponse(consumerId));
});

router.post("/profile/addresses", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) return void res.status(401).json({ error: "Não autenticado." });
  const { label, street, number, complement, neighborhood, city, state, zipCode, isDefault } = req.body;
  if (![label, street, number, neighborhood, city, state, zipCode].every((value) => typeof value === "string" && value.trim())) {
    return void res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }
  const existing = await db.select({ id: consumerAddressesTable.id }).from(consumerAddressesTable).where(eq(consumerAddressesTable.consumerId, consumerId)).limit(1);
  const shouldBeDefault = Boolean(isDefault) || existing.length === 0;
  if (shouldBeDefault) await db.update(consumerAddressesTable).set({ isDefault: false }).where(eq(consumerAddressesTable.consumerId, consumerId));
  const [created] = await db.insert(consumerAddressesTable).values({ consumerId, label, street, number, complement: complement || null, neighborhood, city, state, zipCode, isDefault: shouldBeDefault }).returning();
  res.status(201).json({ ...created, id: String(created.id) });
});

router.patch("/profile/addresses/:id", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  const id = Number(req.params.id);
  if (!consumerId) return void res.status(401).json({ error: "Não autenticado." });
  if (!Number.isInteger(id)) return void res.status(400).json({ error: "Endereço inválido." });
  const allowed = ["label", "street", "number", "complement", "neighborhood", "city", "state", "zipCode", "isDefault"] as const;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of allowed) if (req.body[field] !== undefined) updates[field] = req.body[field];
  if (req.body.isDefault) await db.update(consumerAddressesTable).set({ isDefault: false }).where(eq(consumerAddressesTable.consumerId, consumerId));
  const [updated] = await db.update(consumerAddressesTable).set(updates).where(and(eq(consumerAddressesTable.id, id), eq(consumerAddressesTable.consumerId, consumerId))).returning();
  if (!updated) return void res.status(404).json({ error: "Endereço não encontrado." });
  res.json({ ...updated, id: String(updated.id) });
});

router.delete("/profile/addresses/:id", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  const id = Number(req.params.id);
  if (!consumerId) return void res.status(401).json({ error: "Não autenticado." });
  const [removed] = await db.delete(consumerAddressesTable).where(and(eq(consumerAddressesTable.id, id), eq(consumerAddressesTable.consumerId, consumerId))).returning({ id: consumerAddressesTable.id });
  if (!removed) return void res.status(404).json({ error: "Endereço não encontrado." });
  res.status(204).end();
});

export default router;
