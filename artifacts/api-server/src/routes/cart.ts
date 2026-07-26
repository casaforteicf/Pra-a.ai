import { Router, type IRouter } from "express";

const router: IRouter = Router();

// In-memory cart for demo
let cart = {
  items: [
    {
      productId: "p9",
      product: {
        id: "p9",
        name: "Mochila Escolar Reforçada 35L",
        description: "Impermeável, 35 litros, compartimento notebook",
        price: 89.90,
        originalPrice: 179.90,
        discountPct: 50,
        imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80",
        images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80"],
        category: "Esportes",
        categorySlug: "esportes",
        vendorId: "v1",
        vendorName: "SportCO Chapecó",
        vendorLogoUrl: null,
        rating: 4.5,
        reviewCount: 156,
        salesCount: 892,
        stock: 7,
        isFavorited: false,
        sizes: null,
        deliveryDays: 2,
        freeShipping: true,
      },
      quantity: 1,
      selectedSize: null,
    },
  ],
  subtotal: 89.90,
  shipping: 0,
  total: 89.90,
  itemCount: 1,
};

function recalcCart() {
  cart.subtotal = cart.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  cart.shipping = cart.subtotal > 79 ? 0 : 9.90;
  cart.total = cart.subtotal + cart.shipping;
  cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
}

router.get("/cart", async (req, res): Promise<void> => {
  res.json(cart);
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const { productId, quantity = 1, selectedSize } = req.body;
  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({
      productId,
      product: {
        id: productId,
        name: "Produto adicionado",
        description: "",
        price: 99.90,
        originalPrice: null,
        discountPct: null,
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
        images: [],
        category: "Geral",
        categorySlug: "geral",
        vendorId: "v1",
        vendorName: "Loja",
        vendorLogoUrl: null,
        rating: 4.5,
        reviewCount: 10,
        salesCount: 100,
        stock: 10,
        isFavorited: false,
        sizes: null,
        deliveryDays: 3,
        freeShipping: false,
      },
      quantity,
      selectedSize: selectedSize ?? null,
    });
  }
  recalcCart();
  res.json(cart);
});

router.delete("/cart/items/:productId", async (req, res): Promise<void> => {
  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;
  cart.items = cart.items.filter((i) => i.productId !== productId);
  recalcCart();
  res.json(cart);
});

export default router;
