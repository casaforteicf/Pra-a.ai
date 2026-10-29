import { Router, type IRouter } from "express";
import { calcularFrete } from "../lib/freteService";

const router: IRouter = Router();

router.post("/frete/calcular", async (req, res): Promise<void> => {
  const { vendorId, cidade, estado, subtotal } = req.body as { vendorId?: string; cidade?: string; estado?: string; subtotal?: number };

  if (!vendorId || !cidade?.trim() || !/^[A-Za-z]{2}$/.test(estado ?? "") || !Number.isFinite(Number(subtotal)) || Number(subtotal) < 0) {
    res.status(400).json({ error: "Informe loja, cidade, UF e subtotal válidos." });
    return;
  }

  try {
    const resultado = await calcularFrete(vendorId, cidade, Number(subtotal), estado);
    if (resultado.motivo === "loja_nao_encontrada") {
      res.status(404).json({ error: "Loja não encontrada." });
      return;
    }
    res.json(resultado);
  } catch (err) {
    console.error("[frete] erro ao calcular:", err);
    res.status(500).json({ error: "Não foi possível calcular o frete agora." });
  }
});

export default router;
