import { Router, type IRouter } from "express";
import { COUPONS, validateCoupon } from "../lib/couponService";

const router: IRouter = Router();

router.get("/coupons", async (req, res): Promise<void> => {
  res.json(COUPONS);
});

router.post("/coupons/validate", async (req, res): Promise<void> => {
  const { code, orderValue } = req.body as { code?: string; orderValue?: number };
  res.json(validateCoupon(code, orderValue ?? 0));
});

export default router;
