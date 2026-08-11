import { Router, type IRouter } from "express";
import { COUPONS, validateCouponWithInfluencer } from "../lib/couponService";

const router: IRouter = Router();

router.get("/coupons", async (req, res): Promise<void> => {
  res.json(COUPONS);
});

router.post("/coupons/validate", async (req, res): Promise<void> => {
  const { code, orderValue, subtotal, shipping } = req.body as { code?: string; orderValue?: number; subtotal?: number; shipping?: number };
  const result = await validateCouponWithInfluencer(code, orderValue ?? subtotal ?? 0, shipping);
  if (!result.valid) {
    res.status(422).json({ valid: false, discount: 0, discountAmount: 0, error: result.message });
    return;
  }
  res.json({
    valid: true,
    code: result.code ?? result.coupon?.code,
    discount: result.discountAmount,
    discountAmount: result.discountAmount,
    description: result.description ?? result.coupon?.description ?? "Desconto aplicado",
  });
});

export default router;
