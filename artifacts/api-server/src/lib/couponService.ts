// Fonte única de cupons — antes duplicada entre coupons.ts (validação) e
// orders.ts (aplicação real no checkout), com regras levemente diferentes
// entre os dois (ex: PRACA10 excluía pagamento via pix só do lado do
// checkout). Achado de auditoria: nenhum dos dois checava expiresAt.
//
// Ainda são dados fixos no código, não uma tabela no banco — mudar isso é
// uma feature maior (CRUD de cupom, geração de código, etc.), fora do
// escopo dessa correção pontual.
export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderValue: number | null;
  expiresAt: string;
  used: boolean;
}

export const COUPONS: Coupon[] = [
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

export interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  message: string | null;
  code?: string;
  description?: string;
  influencerId?: number;
}

/**
 * Valida um cupom e calcula o desconto — checagem completa (código, uso,
 * pedido mínimo, E expiração, que antes nenhum dos dois lugares checava).
 * shippingValue é opcional, só usado por cupons discountType='fixed'
 * aplicados sobre o frete (ex: FRETEGRATIS) em vez do subtotal.
 */
export function validateCoupon(
  code: string | null | undefined,
  orderValue: number,
  shippingValue?: number,
): CouponValidationResult {
  const coupon = COUPONS.find(
    (c) => c.code.toUpperCase() === (code ?? "").toUpperCase() && !c.used,
  );

  if (!coupon) {
    return { valid: false, discountAmount: 0, message: "Cupom inválido ou já utilizado." };
  }

  if (new Date(coupon.expiresAt) < new Date()) {
    return { valid: false, coupon, discountAmount: 0, message: "Este cupom expirou." };
  }

  if (coupon.minOrderValue && orderValue < coupon.minOrderValue) {
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      message: `Este cupom requer pedido mínimo de R$ ${coupon.minOrderValue.toFixed(2).replace(".", ",")}.`,
    };
  }

  let discountAmount: number;
  if (coupon.code === "FRETEGRATIS" && shippingValue != null) {
    discountAmount = Math.min(shippingValue, coupon.discountValue);
  } else if (coupon.discountType === "percentage") {
    discountAmount = (orderValue * coupon.discountValue) / 100;
  } else {
    discountAmount = coupon.discountValue;
  }

  return { valid: true, coupon, discountAmount: Math.round(discountAmount * 100) / 100, message: null };
}

/** Valida primeiro os cupons promocionais e depois códigos de influenciador. */
export async function validateCouponWithInfluencer(
  code: string | null | undefined,
  orderValue: number,
  shippingValue?: number,
): Promise<CouponValidationResult> {
  const fixed = validateCoupon(code, orderValue, shippingValue);
  if (fixed.valid) return { ...fixed, code: fixed.coupon?.code, description: fixed.coupon?.description };

  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) return fixed;
  const { db, ambassadorsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const [influencer] = await db.select().from(ambassadorsTable).where(eq(ambassadorsTable.codigo, normalized)).limit(1);
  if (!influencer || influencer.status !== "ativo") return fixed;

  const percentage = Number(influencer.descontoPercentual ?? 0);
  const discountAmount = Math.round(orderValue * percentage) / 100;
  return {
    valid: true,
    discountAmount,
    message: null,
    code: influencer.codigo,
    description: `${percentage}% de desconto com ${influencer.nomePublico || "influenciador parceiro"}`,
    influencerId: influencer.id,
  };
}
