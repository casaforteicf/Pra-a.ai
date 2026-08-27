import { Router, type IRouter } from "express";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();
const SITE = "https://www.pracaai.com.br";

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function url(loc: string, changefreq = "daily", priority = "0.7", lastmod?: string | Date | null) {
  const mod = lastmod ? `<lastmod>${xmlEscape(new Date(lastmod).toISOString())}</lastmod>` : "";
  return `<url><loc>${xmlEscape(`${SITE}${loc}`)}</loc>${mod}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

router.get("/seo/sitemap.xml", async (_req, res): Promise<void> => {
  try {
    const urls: string[] = [
      url("/", "daily", "1.0"),
      url("/marketplace", "daily", "0.9"),
      url("/listing", "daily", "0.9"),
      url("/veiculos", "daily", "0.9"),
      url("/imoveis", "daily", "0.9"),
      url("/farmacia", "daily", "0.9"),
      url("/servicos", "daily", "0.8"),
      url("/fretes", "daily", "0.7"),
      url("/restaurantes", "daily", "0.9"),
      url("/energia-solar", "weekly", "0.8"),
      url("/feed", "daily", "0.6"),
    ];

    const [products, categories, vehicles, properties, pharmacy, restaurants] = await Promise.all([
      vendorPool.query(`
        SELECT pc.id, pc.updated_at
        FROM produtos_catalogo pc
        JOIN tenants t ON t.id = pc.tenant_id
        WHERE t.vende_no_praca_ai = true
          AND pc.ativo = true
          AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
      `),
      vendorPool.query(`
        SELECT DISTINCT lower(regexp_replace(unaccent(cp.nome), '[^a-zA-Z0-9]+', '-', 'g')) AS slug
        FROM produtos_catalogo pc
        JOIN tenants t ON t.id = pc.tenant_id
        JOIN categorias_produto cp ON cp.id = pc.categoria_id
        WHERE t.vende_no_praca_ai = true
          AND pc.ativo = true
          AND (pc.vende_no_praca_ai_produto IS NULL OR pc.vende_no_praca_ai_produto = true)
      `),
      vendorPool.query(`
        SELECT ve.id, ve.updated_at
        FROM veiculos_estoque ve
        JOIN tenants t ON t.id = ve.tenant_id
        WHERE ve.status = 'disponivel'
          AND ve.vistoria_realizada = true
          AND ve.vende_no_praca_ai = true
          AND t.vende_no_praca_ai = true
      `),
      vendorPool.query(`
        SELECT ip.id, ip.updated_at
        FROM imoveis_propriedades ip
        JOIN tenants t ON t.id = ip.tenant_id
        WHERE ip.status = 'disponivel'
          AND ip.vende_no_praca_ai = true
          AND t.vende_no_praca_ai = true
      `),
      vendorPool.query(`
        SELECT fp.id, fp.updated_at
        FROM farmacia_produtos fp
        JOIN tenants t ON t.id = fp.tenant_id
        WHERE fp.ativo = true
          AND fp.estoque > 0
          AND fp.vende_no_praca_ai = true
          AND t.vende_no_praca_ai = true
      `),
      vendorPool.query(`
        SELECT DISTINCT t.id
        FROM restaurante_cardapio rc
        JOIN tenants t ON t.id = rc.tenant_id
        WHERE rc.ativo = true
          AND t.vende_no_praca_ai = true
      `),
    ]);

    for (const row of categories.rows) {
      if (row.slug) urls.push(url(`/listing?category=${encodeURIComponent(row.slug)}`, "daily", "0.8"));
    }
    for (const row of products.rows) urls.push(url(`/product/${encodeURIComponent(row.id)}`, "daily", "0.8", row.updated_at));
    for (const row of vehicles.rows) urls.push(url(`/veiculos/${encodeURIComponent(row.id)}`, "daily", "0.8", row.updated_at));
    for (const row of properties.rows) urls.push(url(`/imoveis/${encodeURIComponent(row.id)}`, "daily", "0.8", row.updated_at));
    for (const row of pharmacy.rows) urls.push(url(`/farmacia/${encodeURIComponent(row.id)}`, "daily", "0.7", row.updated_at));
    for (const row of restaurants.rows) urls.push(url(`/restaurantes/${encodeURIComponent(row.id)}`, "daily", "0.8"));

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=900, stale-while-revalidate=3600");
    res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
  } catch (error) {
    console.error("[seo/sitemap] erro ao gerar sitemap:", error);
    res.status(500).type("text/plain").send("sitemap indisponivel");
  }
});

export default router;
