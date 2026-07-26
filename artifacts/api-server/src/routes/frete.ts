import { Router, type IRouter } from "express";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

/**
 * Cálculo de frete real, mas aproximado: compara a cidade do endereço de
 * entrega com a cidade cadastrada do lojista (tenants.cidade). Sem chave de
 * geolocalização (Google Maps/Mapbox), não dá pra calcular distância exata
 * em km — isso é um TODO explícito, não uma limitação escondida. Quando essa
 * chave existir, trocar a comparação de cidade por distância real via
 * regras_frete por faixa de km (já desenhado na spec, seção 9.2/1.2).
 */
router.post("/frete/calcular", async (req, res): Promise<void> => {
  const { vendorId, cidade, subtotal } = req.body as { vendorId?: string; cidade?: string; subtotal?: number };

  if (!vendorId) {
    res.status(400).json({ error: "vendorId é obrigatório." });
    return;
  }

  try {
    const result = await vendorPool.query(
      `SELECT cidade AS tenant_cidade, frete_mesma_cidade, frete_outra_cidade, frete_gratis_acima_de
       FROM tenants WHERE id = $1 AND vende_no_praca_ai = true`,
      [vendorId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Loja não encontrada." });
      return;
    }

    const { tenant_cidade, frete_mesma_cidade, frete_outra_cidade, frete_gratis_acima_de } = result.rows[0];

    const freteGratisAcimaDe = Number(frete_gratis_acima_de ?? 79);
    if ((subtotal ?? 0) >= freteGratisAcimaDe) {
      res.json({ valor: 0, motivo: "frete_gratis_progressivo", freteGratisAcimaDe });
      return;
    }

    const mesmaCidade =
      cidade && tenant_cidade && cidade.trim().toLowerCase() === String(tenant_cidade).trim().toLowerCase();

    const valor = mesmaCidade ? Number(frete_mesma_cidade ?? 0) : Number(frete_outra_cidade ?? 15.9);

    res.json({
      valor,
      motivo: mesmaCidade ? "mesma_cidade" : "outra_cidade",
      freteGratisAcimaDe,
      // Aviso explícito: cálculo aproximado por cidade, não por distância real em km.
      aproximado: true,
    });
  } catch (err) {
    console.error("[frete] erro ao calcular:", err);
    res.status(500).json({ error: "Não foi possível calcular o frete agora." });
  }
});

export default router;
