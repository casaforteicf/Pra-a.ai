import { Router, type IRouter } from "express";

const router: IRouter = Router();

const COUPONS = [
  {
    id: "c1",
    code: "PRACA10",
    description: "10% de desconto na primeira compra",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 50,
    expiresAt: "2025-08-31",
    used: false,
  },
  {
    id: "c2",
    code: "FRETEGRATIS",
    description: "Frete grátis em qualquer compra",
    discountType: "fixed",
    discountValue: 12.90,
    minOrderValue: 30,
    expiresAt: "2025-07-31",
    used: false,
  },
  {
    id: "c3",
    code: "VERAO25",
    description: "R$ 25 off em compras acima de R$ 150",
    discountType: "fixed",
    discountValue: 25,
    minOrderValue: 150,
    expiresAt: "2025-08-15",
    used: false,
  },
  {
    id: "c4",
    code: "MODA20",
    description: "20% off em Moda",
    discountType: "percentage",
    discountValue: 20,
    minOrderValue: null,
    expiresAt: "2025-09-01",
    used: true,
  },
];

router.get("/coupons", async (req, res): Promise<void> => {
  res.json(COUPONS);
});

router.post("/coupons/validate", async (req, res): Promise<void> => {
  const { code, orderValue } = req.body;

  const coupon = COUPONS.find(
    (c) => c.code.toUpperCase() === (code ?? "").toUpperCase() && !c.used,
  );

  if (!coupon) {
    res.json({
      valid: false,
      discountAmount: 0,
      message: "Cupom inválido ou já utilizado.",
    });
    return;
  }

  if (coupon.minOrderValue && orderValue < coupon.minOrderValue) {
    res.json({
      valid: false,
      coupon,
      discountAmount: 0,
      message: `Este cupom requer pedido mínimo de R$ ${coupon.minOrderValue.toFixed(2).replace(".", ",")}.`,
    });
    return;
  }

  const discountAmount =
    coupon.discountType === "percentage"
      ? (orderValue * coupon.discountValue) / 100
      : coupon.discountValue;

  res.json({
    valid: true,
    coupon,
    discountAmount: Math.round(discountAmount * 100) / 100,
    message: null,
  });
});

export default router;
