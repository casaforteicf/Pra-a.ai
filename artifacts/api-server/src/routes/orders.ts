import { Router, type IRouter } from "express";

const router: IRouter = Router();

const MOCK_ORDERS = [
  {
    id: "ord1",
    orderNumber: "PCA-2025-001247",
    status: "out_for_delivery",
    items: [
      {
        productId: "p1",
        productName: "Tênis Esportivo Air Run Pro",
        productImageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
        quantity: 1,
        price: 189.90,
        selectedSize: "42",
      },
    ],
    subtotal: 189.90,
    shipping: 0,
    discount: 0,
    total: 189.90,
    paymentMethod: "Pix",
    deliveryAddress: "Rua das Missões, 456, Centro, Chapecó - SC",
    estimatedDelivery: "2025-07-27",
    trackingCode: "BR123456789SC",
    trackingEvents: [
      {
        status: "Pedido Confirmado",
        description: "Seu pedido foi confirmado e está sendo processado",
        timestamp: "2025-07-25T09:00:00",
        completed: true,
      },
      {
        status: "Em Preparação",
        description: "O vendedor está preparando seu pedido",
        timestamp: "2025-07-25T10:30:00",
        completed: true,
      },
      {
        status: "Saiu para Entrega",
        description: "Seu pedido está a caminho",
        timestamp: "2025-07-26T08:00:00",
        completed: true,
      },
      {
        status: "Entregue",
        description: "Pedido entregue com sucesso",
        timestamp: "",
        completed: false,
      },
    ],
    createdAt: "2025-07-25T09:00:00",
  },
  {
    id: "ord2",
    orderNumber: "PCA-2025-001198",
    status: "delivered",
    items: [
      {
        productId: "p2",
        productName: "Smartphone Samsung Galaxy A55",
        productImageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80",
        quantity: 1,
        price: 1649.00,
        selectedSize: null,
      },
    ],
    subtotal: 1649.00,
    shipping: 0,
    discount: 164.90,
    total: 1484.10,
    paymentMethod: "Pix",
    deliveryAddress: "Rua das Missões, 456, Centro, Chapecó - SC",
    estimatedDelivery: "2025-07-20",
    trackingCode: "BR987654321SC",
    trackingEvents: [
      {
        status: "Pedido Confirmado",
        description: "Pedido confirmado",
        timestamp: "2025-07-18T10:00:00",
        completed: true,
      },
      {
        status: "Em Preparação",
        description: "Preparando pedido",
        timestamp: "2025-07-18T11:00:00",
        completed: true,
      },
      {
        status: "Saiu para Entrega",
        description: "A caminho",
        timestamp: "2025-07-19T09:00:00",
        completed: true,
      },
      {
        status: "Entregue",
        description: "Entregue com sucesso",
        timestamp: "2025-07-20T14:30:00",
        completed: true,
      },
    ],
    createdAt: "2025-07-18T10:00:00",
  },
];

router.get("/orders", async (req, res): Promise<void> => {
  res.json(MOCK_ORDERS);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = MOCK_ORDERS.find((o) => o.id === id);
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }
  res.json(order);
});

router.post("/orders", async (req, res): Promise<void> => {
  const newOrder = {
    id: `ord${Date.now()}`,
    orderNumber: `PCA-2025-${Math.floor(Math.random() * 900000) + 100000}`,
    status: "confirmed",
    items: req.body.items ?? [],
    subtotal: 0,
    shipping: req.body.deliveryOption === "express" ? 12.90 : 0,
    discount: 0,
    total: 0,
    paymentMethod: req.body.paymentMethod ?? "pix",
    deliveryAddress: `${req.body.deliveryAddress?.street ?? ""}, ${req.body.deliveryAddress?.number ?? ""}, ${req.body.deliveryAddress?.neighborhood ?? ""}, Chapecó - SC`,
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    trackingCode: null,
    trackingEvents: [
      {
        status: "Pedido Confirmado",
        description: "Seu pedido foi confirmado e está sendo processado",
        timestamp: new Date().toISOString(),
        completed: true,
      },
    ],
    createdAt: new Date().toISOString(),
  };
  res.status(201).json(newOrder);
});

router.post("/checkout", async (req, res): Promise<void> => {
  const orderNumber = `PCA-2025-${Math.floor(Math.random() * 900000) + 100000}`;
  const isPixPayment = req.body.paymentMethod === "pix";

  const order = {
    id: `ord${Date.now()}`,
    orderNumber,
    status: "confirmed",
    items: [
      {
        productId: "p1",
        productName: "Tênis Esportivo Air Run Pro",
        productImageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
        quantity: 1,
        price: 189.90,
        selectedSize: null,
      },
    ],
    subtotal: 189.90,
    shipping: req.body.deliveryOption === "express" ? 12.90 : 0,
    discount: isPixPayment ? 18.99 : 0,
    total: isPixPayment ? 170.91 : 189.90,
    paymentMethod: req.body.paymentMethod,
    deliveryAddress: `${req.body.deliveryAddress?.street ?? "Rua das Missões"}, ${req.body.deliveryAddress?.number ?? "456"}, ${req.body.deliveryAddress?.neighborhood ?? "Centro"}, Chapecó - SC`,
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    trackingCode: null,
    trackingEvents: [
      {
        status: "Pedido Confirmado",
        description: "Seu pedido foi confirmado com sucesso!",
        timestamp: new Date().toISOString(),
        completed: true,
      },
      {
        status: "Em Preparação",
        description: "O vendedor está preparando seu pedido",
        timestamp: "",
        completed: false,
      },
      {
        status: "Saiu para Entrega",
        description: "Seu pedido está a caminho",
        timestamp: "",
        completed: false,
      },
      {
        status: "Entregue",
        description: "Pedido entregue com sucesso",
        timestamp: "",
        completed: false,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const result: {
    order: typeof order;
    pixCode?: string;
    pixQrCodeUrl?: string;
    boletoUrl?: string;
  } = { order };

  if (isPixPayment) {
    result.pixCode = "00020126580014BR.GOV.BCB.PIX0136praca-ai-chave-pix@mercadopago.com.br5204000053039865406189.905802BR5925PRACA AI MARKETPLACE6009CHAPECOSC62070503***6304ABCD";
    result.pixQrCodeUrl = "https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=PIX_PAYMENT_CODE&chld=M|0";
  }

  if (req.body.paymentMethod === "boleto") {
    result.boletoUrl = "https://praça.ai/boleto/mock";
  }

  res.status(201).json(result);
});

export default router;
