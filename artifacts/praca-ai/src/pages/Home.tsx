import * as React from "react"
import { ArrowRight, BookOpen, Building2, Car, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Dumbbell, Gamepad2, Heart, Headphones, Home, Package, Plane, Search, ShieldCheck, Shirt, ShoppingBag, Smartphone, Sparkles, Store, Sun, Tag, Truck, User, UtensilsCrossed, Wrench } from "lucide-react"
import { getGetHomeQueryKey, useGetHome } from "@workspace/api-client-react"
import type { Product } from "@workspace/api-client-react"
import { Link, useLocation } from "wouter"
import { ProductCard, type ProductCardData } from "@/components/ProductCard"
import { PageLoader } from "@/components/ui/skeleton"
import { formatMoney } from "@/lib/utils"

type ShowcaseProduct = ProductCardData & { category: string; label?: string }

const MOCK_PRODUCTS: ShowcaseProduct[] = [
  { id: "demo-smartphone", name: "Smartphone Galaxy S24 256 GB", category: "Eletrônicos", price: 3499.9, originalPrice: 4999.9, discountPct: 30, imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=700&q=80", vendorName: "Loja Tech", rating: 4.8, reviewCount: 1245, freeShipping: true, label: "Mais vendido", href: "/listing?search=smartphone" },
  { id: "demo-notebook", name: "Notebook para trabalho e estudos", category: "Eletrônicos", price: 4299.9, originalPrice: 5499.9, discountPct: 22, imageUrl: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=80", vendorName: "Mundo Digital", rating: 4.7, reviewCount: 876, freeShipping: true, href: "/listing?search=notebook" },
  { id: "demo-headphone", name: "Fone Bluetooth premium", category: "Eletrônicos", price: 199.9, originalPrice: 299.9, discountPct: 33, imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80", vendorName: "Som & Cia", rating: 4.5, reviewCount: 543, href: "/listing?search=fone" },
  { id: "demo-tenis", name: "Tênis esportivo urbano", category: "Moda", price: 499.9, originalPrice: 699.9, discountPct: 29, imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80", vendorName: "Estilo Local", rating: 4.7, reviewCount: 234, label: "Destaque", href: "/listing?search=tenis" },
  { id: "demo-sofa", name: "Sofá retrátil três lugares", category: "Casa", price: 1899.9, originalPrice: 2499.9, discountPct: 24, imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=80", vendorName: "Casa & Conforto", rating: 4.8, reviewCount: 187, freeShipping: true, href: "/listing?search=sofa" },
  { id: "demo-bike", name: "Bicicleta aro 29", category: "Esportes", price: 1899.9, originalPrice: 2499.9, discountPct: 24, imageUrl: "https://images.unsplash.com/photo-1502744688674-c619d1586c9e?auto=format&fit=crop&w=700&q=80", vendorName: "Pedal Livre", rating: 4.8, reviewCount: 154, href: "/listing?search=bicicleta" },
  { id: "demo-game", name: "Console de nova geração", category: "Games", price: 3599.9, originalPrice: 4499.9, discountPct: 20, imageUrl: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=700&q=80", vendorName: "Arena Gamer", rating: 4.9, reviewCount: 932, label: "Mais vendido", href: "/listing?search=console" },
  { id: "demo-book", name: "Box de livros clássicos", category: "Livros", price: 199.9, originalPrice: 299.9, discountPct: 33, imageUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=700&q=80", vendorName: "Livraria da Praça", rating: 4.9, reviewCount: 476, href: "/listing?search=livros" },
  { id: "demo-camera", name: "Câmera digital profissional", category: "Eletrônicos", price: 3499.9, originalPrice: 4599.9, discountPct: 24, imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=700&q=80", vendorName: "Foto Pro", rating: 4.8, reviewCount: 167, freeShipping: true, href: "/listing?search=camera" },
  { id: "demo-watch", name: "Relógio inteligente esportivo", category: "Moda", price: 249.9, originalPrice: 349.9, discountPct: 29, imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80", vendorName: "Conecta Shop", rating: 4.6, reviewCount: 321, href: "/listing?search=relogio" },
  { id: "demo-chair", name: "Cadeira de escritório ergonômica", category: "Casa", price: 899.9, originalPrice: 1199.9, discountPct: 25, imageUrl: "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=700&q=80", vendorName: "Office Mais", rating: 4.7, reviewCount: 209, href: "/listing?search=cadeira" },
  { id: "demo-tools", name: "Kit de ferramentas completo", category: "Automotivo", price: 189.9, originalPrice: 259.9, discountPct: 27, imageUrl: "https://images.unsplash.com/photo-1581166397057-235af2b3c6dd?auto=format&fit=crop&w=700&q=80", vendorName: "Ferramentas Sul", rating: 4.7, reviewCount: 345, href: "/listing?search=ferramentas" },
]

const OFFICIAL_CATEGORIES = [
  { label: "Acessórios para Veículos", href: "/listing?category=acessorios-para-veiculos", Icon: Car },
  { label: "Agro", href: "/listing?category=agro", Icon: Package },
  { label: "Arte, Papelaria e Armarinho", href: "/listing?category=arte-papelaria-e-armarinho", Icon: BookOpen },
  { label: "Bebês", href: "/listing?category=bebes", Icon: Package },
  { label: "Beleza e Cuidado Pessoal", href: "/listing?category=beleza-e-cuidado-pessoal", Icon: Sparkles },
  { label: "Brinquedos e Hobbies", href: "/listing?category=brinquedos-e-hobbies", Icon: Gamepad2 },
  { label: "Calçados, Roupas e Bolsas", href: "/listing?category=calcados-roupas-e-bolsas", Icon: Shirt },
  { label: "Casa, Móveis e Decoração", href: "/listing?category=casa-moveis-e-decoracao", Icon: Home },
  { label: "Celulares e Telefones", href: "/listing?category=celulares-e-telefones", Icon: Smartphone },
  { label: "Construção", href: "/listing?category=construcao", Icon: Building2 },
  { label: "Eletrodomésticos", href: "/listing?category=eletrodomesticos", Icon: Package },
  { label: "Eletrônicos, Câmeras e Áudio", href: "/listing?category=eletronicos-cameras-e-audio", Icon: Smartphone },
  { label: "Esportes e Fitness", href: "/listing?category=esportes-e-fitness", Icon: Dumbbell },
  { label: "Ferramentas", href: "/listing?category=ferramentas", Icon: Wrench },
  { label: "Festas e Lembrancinhas", href: "/listing?category=festas-e-lembrancinhas", Icon: Sparkles },
  { label: "Games", href: "/listing?category=games", Icon: Gamepad2 },
  { label: "Indústria e Comércio", href: "/listing?category=industria-e-comercio", Icon: Building2 },
  { label: "Informática", href: "/listing?category=informatica", Icon: Smartphone },
  { label: "Instrumentos Musicais", href: "/listing?category=instrumentos-musicais", Icon: Package },
  { label: "Joias e Relógios", href: "/listing?category=joias-e-relogios", Icon: Sparkles },
  { label: "Livros, Revistas e Comics", href: "/listing?category=livros-revistas-e-comics", Icon: BookOpen },
  { label: "Pet Shop", href: "/listing?category=pet-shop", Icon: Package },
  { label: "Marketplace", href: "/marketplace", Icon: Store },
] as const

const QUICK_CATEGORIES = [
  OFFICIAL_CATEGORIES[11],
  OFFICIAL_CATEGORIES[6],
  OFFICIAL_CATEGORIES[7],
  OFFICIAL_CATEGORIES[9],
  OFFICIAL_CATEGORIES[15],
  OFFICIAL_CATEGORIES[20],
  OFFICIAL_CATEGORIES[12],
  OFFICIAL_CATEGORIES[0],
] as const

const NAV_ITEMS = [
  ["Início", "/", Home], ["Ofertas", "/listing", Tag], ["Categorias", "/listing", Package],
  ["Marketplace", "/marketplace", Store], ["Fretes", "/fretes", Truck],
  ["Viagens", "/listing?category=viagens-e-hoteis", Plane], ["Restaurantes", "/restaurantes", UtensilsCrossed],
  ["Serviços", "/servicos", Wrench],
] as const

const CATEGORY_ICONS: Record<string, typeof Package> = {
  smartphone: Smartphone,
  shirt: Shirt,
  home: Home,
  sofa: Home,
  gamepad: Gamepad2,
  book: BookOpen,
  dumbbell: Dumbbell,
  car: Car,
  truck: Truck,
  store: Store,
  wrench: Wrench,
  package: Package,
}

const FIXED_CATEGORIES = [
  { label: "Energia Solar", href: "/energia-solar", Icon: Sun },
  { label: "Veículos", href: "/veiculos", Icon: Car },
  { label: "Imóveis", href: "/imoveis", Icon: Building2 },
  { label: "Restaurantes", href: "/restaurantes", Icon: UtensilsCrossed },
  { label: "Serviços", href: "/servicos", Icon: Wrench },
  { label: "Fretes", href: "/fretes", Icon: Truck },
  { label: "Viagens e hotéis", href: "/listing?category=viagens-e-hoteis", Icon: Plane },
] as const

function realProductToCard(product: Product): ShowcaseProduct {
  return { ...product, category: product.category || "Catálogo" }
}

export default function HomePage() {
  const [, navigate] = useLocation()
  const [search, setSearch] = React.useState("")
  const [showAllCategories, setShowAllCategories] = React.useState(false)
  const [promoIndex, setPromoIndex] = React.useState(0)
  const { data: homeData, isLoading } = useGetHome({ query: { queryKey: getGetHomeQueryKey() } })

  const realProducts = React.useMemo(() => {
    if (!homeData) return []
    const all = [...homeData.flashDeals, ...homeData.carousels.flatMap((item) => item.products)]
    const unique = new Map(all.map((product) => [product.id, product]))
    return [...unique.values()].map(realProductToCard)
  }, [homeData])

  const products = React.useMemo(() => {
    return [...MOCK_PRODUCTS, ...realProducts]
  }, [realProducts])

  const promos = React.useMemo(() => {
    const source = realProducts.filter((product) => product.discountPct).slice(0, 4)
    return source.length >= 3 ? source : MOCK_PRODUCTS.filter((product) => product.discountPct).slice(0, 4)
  }, [realProducts])

  const allCategories = React.useMemo(() => {
    const dynamic = (homeData?.categories ?? []).map((category) => ({
      label: category.name,
      href: category.slug === "marketplace" ? "/marketplace" : `/listing?category=${category.slug}`,
      Icon: CATEGORY_ICONS[category.icon] ?? Package,
    }))
    const unique = new Map<string, { label: string; href: string; Icon: typeof Package }>()
    for (const category of [...dynamic, ...OFFICIAL_CATEGORIES, ...FIXED_CATEGORIES]) {
      const key = category.label.toLocaleLowerCase("pt-BR")
      if (!unique.has(key)) unique.set(key, category)
    }
    return [...unique.values()]
  }, [homeData?.categories])

  React.useEffect(() => {
    if (promos.length < 2) return
    const interval = window.setInterval(() => setPromoIndex((current) => (current + 1) % promos.length), 5000)
    return () => window.clearInterval(interval)
  }, [promos.length])

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = search.trim()
    navigate(query ? `/listing?search=${encodeURIComponent(query)}` : "/listing")
  }

  const promo = promos[promoIndex] ?? MOCK_PRODUCTS[0]

  return (
    <div className="min-h-full bg-slate-100 pb-10 text-slate-950">
      <header className="sticky top-0 z-40 bg-[#0B1B2F] px-4 py-3 text-white shadow-[0_4px_20px_rgba(0,0,0,.3)] lg:px-8">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-serif text-2xl font-extrabold sm:text-3xl">
            <Store className="h-7 w-7 fill-amber-500 text-amber-500" /> Praça<span className="text-amber-500">.ai</span>
          </Link>
          <form onSubmit={submitSearch} className="order-3 flex w-full rounded-full border border-white/10 bg-white/[.08] p-1 transition focus-within:border-amber-500 focus-within:bg-white/[.14] lg:order-none lg:max-w-[540px] lg:flex-1">
            <label className="sr-only" htmlFor="home-search">Buscar produtos</label>
            <input id="home-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque produtos, marcas, categorias..." className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40" />
            <button type="submit" className="flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-bold text-[#0B1B2F] transition hover:bg-amber-600"><Search className="h-4 w-4" /><span className="hidden sm:inline">Buscar</span></button>
          </form>
          <div className="flex items-center gap-4 text-[11px] text-white/70 sm:gap-5">
            <Link href="/favorites" className="flex flex-col items-center gap-1 hover:text-amber-500"><Heart className="h-5 w-5" /><span className="hidden sm:inline">Favoritos</span></Link>
            <Link href="/marketplace" className="flex flex-col items-center gap-1 hover:text-amber-500"><ShoppingBag className="h-5 w-5" /><span className="hidden sm:inline">Comprar</span></Link>
            <Link href="/profile" className="flex flex-col items-center gap-1 hover:text-amber-500"><User className="h-5 w-5" /><span className="hidden sm:inline">Conta</span></Link>
          </div>
        </div>
      </header>

      <nav className="sticky top-[68px] z-30 hidden border-b border-slate-200 bg-white shadow-sm lg:block">
        <div className="mx-auto flex max-w-[1360px] gap-7 overflow-x-auto px-6 py-3 text-sm font-semibold text-slate-700">
          {NAV_ITEMS.map(([label, href, Icon]) => <Link key={label} href={href} className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent transition hover:border-amber-500 hover:text-amber-600"><Icon className="h-4 w-4 text-amber-500" />{label}</Link>)}
        </div>
      </nav>

      <div className="sticky top-[116px] z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="hide-scrollbar mx-auto flex max-w-[1360px] gap-2 overflow-x-auto px-4 py-3 lg:px-6">
          <button
            type="button"
            aria-expanded={showAllCategories}
            onClick={() => setShowAllCategories((current) => !current)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-amber-500 bg-amber-500 px-4 py-1.5 text-xs font-bold text-[#0B1B2F] transition"
          >
            <Package className="h-3.5 w-3.5" />Todos
            {showAllCategories ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {QUICK_CATEGORIES.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setShowAllCategories(false)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 transition hover:border-amber-500 hover:text-amber-600"
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
          <span className="ml-auto hidden shrink-0 self-center text-sm text-slate-500 sm:block">{products.length} produtos</span>
        </div>
      </div>

      {showAllCategories ? (
        <section className="border-b border-slate-200 bg-white px-4 pb-6 pt-5 lg:px-6" aria-labelledby="all-categories-title">
          <div className="mx-auto max-w-[1360px]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 id="all-categories-title" className="font-serif text-2xl font-bold text-[#0B1B2F]">Todas as categorias</h2><p className="text-sm text-slate-500">Escolha uma categoria para explorar</p></div>
              <button type="button" onClick={() => setShowAllCategories(false)} className="shrink-0 text-sm font-bold text-amber-600">Recolher</button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {allCategories.map(({ label, href, Icon }) => (
                <Link key={label} href={href} className="group flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-center transition hover:-translate-y-0.5 hover:border-amber-500 hover:bg-amber-50">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0B1B2F] shadow-sm group-hover:text-amber-600"><Icon className="h-5 w-5" /></span>
                  <span className="text-[10px] font-bold leading-tight text-slate-700 sm:text-xs">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <main className="mx-auto max-w-[1360px] px-4 py-7 lg:px-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_48px_rgba(11,27,47,.12)]">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B1B2F] px-5 py-4 text-white sm:px-7">
            <h1 className="flex items-center gap-2 font-serif text-xl font-bold"><Sparkles className="h-5 w-5 text-amber-500" /> Promoções do dia</h1>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/15 px-4 py-1.5 text-xs font-bold text-amber-500">Seleção em destaque</span>
          </div>
          <div className="grid items-center gap-5 p-5 sm:grid-cols-[180px_1fr_auto] sm:p-7">
            <img src={promo.imageUrl ?? undefined} alt={promo.name} className="aspect-square w-full rounded-2xl bg-slate-100 object-cover sm:w-[180px]" />
            <div>
              <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{promo.category}</span>
              <h2 className="mt-3 font-serif text-2xl font-bold text-[#0B1B2F]">{promo.name}</h2>
              {promo.originalPrice ? <p className="mt-2 text-sm text-slate-400 line-through">{formatMoney(promo.originalPrice)}</p> : null}
              <p className="font-serif text-3xl font-extrabold text-[#0B1B2F]">{formatMoney(promo.price)}</p>
              <p className="mt-1 text-sm font-semibold text-amber-600"><Store className="mr-1 inline h-4 w-4" />{promo.vendorName}</p>
            </div>
            <Link href={promo.href ?? `/product/${promo.id}`} className="flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 font-bold text-[#0B1B2F] shadow-[0_8px_24px_rgba(245,158,11,.25)] transition hover:-translate-y-0.5 hover:bg-amber-600">Ver oferta <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="flex items-center justify-center gap-4 pb-5">
            <button type="button" onClick={() => setPromoIndex((promoIndex - 1 + promos.length) % promos.length)} aria-label="Promoção anterior" className="text-slate-400 hover:text-amber-500"><ChevronLeft className="h-5 w-5" /></button>
            <div className="flex gap-2">{promos.map((item, index) => <button type="button" key={item.id} onClick={() => setPromoIndex(index)} aria-label={`Ver promoção ${index + 1}`} className={`h-2.5 rounded-full transition-all ${index === promoIndex ? "w-7 bg-amber-500" : "w-2.5 bg-slate-200"}`} />)}</div>
            <button type="button" onClick={() => setPromoIndex((promoIndex + 1) % promos.length)} aria-label="Próxima promoção" className="text-slate-400 hover:text-amber-500"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="flex items-center gap-2 font-serif text-3xl font-bold"><Store className="h-6 w-6 text-amber-500" /> Todos os produtos</h2><p className="mt-1 text-sm text-slate-500">Itens demonstrativos e ofertas disponíveis no catálogo</p></div>
            <Link href="/listing" className="flex items-center gap-1 text-sm font-bold text-amber-600 hover:text-amber-700">Ver catálogo <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {isLoading && realProducts.length === 0 ? <PageLoader /> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {products.map((product) => <div key={product.id} className="relative"><span className="absolute left-3 top-3 z-10 rounded-full bg-[#0B1B2F]/90 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">{product.id.startsWith("demo-") ? "Demonstração" : "Catálogo"}</span><ProductCard product={product} className="h-full" /></div>)}
          </div>
        </section>
      </main>

      <footer className="mt-10 rounded-t-[40px] bg-[#0B1B2F] px-5 pb-28 pt-10 text-white lg:pb-8">
        <div className="mx-auto max-w-[1360px]">
          <div className="grid gap-6 border-b border-white/10 pb-8 sm:grid-cols-2 lg:grid-cols-4">
            {[[ShieldCheck, "Compra protegida", "Segurança em cada pedido"], [Truck, "Entrega conectada", "Logística integrada"], [Store, "Parceiros locais", "Lojas da sua região"], [Headphones, "Atendimento", "Ajuda quando precisar"]].map(([Icon, title, text]) => <div key={title as string} className="flex items-center gap-3"><Icon className="h-7 w-7 text-amber-500" /><div><p className="font-bold">{title as string}</p><p className="text-xs text-white/50">{text as string}</p></div></div>)}
          </div>
          <div className="flex flex-col items-center justify-between gap-4 pt-7 sm:flex-row"><span className="font-serif text-xl font-bold">Praça<span className="text-amber-500">.ai</span></span><div className="flex gap-6 text-sm text-white/55"><Link href="/listing">Explorar</Link><Link href="/fretes">Fretes</Link><Link href="/profile">Conta</Link></div><span className="text-xs text-white/30">© 2026 Praça.ai</span></div>
        </div>
      </footer>
    </div>
  )
}
