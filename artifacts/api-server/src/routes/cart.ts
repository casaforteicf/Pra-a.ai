import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cartsTable, cartItemsTable } from "@workspace/db";
import { PRODUCTS_BY_ID } from "./productData";
import crypto from "crypto";

const router: IRouter = Router();

// Helpers
async function getOrCreateCart(consumerId: number | undefined, sessionToken: string) {
  if (consumerId) {
    // Check if user has a cart
    let [cart] = await db
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.consumerId, consumerId))
      .limit(1);

    if (!cart) {
      // Check if there's an anonymous cart with this token to migrate
      const [anonCart] = await db
        .select()
        .from(cartsTable)
        .where(eq(cartsTable.sessionToken, sessionToken))
        .limit(1);

      if (anonCart && !anonCart.consumerId) {
        // Migrate: assign consumer to anonymous cart
        [cart] = await db
          .update(cartsTable)
          .set({ consumerId })
          .where(eq(cartsTable.id, anonCart.id))
          .returning();
      } else {
        // Create new cart for consumer
        [cart] = await db
          .insert(cartsTable)
          .values({ consumerId, sessionToken: `user-${consumerId}` })
          .returning();
      }
    }
    return cart;
  } else {
    // Anonymous cart by session token
    let [cart] = await db
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.sessionToken, sessionToken))
      .limit(1);

    if (!cart) {
      [cart] = await db
        .insert(cartsTable)
        .values({ consumerId: null, sessionToken })
        .returning();
    }
    return cart;
  }
}

async function buildCartResponse(cartId: number) {
  const items = await db
    .select()
    .from(cartItemsTable)
    .where(eq(cartItemsTable.cartId, cartId));

  const enriched = items.map((item) => {
    const product = PRODUCTS_BY_ID[item.productId] ?? {
      id: item.productId,
      name: item.productName,
      description: "",
      price: Number(item.productPrice),
      originalPrice: null,
      discountPct: null,
      imageUrl: item.productImageUrl,
      images: [item.productImageUrl],
      category: "",
      categorySlug: "",
      vendorId: "",
      vendorName: "",
      vendorLogoUrl: null,
      rating: 0,
      reviewCount: 0,
      salesCount: 0,
      stock: 99,
      isFavorited: false,
      sizes: null,
      deliveryDays: 3,
      freeShipping: false,
    };
    return {
      productId: item.productId,
      product,
      quantity: item.quantity,
      selectedSize: item.selectedSize,
    };
  });

  const subtotal = enriched.reduce(
    (sum, i) => sum + Number(i.product.price) * i.quantity,
    0,
  );
  const shipping = subtotal > 0 && subtotal < 79 ? 9.9 : 0;
  const total = subtotal + shipping;
  const itemCount = enriched.reduce((sum, i) => sum + i.quantity, 0);

  return { items: enriched, subtotal, shipping, total, itemCount };
}

function getSessionToken(req: any): string {
  if (!req.session.cartToken) {
    req.session.cartToken = crypto.randomUUID();
  }
  return req.session.cartToken;
}

router.get("/cart", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  const token = getSessionToken(req);
  const cart = await getOrCreateCart(consumerId, token);
  const response = await buildCartResponse(cart.id);
  res.json(response);
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  const token = getSessionToken(req);
  const cart = await getOrCreateCart(consumerId, token);

  const { productId, quantity = 1, selectedSize } = req.body;

  const product = PRODUCTS_BY_ID[productId];
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  // Check if already in cart
  const [existing] = await db
    .select()
    .from(cartItemsTable)
    .where(
      and(
        eq(cartItemsTable.cartId, cart.id),
        eq(cartItemsTable.productId, productId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(cartItemsTable)
      .set({ quantity: existing.quantity + quantity })
      .where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({
      cartId: cart.id,
      productId,
      productName: product.name,
      productImageUrl: product.imageUrl,
      productPrice: String(product.price),
      quantity,
      selectedSize: selectedSize ?? null,
    });
  }

  const response = await buildCartResponse(cart.id);
  res.json(response);
});

router.delete("/cart/items/:productId", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  const token = getSessionToken(req);
  const cart = await getOrCreateCart(consumerId, token);

  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;

  await db
    .delete(cartItemsTable)
    .where(
      and(
        eq(cartItemsTable.cartId, cart.id),
        eq(cartItemsTable.productId, productId),
      ),
    );

  const response = await buildCartResponse(cart.id);
  res.json(response);
});

export default router;
