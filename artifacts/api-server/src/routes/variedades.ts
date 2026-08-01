import { Router, type IRouter } from "express";
import { getProductsByIds } from "../lib/catalogService";

const router: IRouter = Router();

router.get("/variedades", async (_req, res) => {
  const vendorBaseUrl = (process.env.VENDORAI_API_URL ?? "https://appvendorai.com").replace(/\/$/, "");

  try {
    const response = await fetch(`${vendorBaseUrl}/api/public/praca/variedades`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`Vendor.ai respondeu ${response.status}`);

    const data = await response.json() as { conteudo?: unknown; oferta?: { produtoIds?: string[] } | null };
    const produtoIds = Array.isArray(data.oferta?.produtoIds) ? data.oferta.produtoIds.slice(0, 12) : [];
    const produtos = await getProductsByIds(produtoIds);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    res.json({ ...data, oferta: data.oferta ? { ...data.oferta, produtos } : null });
  } catch (error) {
    console.warn("[variedades] Vendor.ai indisponível; frontend usará fallback:", error);
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ conteudo: null, oferta: null });
  }
});

export default router;
