import { Router, type IRouter } from "express";
import { getRealCategories, getFeaturedProducts, getProductsByCategoryName } from "../lib/catalogService";

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
    const categories = await getRealCategories(8);
    const featuredProducts = await getFeaturedProducts(6);

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

    res.json({
      banners: BANNERS,
      categories,
      featuredProducts,
      carousels: carousels.filter((c) => c.products.length > 0),
      // "Ofertas relâmpago" depende de desconto/promoção real (seção 21,
      // Promoções Configuráveis) — ainda não existe, fica vazio em vez de mock.
      flashDeals: [],
    });
  } catch (err) {
    console.error("[home] erro ao montar home real:", err);
    res.status(500).json({ error: "Não foi possível carregar a página inicial agora." });
  }
});

export default router;
