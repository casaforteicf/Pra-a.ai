import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, consumersTable, marketplaceListingsTable } from "@workspace/db";
import { ITEM_CATEGORIES } from "../lib/catalogService";

const router: IRouter = Router();
const PERSONAL_LISTING_CATEGORIES = ITEM_CATEGORIES.filter((category) => category !== "Marketplace");
const CONDITIONS = ["new", "like_new", "good", "used"] as const;
const STATUSES = ["active", "paused", "sold"] as const;

type ListingInput = { title: string; description: string; price: number; category: string; condition: typeof CONDITIONS[number]; imageUrls: string[]; city: string; state: string };

function parseListing(body: any): ListingInput | null {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const price = Number(body?.price);
  const category = typeof body?.category === "string" ? body.category : "";
  const condition = body?.condition as typeof CONDITIONS[number];
  const imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls.filter((url: unknown) => typeof url === "string" && /^https?:\/\//.test(url)) : [];
  const city = typeof body?.city === "string" ? body.city.trim() : "";
  const state = typeof body?.state === "string" ? body.state.trim().toUpperCase() : "";
  if (title.length < 3 || title.length > 120 || description.length < 10 || description.length > 3000 || !Number.isFinite(price) || price < 0) return null;
  if (!PERSONAL_LISTING_CATEGORIES.includes(category as any) || !CONDITIONS.includes(condition) || imageUrls.length < 1 || imageUrls.length > 8) return null;
  if (city.length < 2 || city.length > 100 || state.length !== 2) return null;
  return { title, description, price, category, condition, imageUrls, city, state };
}

function serialize(row: any, own = false) {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    condition: row.condition,
    imageUrls: Array.isArray(row.imageUrls) ? row.imageUrls : [],
    city: row.city,
    state: row.state,
    status: row.status,
    sellerName: row.sellerName,
    sellerPhone: own || row.status === "active" ? row.sellerPhone : null,
    createdAt: row.createdAt,
  };
}

router.get("/marketplace/categories", (_req, res) => {
  res.json(PERSONAL_LISTING_CATEGORIES);
});

router.get("/marketplace", async (req, res): Promise<void> => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const conditions = [eq(marketplaceListingsTable.status, "active")];
  if (category) conditions.push(eq(marketplaceListingsTable.category, category));
  if (search) conditions.push(or(ilike(marketplaceListingsTable.title, `%${search}%`), ilike(marketplaceListingsTable.description, `%${search}%`))!);

  const rows = await db
    .select({
      id: marketplaceListingsTable.id,
      title: marketplaceListingsTable.title,
      description: marketplaceListingsTable.description,
      price: marketplaceListingsTable.price,
      category: marketplaceListingsTable.category,
      condition: marketplaceListingsTable.condition,
      imageUrls: marketplaceListingsTable.imageUrls,
      city: marketplaceListingsTable.city,
      state: marketplaceListingsTable.state,
      status: marketplaceListingsTable.status,
      createdAt: marketplaceListingsTable.createdAt,
      sellerName: consumersTable.name,
      sellerPhone: consumersTable.phone,
    })
    .from(marketplaceListingsTable)
    .innerJoin(consumersTable, eq(consumersTable.id, marketplaceListingsTable.consumerId))
    .where(and(...conditions))
    .orderBy(desc(marketplaceListingsTable.createdAt));
  res.json(rows.map((row) => serialize(row)));
});

router.get("/marketplace/mine", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) return void res.status(401).json({ error: "Não autenticado." });
  const rows = await db
    .select({ listing: marketplaceListingsTable, sellerName: consumersTable.name, sellerPhone: consumersTable.phone })
    .from(marketplaceListingsTable)
    .innerJoin(consumersTable, eq(consumersTable.id, marketplaceListingsTable.consumerId))
    .where(eq(marketplaceListingsTable.consumerId, consumerId))
    .orderBy(desc(marketplaceListingsTable.createdAt));
  res.json(rows.map((row) => serialize({ ...row.listing, sellerName: row.sellerName, sellerPhone: row.sellerPhone }, true)));
});

router.post("/marketplace", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) return void res.status(401).json({ error: "Não autenticado." });
  const parsed = parseListing(req.body);
  if (!parsed) return void res.status(422).json({ error: "Revise os campos obrigatórios e escolha uma categoria válida." });
  const [created] = await db.insert(marketplaceListingsTable).values({ consumerId, ...parsed, price: parsed.price.toFixed(2) }).returning();
  res.status(201).json(serialize(created, true));
});

router.patch("/marketplace/:id", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  const id = Number(req.params.id);
  if (!consumerId) return void res.status(401).json({ error: "Não autenticado." });
  if (!Number.isInteger(id)) return void res.status(400).json({ error: "Anúncio inválido." });

  const statusOnly = typeof req.body?.status === "string" && Object.keys(req.body).length === 1;
  const status = req.body?.status as typeof STATUSES[number];
  const listing = statusOnly ? null : parseListing(req.body);
  if ((statusOnly && !STATUSES.includes(status)) || (!statusOnly && !listing)) return void res.status(422).json({ error: "Revise os dados do anúncio." });
  const data = statusOnly ? { status, updatedAt: new Date() } : { ...listing!, price: listing!.price.toFixed(2), updatedAt: new Date() };
  const [updated] = await db.update(marketplaceListingsTable).set(data).where(and(eq(marketplaceListingsTable.id, id), eq(marketplaceListingsTable.consumerId, consumerId))).returning();
  if (!updated) return void res.status(404).json({ error: "Anúncio não encontrado." });
  res.json(serialize(updated, true));
});

router.delete("/marketplace/:id", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  const id = Number(req.params.id);
  if (!consumerId) return void res.status(401).json({ error: "Não autenticado." });
  const [deleted] = await db.delete(marketplaceListingsTable).where(and(eq(marketplaceListingsTable.id, id), eq(marketplaceListingsTable.consumerId, consumerId))).returning({ id: marketplaceListingsTable.id });
  if (!deleted) return void res.status(404).json({ error: "Anúncio não encontrado." });
  res.status(204).end();
});

export default router;
