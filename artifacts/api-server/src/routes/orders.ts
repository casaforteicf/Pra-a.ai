import { createSuborders, subordersEnabled } from "../lib/suborders";
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cartsTable, cartItemsTable, orderDealLinksTable, consumersTable, coinTransactionsTable, COIN_RULES, vendorPayoutsTable, ambassadorsTable, influencerConversionsTable, deliveriesTable, deliveryEventsTable } from "@workspace/db";
import { getProductsByIds } from "../lib/catalogService";
import { vendorPool } from "../lib/vendorDb";
import { findOrCreateLead, createDealFromPracaOrder } from "../lib/vendorSyncService";
import { calcularFrete } from "../lib/freteService";
import { validateCouponWithInfluencer } from "../lib/couponService";
import { confirmarConversaoCliente } from "./ambassadors";
import { isAsaasConfigured, createOrGetCustomer, createCharge, getPixQrCode } from "../lib/asaas";

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
    pixPayload: order.asaasPixPayload ?? null,
    pixQrcodeImage: order.asaasPixQrcodeImage ?? null,
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

  // BUG DE SEGURANÇA CORRIGIDO (auditoria): esse endpoint não checava se o
  // pedido pertencia a quem estava pedindo — qualquer um sabendo o ID
  // (sequencial, fácil de adivinhar) via endereço, itens e valor de
  // pedido de outra pessoa. GET /orders (lista) já fazia certo.
  const consumerId = req.session?.consumerId;
  const guestOwned=!order.consumerId && ((req.session as any)?.guestOrderIds??[]).includes(order.id);
  if (order.consumerId ? order.consumerId !== consumerId : !guestOwned) {
    res.status(403).json({ error: "Acesso negado a este pedido." });
    return;
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.json(formatOrder(order, items));
});

// O checkout único valida carrinho, frete por loja e pagamento.
// Integrações legadas recebem instrução explícita, sem criar pedido ou cobrança.
router.post("/orders", async (_req, res): Promise<void> => {
  res.status(410).json({
    error: "Este checkout foi substituído. Monte o carrinho, consulte o frete e finalize pelo checkout.",
    code: "CHECKOUT_LEGACY_RETIRED",
    cartEndpoint: "/api/cart/items",
    freightEndpoint: "/api/checkout/freight",
    checkoutEndpoint: "/api/checkout",
  });
});

// POST /checkout — read cart, create order, clear cart

async function checkoutFreight(items: any[], address: any, option: string) {
  if (!["standard","express","pickup"].includes(option)) throw new Error("Escolha entrega ou retirada.");
  if (option !== "pickup" && (!address?.city?.trim() || !/^[A-Za-z]{2}$/.test(address?.state ?? ""))) throw new Error("Informe cidade e UF para calcular o frete.");
  const grouped = new Map<string, number>();
  for (const item of items) {
    if (!item.vendorId) throw new Error("Produto sem vendedor: solicite uma cotação.");
    grouped.set(item.vendorId,(grouped.get(item.vendorId)??0)+Number(item.productPrice)*item.quantity);
  }
  const vendors = [];
  for (const [vendorId,subtotal] of grouped) {
    const freight = option === "pickup" ? 0 : (await calcularFrete(vendorId,address.city,subtotal,address.state)).valor;
    vendors.push({vendorId,subtotal,freight,total:Math.round((subtotal+freight)*100)/100});
  }
  return {vendors,shipping:Math.round(vendors.reduce((sum,v)=>sum+v.freight,0)*100)/100};
}
router.post("/checkout/freight",async(req,res):Promise<void>=>{
  try {
    const consumerId=req.session?.consumerId;
    const token=req.session?.cartToken;
    if(!consumerId&&!token) return void res.status(400).json({error:"Carrinho vazio."});
    const [cart]=await db.select().from(cartsTable).where(consumerId?eq(cartsTable.consumerId,consumerId):eq(cartsTable.sessionToken,token!)).limit(1);
    if(!cart) return void res.status(400).json({error:"Carrinho vazio."});
    const items=await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId,cart.id));
    if(!items.length) return void res.status(400).json({error:"Carrinho vazio."});
    res.setHeader("Cache-Control","private, no-store");
    res.json(await checkoutFreight(items,req.body?.deliveryAddress,req.body?.deliveryOption));
  }catch(error){res.status(422).json({error:error instanceof Error?error.message:"Não foi possível definir o frete."});}
});

