import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cartsTable, cartItemsTable, orderDealLinksTable, consumersTable } from "@workspace/db";
import { getProductById, getProductsByIds } from "../lib/catalogService";
import { findOrCreateLead, createDealFromPracaOrder } from "../lib/vendorSyncService";

const router: IRouter = Router();

function buildTrackingEvents(status: string) {
  const statuses = ["confirmed", "preparing", "shipped", "out_for_delivery", "delivered"];
  const labels = [
    { status: "Pedido Confirmado", description: "Seu pedido foi confirmado e está sendo processado" },
    { status: "Em Preparação", description: "O vendedor está preparando seu pedido" },
    { status: "Saiu para Entrega", description: "Seu pedido está a caminho" },
    { status: "A Caminho", description: "Com o entregador, chegará em breve" },
    { status: "Entregue", description: "Pedido entregue com sucesso!" },
  ];
  const currentIdx = statuses.indexOf(status);
  return labels.map((l, i) => ({
    ...l,
    timestamp: i <= currentIdx ? new Date().toISOString() : "",
    completed: i <= currentIdx,
  }));
}

function formatOrder(order: any, items: any[]) {
  let address: any = {};
  try { address = JSON.parse(order.deliveryAddress); } catch {}

  return {
    id: String(order.id),
    orderNumber: order.orderNumber,
    status: order.status,
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      productImageUrl: i.productImageUrl,
      quantity: i.quantity,
      price: Number(i.priceAtPurchase),
      selectedSize: i.selectedSize,
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    discount: Number(order.discount),
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    deliveryAddress: typeof address === "object"
      ? `${address.street ?? ""}, ${address.number ?? ""}, ${address.neighborhood ?? ""}, ${address.city ?? "Chapecó"} - ${address.state ?? "SC"}`
      : String(order.deliveryAddress),
    estimatedDelivery: order.estimatedDelivery ?? new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    trackingCode: order.trackingCode,
    trackingEvents: buildTrackingEvents(order.status),
    createdAt: order.createdAt,
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.json([]);
    return;
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.consumerId, consumerId))
    .orderBy(desc(ordersTable.createdAt));

  const result = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));
      return formatOrder(order, items);
    }),
  );

  res.json(result);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orderId = parseInt(id, 10);

  if (isNaN(orderId)) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.json(formatOrder(order, items));
});

router.post("/orders", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId ?? null;
  const { items, deliveryAddress, deliveryOption, paymentMethod, couponCode } = req.body;

  const shipping = deliveryOption === "express" ? 12.9 : 0;
  const isPixDiscount = paymentMethod === "pix";

  let subtotal = 0;
  const enrichedItems: any[] = [];
  for (const item of items ?? []) {
    const product = await getProductById(item.productId);
    const price = product?.price ?? 0;
    subtotal += price * (item.quantity ?? 1);
    enrichedItems.push({ ...item, price, product });
  }

  const discount = isPixDiscount ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  const total = subtotal + shipping - discount;
  const orderNumber = `PCA-${Date.now().toString().slice(-8)}`;

  const [order] = await db
    .insert(ordersTable)
    .values({
      orderNumber,
      consumerId,
      status: "confirmed",
      subtotal: String(subtotal),
      shipping: String(shipping),
      discount: String(discount),
      total: String(total),
      paymentMethod,
      deliveryAddress: JSON.stringify(deliveryAddress),
      deliveryOption,
      couponCode: couponCode ?? null,
      estimatedDelivery: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    })
    .returning();

  for (const item of enrichedItems) {
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: item.productId,
      productName: item.product?.name ?? "Produto",
      productImageUrl: item.product?.imageUrl ?? "",
      quantity: item.quantity ?? 1,
      priceAtPurchase: String(item.price),
      selectedSize: item.selectedSize ?? null,
    });
  }

  const savedItems = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.status(201).json(formatOrder(order, savedItems));
});

