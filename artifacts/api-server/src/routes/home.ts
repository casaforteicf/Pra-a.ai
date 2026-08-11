import { Router, type IRouter } from "express";
import { getRealCategories, getFeaturedProducts, getProductsByCategoryName, getPromotedProducts } from "../lib/catalogService";
import { getRatingsForProducts } from "./reviews";
import { getActiveStoriesGrouped, registerStoryView } from "../lib/storiesService";
import { getVariedadesDeHoje } from "../lib/variedadesDiaService";
import { db, marketplaceListingsTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

const router: IRouter = Router();

// Banners são conteúdo editorial, não catálogo — seguem fixos por enquanto
// (o de Pix já reflete o desconto real de 10% já aplicado no checkout).
const BANNERS = [
  {
    id: "b1",
    title: "Frete Grátis em Chapecó",
    subtitle: "Para compras acima de R$ 79",
    imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80",
    linkUrl: "/listing",
    badgeText: "FRETE GRÁTIS",
  },
  {
    id: "b2",
    title: "Comércio Local de Chapecó",
    subtitle: "Compre de quem está na sua região",
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
    linkUrl: "/listing",
    badgeText: "APOIE O LOCAL",
  },
  {
    id: "b3",
    title: "Pague com Pix",
    subtitle: "10% de desconto em qualquer compra",
    imageUrl: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80",
    linkUrl: "/listing",
    badgeText: "PIX -10%",
  },
];

router.get("/home", async (_req, res): Promise<void> => {
  try {
    const baseCategories = await getRealCategories();
    const [marketplace] = await db.select({ total: count() }).from(marketplaceListingsTable).where(eq(marketplaceListingsTable.status, "active"));
    const categories = baseCategories.map((category) => category.slug === "marketplace" ? { ...category, productCount: marketplace?.total ?? 0 } : category);
    const featuredProducts = await getFeaturedProducts(6);
    const flashDeals = await getPromotedProducts(8);
    const stories = await getActiveStoriesGrouped();
    const variedadesHoje = await getVariedadesDeHoje().catch((err) => {
      console.warn("[home] variedadesHoje indisponível (migration ainda não rodou?):", err);
      return [];
    });

    // Monta carrosséis a partir das 3 categorias com mais produto real,
    // em vez de categoria fixa mockada — se a base de produto crescer/mudar,
    // os carrosséis acompanham automaticamente.
    const topCategories = categories.slice(0, 3);
    const carousels = await Promise.all(
      topCategories.map(async (category) => ({
        category,
        products: await getProductsByCategoryName(category.name, 4),
      })),
    );

    // Nota real por produto — uma busca só, cobrindo todos os produtos que
    // aparecem em qualquer seção da home (destaque, oferta, carrossel).
    const allProductIds = [
      ...featuredProducts.map((p) => p.id),
      ...flashDeals.map((p) => p.id),
      ...carousels.flatMap((c) => c.products.map((p) => p.id)),
    ];
    const ratings = await getRatingsForProducts(allProductIds);
    const withRating = <T extends { id: string }>(list: T[]) =>
      list.map((p) => ({ ...p, ...(ratings.get(p.id) ?? { rating: 0, reviewCount: 0 }) }));

    res.json({
      banners: BANNERS,
      categories,
      stories,
      variedadesHoje,
      featuredProducts: withRating(featuredProducts),
      carousels: carousels.map((c) => ({ ...c, products: withRating(c.products) })).filter((c) => c.products.length > 0),
      flashDeals: withRating(flashDeals),
    });
  } catch (err) {
    console.error("[home] erro ao montar home real:", err);
    res.status(500).json({ error: "Não foi possível carregar a página inicial agora." });
  }
});

// Marca visualização — dispara quando o story abre em tela cheia no
// visualizador, não quando só aparece a bolinha na fileira.
router.post("/home/stories/:id/visualizar", async (req, res): Promise<void> => {
  try {
    await registerStoryView(req.params.id);
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Falha ao registrar visualização" });
  }
});

// Usado por telas de categoria especifica (ex: Viagens) pra mostrar o
// conteudo real de hoje daquela categoria, sem precisar buscar a home
// inteira.
router.get("/variedades-dia/hoje", async (req, res): Promise<void> => {
  try {
    const categoria = typeof req.query.categoria === "string" ? req.query.categoria : undefined;
    const todas = await getVariedadesDeHoje();
    res.json(categoria ? todas.filter((v) => v.categoria === categoria) : todas);
  } catch {
    res.status(500).json({ error: "Falha ao buscar variedades" });
  }
});

export default router;