router.post("/checkout", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId ?? null;
  const { deliveryAddress, deliveryOption, paymentMethod, couponCode, cardNumber, cardHolder, cardExpiry, cardCvv, guestName, guestPhone, cpf } = req.body;

  if(subordersEnabled()&&!consumerId){res.status(401).json({error:"Entre na sua conta para acompanhar os pedidos por loja."});return;}

  // Pedido sem login precisa de nome e telefone de contato — não dá pra
  // criar lead de qualidade nem entregar sem isso.
  if (!consumerId) {
    if (!guestName || typeof guestName !== "string" || !guestName.trim()) {
      res.status(400).json({ error: "Nome é obrigatório pra continuar sem login." });
      return;
    }
    if (!guestPhone || typeof guestPhone !== "string" || !guestPhone.trim()) {
      res.status(400).json({ error: "Telefone é obrigatório pra continuar sem login." });
      return;
    }
  }

  // CPF é obrigatório em todo checkout (logado ou não) — é o que a
  // cobrança real na Asaas exige. Se o cliente logado já tem CPF salvo
  // no perfil, não precisa reenviar (usa o salvo); senão, precisa vir
  // no corpo da requisição e vai ser salvo no perfil pra próxima vez.
  let cpfDigits = typeof cpf === "string" ? cpf.replace(/\D/g, "") : "";
  let savedConsumerCpf: string | null = null;
  if (consumerId) {
    const [existingConsumer] = await db.select({ cpf: consumersTable.cpf }).from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
    savedConsumerCpf = existingConsumer?.cpf ?? null;
  }
  if (!savedConsumerCpf && cpfDigits.length !== 11) {
    res.status(400).json({ error: "CPF válido é obrigatório pra continuar." });
    return;
  }
  const buyerCpf = savedConsumerCpf ?? cpfDigits;

  if (consumerId && !savedConsumerCpf) {
    await db.update(consumersTable).set({ cpf: buyerCpf }).where(eq(consumersTable.id, consumerId));
  }

  const isPixPayment = paymentMethod === "pix";
  const requiresAsaas = paymentMethod === "pix" || paymentMethod === "boleto" || paymentMethod === "credit_card";
  if (requiresAsaas && !isAsaasConfigured()) {
    res.status(503).json({ error: "Pagamento temporariamente indisponível. Nenhum pedido foi criado ou cobrado." });
    return;
  }

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

  // Mitigação do risco de overselling (auditoria, item 5): confirma que
  // cada produto ainda existe/está ativo/o tenant ainda vende no Praça.ai
  // no momento do checkout, não só confia no snapshot do carrinho (que
  // pode ter sido feito há dias). Estoque real agora existe (opt-in por
  // produto via controla_estoque) e é checado logo abaixo.
  const realProducts = await getProductsByIds(cartItems.map((i) => i.productId));
  const realProductsById = new Map(realProducts.map((p) => [p.id, p]));
  const unavailable = cartItems.filter((i) => !realProductsById.has(i.productId));
  if (unavailable.length > 0) {
    res.status(409).json({
      error: "Alguns itens do carrinho não estão mais disponíveis.",
      unavailableProducts: unavailable.map((i) => ({ productId: i.productId, name: i.productName })),
    });
    return;
  }

  // Checagem de estoque real — só se aplica a produtos com controle
  // ativado (controlaEstoque=true); os demais seguem sem limite.
  const outOfStock = cartItems.filter((i) => {
    const product = realProductsById.get(i.productId)!;
    return product.controlaEstoque && (product.stock ?? 0) < i.quantity;
  });
  if (outOfStock.length > 0) {
    res.status(409).json({
      error: "Alguns itens não têm estoque suficiente.",
      outOfStockProducts: outOfStock.map((i) => {
        const product = realProductsById.get(i.productId)!;
        return { productId: i.productId, name: i.productName, available: product.stock ?? 0, requested: i.quantity };
      }),
    });
    return;
  }

  let subtotal = 0;
  for (const item of cartItems) {
    subtotal += Number(item.productPrice) * item.quantity;
  }

  let freightSummary: Awaited<ReturnType<typeof checkoutFreight>>;
  try { freightSummary=await checkoutFreight(cartItems,deliveryAddress,deliveryOption); }
  catch(error) { res.status(422).json({error:error instanceof Error?error.message:"Frete indisponível."}); return; }
  const shipping=freightSummary.shipping;
  if(req.body.expectedShipping == null || Number(req.body.expectedShipping)!==shipping) {
    res.status(409).json({error:"Confira o frete atualizado antes de pagar.",shipping}); return;
  }

  // Pix e cupom são benefícios distintos. O cupom é revalidado no servidor
  // e pode ser acumulado ao Pix; isso impede que o usuário altere o desconto
  // pelo navegador e garante atribuição correta ao influenciador.
  const pixDiscount = isPixPayment ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  let couponDiscount = 0;
  let influencerId: number | undefined;
  if (couponCode) {
    const result = await validateCouponWithInfluencer(couponCode, subtotal, shipping);
    if (!result.valid) {
      res.status(422).json({ error: result.message ?? "Cupom inválido." });
      return;
    }
    couponDiscount = result.discountAmount;
    influencerId = result.influencerId;
  }

  const discount = Math.min(subtotal + shipping, pixDiscount + couponDiscount);

  const total = Math.max(0, subtotal + shipping - discount);
  const orderNumber = `PCA-${Date.now().toString().slice(-8)}`;

  const [order] = await db
    .insert(ordersTable)
    .values({
      orderNumber,
      consumerId,
      guestName: consumerId ? null : guestName.trim(),
      guestPhone: consumerId ? null : guestPhone.trim(),
      buyerCpf,
      status: "confirmed",
      paymentStatus: "pending",
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

  if(!consumerId){const session=req.session as any;session.guestOrderIds=[...(session.guestOrderIds??[]).filter((id:number)=>id!==order.id),order.id].slice(-20)}

  if (order.paymentStatus === "paid" && influencerId) {
    const [influencer] = await db.select().from(ambassadorsTable).where(eq(ambassadorsTable.id, influencerId)).limit(1);
    if (influencer) {
      const commission = Math.round(subtotal * Number(influencer.comissaoPercentual) * 100) / 10000;
      await db.insert(influencerConversionsTable).values({
        ambassadorId: influencer.id,
        orderId: order.id,
        orderValue: String(total),
        discountValue: String(couponDiscount),
        commissionValue: String(commission),
      });
      await db.update(ambassadorsTable).set({ saldoComissao: String(Number(influencer.saldoComissao) + commission) }).where(eq(ambassadorsTable.id, influencer.id));
    }
  }

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

    // Decrementa estoque real (só produtos com controla_estoque=true —
    // já validado acima que havia quantidade suficiente). Update
    // condicional (WHERE estoque_quantidade >= quantidade) evita ficar
    // negativo em caso de corrida entre dois checkouts simultâneos.
    try {
      await vendorPool.query(
        `UPDATE produtos_catalogo
         SET estoque_quantidade = estoque_quantidade - $1
         WHERE id = $2 AND controla_estoque = true AND estoque_quantidade >= $1`,
        [item.quantity, item.productId],
      );
    } catch (stockErr) {
      console.error("[checkout] falha ao decrementar estoque (pedido já confirmado):", stockErr);
    }
  }

  // Um pedido com produtos de lojas diferentes gera uma coleta por vendedor.
  // A entrega começa em preparação; só é oferecida quando a loja confirmar
  // que o volume está pronto para coleta.
  if (deliveryOption !== "pickup") {
    const vendorIds = [...new Set(cartItems.map((item) => item.vendorId).filter((id): id is string => Boolean(id)))];
    for (const vendorId of vendorIds) {
      const [delivery] = await db.insert(deliveriesTable).values({
        orderId: order.id,
        vendorId,
        origem: "produto",
        status: "preparando",
        valorPagoParceiro: String(freightSummary.vendors.find(v=>v.vendorId===vendorId)?.freight ?? 0),
      }).returning();
      await db.insert(deliveryEventsTable).values({ deliveryId: delivery.id, status: "preparando", observacao: "Entrega criada automaticamente após a confirmação do pedido." });
    }
  }

  try { await createSuborders(order.id,freightSummary.vendors,discount); }
  catch {
    res.status(503).json({error:"A separação por loja não foi concluída. Nenhuma cobrança foi iniciada.",orderId:order.id});
    return;
  }

  // Cobrança real via Asaas — PIX, boleto e cartão de crédito. Dado de
  // cartão (número/validade/CVV) NUNCA é salvo no nosso banco nem em log
  // — só passa direto pro Asaas dentro dessa requisição e é descartado.
  // Falha aqui não derruba o pedido (já foi criado) — fica sem cobrança
  // real, mas o pedido existe e pode ser cobrado manualmente depois.
  const asaasBillingType =
    paymentMethod === "pix" ? "PIX" : paymentMethod === "boleto" ? "BOLETO" : paymentMethod === "credit_card" ? "CREDIT_CARD" : null;
  if (asaasBillingType && isAsaasConfigured()) {
    try {
      const buyerName = consumerId ? undefined : guestName.trim();
      const buyerPhone = consumerId ? undefined : guestPhone.trim();
      let buyerEmail: string | undefined;
      let finalName = buyerName ?? "Cliente Praça.ai";
      if (consumerId) {
        const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
        if (consumer) {
          finalName = consumer.name;
          buyerEmail = consumer.email;
        }
      }

      const customer = await createOrGetCustomer({
        name: finalName,
        email: buyerEmail,
        phone: buyerPhone,
        cpfCnpj: buyerCpf,
      });

      let creditCardPayload: { creditCard: any; creditCardHolderInfo: any } | undefined;
      if (asaasBillingType === "CREDIT_CARD") {
        const [expiryMonth, expiryYearShort] = String(cardExpiry ?? "").split("/");
        if (!cardNumber || !cardHolder || !expiryMonth || !expiryYearShort || !cardCvv) {
          throw new Error("Dados do cartão incompletos.");
        }
        const addressObj = deliveryAddress as any;
        creditCardPayload = {
          creditCard: {
            holderName: cardHolder,
            number: String(cardNumber).replace(/\s/g, ""),
            expiryMonth: expiryMonth.padStart(2, "0"),
            expiryYear: `20${expiryYearShort}`,
            ccv: cardCvv,
          },
          creditCardHolderInfo: {
            name: finalName,
            email: buyerEmail,
            cpfCnpj: buyerCpf,
            postalCode: String(addressObj?.zipCode ?? "").replace(/\D/g, ""),
            addressNumber: String(addressObj?.number ?? "s/n"),
            phone: buyerPhone,
          },
        };
      }

      const charge = await createCharge({
        customer: customer.id,
        billingType: asaasBillingType,
        value: total,
        dueDate: new Date(Date.now() + (asaasBillingType === "BOLETO" ? 3 : 1) * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!,
        description: `Pedido ${orderNumber} — Praça.ai`,
        externalReference: orderNumber,
        ...creditCardPayload,
      });

      const updateData: Record<string, unknown> = { asaasChargeId: charge.id };
      if (asaasBillingType === "PIX") {
        const pixQrCode = await getPixQrCode(charge.id);
        updateData.asaasPixPayload = pixQrCode.payload;
        updateData.asaasPixQrcodeImage = pixQrCode.encodedImage;
      } else if (asaasBillingType === "BOLETO") {
        // Boleto: guarda a URL do próprio Asaas pro cliente imprimir/pagar.
        updateData.asaasPixPayload = charge.bankSlipUrl ?? charge.invoiceUrl;
      }
      // Cartão: nada a mais pra guardar — status da cobrança (aprovado/
      // negado) já vem em charge.status, checado logo abaixo.

      await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, order.id));

      if (asaasBillingType === "CREDIT_CARD" && charge.status && !["CONFIRMED", "RECEIVED"].includes(charge.status)) {
        // Cobrança criada mas não aprovada (ex: cartão recusado) — pedido
        // já existe, mas fica marcado como pagamento pendente pro cliente
        // saber que precisa resolver, em vez de aparecer como confirmado.
        await db.update(ordersTable).set({ status: "payment_pending" }).where(eq(ordersTable.id, order.id));
      }
    } catch (asaasErr) {
      console.error(
        `[checkout] falha ao criar cobrança Asaas pro pedido ${orderNumber} (pedido já confirmado, sem cobrança real):`,
        asaasErr instanceof Error ? asaasErr.message : asaasErr,
      );
      await db.update(ordersTable).set({ status: "payment_pending" }).where(eq(ordersTable.id, order.id));
    }
  }

  const [financialOrder] = await db.select({paymentStatus:ordersTable.paymentStatus}).from(ordersTable).where(eq(ordersTable.id,order.id)).limit(1);
  const paymentConfirmed=financialOrder?.paymentStatus==="paid";
  // Dados pessoais e benefícios somente após confirmação canônica do pagamento.
  // A sincronização pendente requer reprocessamento pós-pagamento.
  // Sincroniza com o Vendor.ai: cada pedido vira 1+ negócios (deal), um por
  // lojista presente no carrinho (carrinho multi-vendedor — seção 9.7).
  // Falha na sincronização não deve derrubar o pedido em si (o pagamento já
  // foi confirmado do lado do Praça.ai) — registra o erro e segue.
  if(paymentConfirmed) try {
    let consumerInfo = { nome: String(guestName??"").trim(), telefone: String(guestPhone??"").trim() as string | null, email: null as string | null };
    if (consumerId) {
      const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
      if (consumer) {
        consumerInfo = { nome: consumer.name, telefone: consumer.phone ?? null, email: consumer.email };
      }
    }
    // Pedido anônimo (sem login) agora captura nome/telefone no próprio
    // checkout (obrigatório, validado acima) — lead chega completo.
    const enderecoStr = typeof deliveryAddress === "object"
      ? `${deliveryAddress.street ?? ""}, ${deliveryAddress.number ?? ""}, ${deliveryAddress.neighborhood ?? ""}, ${deliveryAddress.city ?? ""} - ${deliveryAddress.state ?? ""}`
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

      // Razão de repasse — cálculo, não split automático (ver
      // lib/db/src/schema/vendorPayouts.ts). Comissão vem do cadastro
      // real do tenant no Vendor.ai (comissao_praca_ai_percentual, já
      // configurável por lojista); 8% é só o default se nunca foi setado.
      try {
        const { rows } = await vendorPool.query<{ comissao_praca_ai_percentual: string | null }>(
          `SELECT comissao_praca_ai_percentual FROM tenants WHERE id = $1`,
          [vendorId],
        );
        const comissaoPercentual = Number(rows[0]?.comissao_praca_ai_percentual ?? 8);
        const comissaoValor = Math.round(vendorSubtotal * (comissaoPercentual / 100) * 100) / 100;
        const valorLiquido = Math.round((vendorSubtotal - comissaoValor) * 100) / 100;

        await db.insert(vendorPayoutsTable).values({
          orderId: order.id,
          vendorId,
          valorBruto: String(vendorSubtotal),
          comissaoPercentual: String(comissaoPercentual),
          comissaoValor: String(comissaoValor),
          valorLiquido: String(valorLiquido),
        });
      } catch (payoutErr) {
        console.error(`[checkout] falha ao registrar repasse do vendedor ${vendorId} (pedido já confirmado):`, payoutErr);
      }
    }
  } catch (syncErr) {
    console.error("[checkout] falha ao sincronizar pedido com o Vendor.ai (pedido já confirmado):", syncErr);
  }

  // Programa de Embaixadores: se esse é o primeiro pedido do consumidor e
  // existe uma indicação pendente pra ele, confirma a conversão e credita
  // a comissão do embaixador.
  if (paymentConfirmed && consumerId) {
    try {
      const pedidosAnteriores = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(eq(ordersTable.consumerId, consumerId));
      if (pedidosAnteriores.length === 1) {
        await confirmarConversaoCliente(consumerId);
      }
    } catch (refErr) {
      console.error("[checkout] falha ao confirmar conversão de embaixador (pedido já confirmado):", refErr);
    }
  }

  // Moeda de fidelidade: 1 moeda a cada R$10 gastos (compra concluída).
  // Só pra consumidor logado — convidado não tem saldo pra creditar.
  if (paymentConfirmed && consumerId) {
    try {
      const moedasGanhas = Math.floor(subtotal / 10) * COIN_RULES.COMPRA_A_CADA_R10;
      if (moedasGanhas > 0) {
        const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
        if (consumer) {
          await db
            .update(consumersTable)
            .set({ saldoMoedas: consumer.saldoMoedas + moedasGanhas })
            .where(eq(consumersTable.id, consumerId));
          await db.insert(coinTransactionsTable).values({
            consumerId,
            tipo: "ganho",
            quantidade: moedasGanhas,
            motivo: "compra",
          });
        }
      }
    } catch (coinErr) {
      console.error("[checkout] falha ao creditar moeda de fidelidade (pedido já confirmado):", coinErr);
    }
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

  const [latestOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id)).limit(1);
  const formattedOrder = formatOrder(latestOrder ?? order, savedItems);

  const result: any = { order: formattedOrder };

  if (isPixPayment) {
    // Só devolve o PIX real gerado pelo Asaas. Falhas deixam o pedido
    // pendente e nunca produzem um código de pagamento fictício.
    if (formattedOrder.pixPayload) {
      result.pixCode = formattedOrder.pixPayload;
      result.pixQrCodeUrl = formattedOrder.pixQrcodeImage
        ? `data:image/png;base64,${formattedOrder.pixQrcodeImage}`
        : null;
    } else {
      res.status(502).json({ error: "Não foi possível gerar o PIX. O pedido ficou pendente e nenhuma cobrança simulada foi criada.", order: formattedOrder });
      return;
    }
  }

  if (paymentMethod === "boleto") {
    // Boleto real: a URL fica salva em asaasPixPayload (mesmo campo
    // reaproveitado pra guardar o link, já que boleto não tem QR PIX).
    if (formattedOrder.pixPayload) {
      result.boletoUrl = formattedOrder.pixPayload;
    } else {
      res.status(502).json({ error: "Não foi possível gerar o boleto. O pedido ficou pendente e nenhum boleto simulado foi criado.", order: formattedOrder });
      return;
    }
  }

  res.status(201).json(result);
});

export default router;