// POST /checkout — read cart, create order, clear cart
router.post("/checkout", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId ?? null;
  const { deliveryAddress, deliveryOption, paymentMethod, couponCode, cardNumber, cardHolder, cardExpiry, cardCvv } = req.body;

  const shipping = deliveryOption === "express" ? 12.9 : 0;
  const isPixPayment = paymentMethod === "pix";

  // Get cart items
  let cartItems: any[] = [];
  if (consumerId) {
    const [cart] = await db
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.consumerId, consumerId))
      .limit(1);
    if (cart) {
      cartItems = await db
        .select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.cartId, cart.id));
    }
  } else if (req.session?.cartToken) {
    const [cart] = await db
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.sessionToken, req.session.cartToken))
      .limit(1);
    if (cart) {
      cartItems = await db
        .select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.cartId, cart.id));
    }
  }

  if (cartItems.length === 0) {
    res.status(400).json({ error: "Carrinho vazio." });
    return;
  }

  // Mitigação parcial do risco de overselling (auditoria, item 5): confirma
  // que cada produto ainda existe/está ativo/o tenant ainda vende no
  // Praça.ai no momento do checkout, não só confia no snapshot do carrinho
  // (que pode ter sido feito há dias). Verificação de estoque real em si
  // ainda não é possível — produtos_catalogo não tem esse campo hoje.
  const realProducts = await getProductsByIds(cartItems.map((i) => i.productId));
  const realIds = new Set(realProducts.map((p) => p.id));
  const unavailable = cartItems.filter((i) => !realIds.has(i.productId));
  if (unavailable.length > 0) {
    res.status(409).json({
      error: "Alguns itens do carrinho não estão mais disponíveis.",
      unavailableProducts: unavailable.map((i) => ({ productId: i.productId, name: i.productName })),
    });
    return;
  }

  let subtotal = 0;
  for (const item of cartItems) {
    subtotal += Number(item.productPrice) * item.quantity;
  }

  // Apply coupon discount if valid
  let discount = 0;
  if (isPixPayment) {
    discount = Math.round(subtotal * 0.1 * 100) / 100;
  }
  if (couponCode === "PRACA10" && !isPixPayment) {
    discount = Math.round(subtotal * 0.1 * 100) / 100;
  } else if (couponCode === "VERAO25" && subtotal >= 150 && !isPixPayment) {
    discount = 25;
  } else if (couponCode === "FRETEGRATIS") {
    discount = Math.min(shipping, 12.9);
  }

  const total = Math.max(0, subtotal + shipping - discount);
  const orderNumber = `PCA-${Date.now().toString().slice(-8)}`;

  const [order] = await db
    .insert(ordersTable)
    .values({
      orderNumber,
      consumerId,
      status: "confirmed",
      subtotal: String(subtotal),
      shipping: String(shipping),
      discount: String(discount),
      total: String(total),
      paymentMethod,
      deliveryAddress: JSON.stringify(deliveryAddress),
      deliveryOption,
      couponCode: couponCode ?? null,
      estimatedDelivery: new Date(Date.now() + (deliveryOption === "express" ? 1 : 3) * 86400000).toISOString().split("T")[0],
    })
    .returning();

  for (const item of cartItems) {
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: item.productId,
      productName: item.productName,
      productImageUrl: item.productImageUrl,
      quantity: item.quantity,
      priceAtPurchase: item.productPrice,
      vendorId: item.vendorId,
      selectedSize: item.selectedSize ?? null,
    });
  }

  // Sincroniza com o Vendor.ai: cada pedido vira 1+ negócios (deal), um por
  // lojista presente no carrinho (carrinho multi-vendedor — seção 9.7).
  // Falha na sincronização não deve derrubar o pedido em si (o pagamento já
  // foi confirmado do lado do Praça.ai) — registra o erro e segue.
  try {
    let consumerInfo = { nome: "Cliente Praça.ai", telefone: null as string | null, email: null as string | null };
    if (consumerId) {
      const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
      if (consumer) {
        consumerInfo = { nome: consumer.name, telefone: consumer.phone ?? null, email: consumer.email };
      }
    }
    // Pedido anônimo (sem login) ainda não captura nome/telefone do cliente
    // no formulário de entrega — gap conhecido, lead fica com dado mínimo
    // até o checkout coletar isso também pra convidado.
    const enderecoStr = typeof deliveryAddress === "object"
      ? `${deliveryAddress.street ?? ""}, ${deliveryAddress.number ?? ""}, ${deliveryAddress.neighborhood ?? ""}, ${deliveryAddress.city ?? "Chapecó"} - ${deliveryAddress.state ?? "SC"}`
      : String(deliveryAddress ?? "");

    const itemsByVendor = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
      if (!item.vendorId) continue; // item legado sem vendorId (carrinho anterior a essa mudança) — ignora na sync
      const list = itemsByVendor.get(item.vendorId) ?? [];
      list.push(item);
      itemsByVendor.set(item.vendorId, list);
    }

    for (const [vendorId, vendorItems] of itemsByVendor) {
      const vendorSubtotal = vendorItems.reduce((sum, i) => sum + Number(i.productPrice) * i.quantity, 0);
      const leadId = await findOrCreateLead(vendorId, { ...consumerInfo, endereco: enderecoStr });
      const dealId = await createDealFromPracaOrder({
        tenantId: vendorId,
        leadId,
        orderNumber,
        items: vendorItems.map((i) => ({ productName: i.productName, quantity: i.quantity })),
        valor: vendorSubtotal,
      });
      await db.insert(orderDealLinksTable).values({ orderId: order.id, vendorId, dealId });
    }
  } catch (syncErr) {
    console.error("[checkout] falha ao sincronizar pedido com o Vendor.ai (pedido já confirmado):", syncErr);
  }

  // Clear the cart
  if (consumerId) {
    const [cart] = await db
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.consumerId, consumerId))
      .limit(1);
    if (cart) {
      await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    }
  } else if (req.session?.cartToken) {
    const [cart] = await db
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.sessionToken, req.session.cartToken))
      .limit(1);
    if (cart) {
      await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    }
  }

  const savedItems = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  const formattedOrder = formatOrder(order, savedItems);

  const result: any = { order: formattedOrder };

  if (isPixPayment) {
    result.pixCode = "00020126580014BR.GOV.BCB.PIX0136praca-ai@mercadopago.com.br5204000053039865406189.905802BR5913PRACA AI6009CHAPECOSC63044F2B";
    result.pixQrCodeUrl = null;
  }

  if (paymentMethod === "boleto") {
    result.boletoUrl = "https://praca.ai/boleto/mock";
  }

  res.status(201).json(result);
});

export default router;
