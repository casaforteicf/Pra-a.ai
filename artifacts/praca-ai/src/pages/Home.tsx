import * as React from "react"
import { ArrowRight, BadgeCheck, Building2, Car, ChevronDown, ClipboardList, CreditCard, Grid2X2, Hammer, Headphones, Heart, Home, Laptop, Leaf, Menu, Package, Search, ShieldCheck, Shirt, ShoppingCart, Store, Truck, User, Users, Wrench, X } from "lucide-react"
import { getGetCartQueryKey, getListFavoritesQueryKey, useGetCart, useListFavorites } from "@workspace/api-client-react"
import type { Product } from "@workspace/api-client-react"
import { Link, useLocation } from "wouter"
import { ProductCard, type ProductCardData } from "@/components/ProductCard"
import { PageLoader } from "@/components/ui/skeleton"
import { buildArqdorPreProjectUrl } from "@/lib/arqdor"
import { PracaLogo } from "@/components/brand/PracaLogo"
import { useAuth } from "@/contexts/AuthContext"
import { MarketplaceCityPicker } from "@/components/MarketplaceCityPicker"
import { useMarketplaceCity } from "@/lib/marketplace-city"

const NAV_ITEMS = [["Ofertas do dia", "/listing?sort=offers"], ["Imóveis", "/imoveis"], ["Construção", "/listing?category=construcao"], ["Casa e decoração", "/listing?category=casa-moveis-e-decoracao"], ["Eletrônicos", "/listing?category=eletronicos-cameras-e-audio"], ["Veículos", "/veiculos"], ["Serviços", "/servicos"], ["Negócios B2B", "/cotacao"]] as const
const ARQDOR_PROJECTS_URL = buildArqdorPreProjectUrl()
const CATEGORIES = [
  ["Imóveis", "/imoveis", Home], ["Construção e reforma", "/listing?category=construcao", Hammer], ["Materiais de construção", "/listing?category=materiais-de-construcao", Package],
  ["Casa e decoração", "/listing?category=casa-moveis-e-decoracao", Building2], ["Eletrônicos", "/listing?category=eletronicos-cameras-e-audio", Laptop], ["Veículos", "/veiculos", Car],
  ["Serviços", "/servicos", Wrench], ["Agro e indústria", "/listing?category=agro", Leaf], ["Moda e beleza", "/listing?category=calcados-roupas-e-bolsas", Shirt],
] as const
const QUICK_CATEGORIES = CATEGORIES.slice(0, 8)
const HERO_IMAGE = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1500&q=88"

function toCard(product: Product): ProductCardData { return { ...product } }

function Brand() {
  return <Link href="/" aria-label="Praça.ai — página inicial" className="shrink-0"><PracaLogo inverse /></Link>
}

function SectionHeading({ icon: Icon, title, subtitle, href, action }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string; href: string; action: string }) {
  return <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><Icon className="h-5 w-5" /></span><div><h2 className="font-[Manrope] text-xl font-extrabold sm:text-2xl">{title}</h2><p className="text-xs text-[#4B5563]">{subtitle}</p></div></div><Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-bold text-[#0077FF] hover:underline">{action}<ArrowRight className="h-4 w-4" /></Link></div>
}

function EmptySection({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#E5EAF0] bg-[#F8FAFC] px-5 py-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm"><Store className="h-5 w-5 text-[#0077FF]" /></span><div><h3 className="font-bold">{title}</h3><p className="mt-1 max-w-2xl text-sm text-[#4B5563]">{text}</p></div></div><Link href={href} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#0B2240] px-4 py-2 text-sm font-bold">{action}<ArrowRight className="h-4 w-4" /></Link></div>
}

export default function HomePage() {
  const [, navigate] = useLocation()
  const [search, setSearch] = React.useState("")
  const { city, state } = useMarketplaceCity()
  const region = city ? `${city}${state ? `, ${state}` : ""}` : "Escolha sua cidade"
  const [homeData, setHomeData] = React.useState<any>(null)
  const [catalogData, setCatalogData] = React.useState<any>(null)
  const [homeLoading, setHomeLoading] = React.useState(false)
  const [catalogLoading, setCatalogLoading] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const { user } = useAuth()
  React.useEffect(() => {
    if (!city) {
      setHomeData(null)
      setCatalogData(null)
      setHomeLoading(false)
      setCatalogLoading(false)
      return
    }
    const params = new URLSearchParams({ cidade: city, estado: state, page: "1", limit: "12" })
    const homeParams = new URLSearchParams({ cidade: city, estado: state })
    const controller = new AbortController()
    setHomeLoading(true)
    setCatalogLoading(true)
    Promise.all([
      fetch(`/api/home?${homeParams.toString()}`, { credentials: "include", signal: controller.signal }).then((r) => r.ok ? r.json() : Promise.reject(new Error("home"))).then(setHomeData).catch((e) => { if (e.name !== "AbortError") setHomeData(null) }).finally(() => setHomeLoading(false)),
      fetch(`/api/products?${params.toString()}`, { credentials: "include", signal: controller.signal }).then((r) => r.ok ? r.json() : Promise.reject(new Error("catalog"))).then(setCatalogData).catch((e) => { if (e.name !== "AbortError") setCatalogData(null) }).finally(() => setCatalogLoading(false)),
    ])
    return () => controller.abort()
  }, [city, state])
  const { data: cart } = useGetCart({ query: { queryKey: getGetCartQueryKey() } })
  const { data: favorites } = useListFavorites({ query: { queryKey: getListFavoritesQueryKey(), enabled: Boolean(user) } })
  const products = React.useMemo(() => {
    const source = [...(homeData?.flashDeals ?? []), ...(catalogData?.products ?? []), ...(homeData?.featuredProducts ?? []), ...(homeData?.carousels.flatMap((item) => item.products) ?? [])]
    return [...new Map(source.map((product) => [product.id, product])).values()].slice(0, 12).map(toCard)
  }, [catalogData?.products, homeData])
  const cartCount = cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0
  const favoriteCount = favorites?.length ?? 0
  const stores = React.useMemo(() => [...new Map(products.flatMap((product) => product.vendorId ? [[product.vendorId, { id: product.vendorId, name: product.vendorName, logo: product.vendorLogoUrl }] as const] : [])).values()].slice(0, 8), [products])
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (city.trim()) params.set("cidade", city.trim())
    if (state.trim()) params.set("estado", state.trim())
    navigate(`/listing${params.size ? `?${params.toString()}` : ""}`)
  }

  return <div className="praca-mobile-home min-h-full bg-white text-[#0B2240]">
    <div className="sticky top-0 z-50 bg-[#0B2240] text-white shadow-sm md:hidden">
      <div className="flex h-12 items-center justify-between px-4"><Brand /><Link href="/checkout" aria-label="Carrinho" className="relative p-2"><ShoppingCart className="h-5 w-5" />{cartCount > 0 && <span className="absolute right-0 top-0 rounded-full bg-[#10D3B8] px-1 text-[10px] text-[#0B2240]">{cartCount}</span>}</Link></div>
      <form onSubmit={submitSearch} className="mx-3 flex h-10 overflow-hidden rounded-lg bg-white"><input aria-label="Buscar" value={search} onChange={e=>setSearch(e.target.value)} placeholder="O que você está procurando?" className="min-w-0 flex-1 px-3 text-sm text-[#0B2240] outline-none" /><button aria-label="Buscar" className="grid w-11 place-items-center bg-[#10D3B8] text-[#0B2240]"><Search className="h-5 w-5" /></button></form>
      <MarketplaceCityPicker compact />
    </div>
    <header className="sticky top-0 z-40 hidden shadow-sm md:block">
      <div className="bg-[#0B2240] text-white"><div className="mx-auto flex min-h-18 max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6"><Brand /><div className="hidden md:block"><MarketplaceCityPicker /></div><form onSubmit={submitSearch} className="hidden min-w-0 flex-1 items-center overflow-hidden rounded-xl bg-white lg:flex"><Search className="ml-4 h-5 w-5 shrink-0 text-slate-400" /><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="O que você está procurando?" className="h-11 min-w-0 flex-1 px-3 text-sm text-[#0B2240] outline-none" /><button className="grid h-11 w-13 place-items-center bg-[#10D3B8] text-[#0B2240]" aria-label="Buscar"><Search className="h-5 w-5" /></button></form><div className="ml-auto flex items-center gap-1"><Link href="/profile" className="hidden items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-white/10 sm:flex"><User className="h-5 w-5" /><span>Minha conta<br /><strong>{user?.name?.split(" ")[0] ?? "Entrar"}</strong></span></Link><Link href="/orders" aria-label="Pedidos" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10"><Package className="h-5 w-5" /></Link><Link href="/favorites" aria-label={`Favoritos${favoriteCount ? `: ${favoriteCount}` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10"><Heart className="h-5 w-5" />{favoriteCount ? <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#10D3B8] px-1 text-[9px] font-black text-[#0B2240]">{favoriteCount}</span> : null}</Link><Link href="/checkout" aria-label={`Carrinho${cartCount ? `: ${cartCount} itens` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10"><ShoppingCart className="h-5 w-5" />{cartCount ? <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#10D3B8] px-1 text-[9px] font-black text-[#0B2240]">{cartCount}</span> : null}</Link><button type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={()=>setMenuOpen((open)=>!open)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10 lg:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div></div></div>
      <div className="border-b border-[#E5EAF0] bg-white"><nav aria-label="Categorias principais" className="mx-auto flex h-12 max-w-[1500px] items-center gap-1 overflow-x-auto px-4 lg:px-6"><Link href="/listing" className="flex shrink-0 items-center gap-2 rounded-lg bg-[#10D3B8] px-4 py-2 text-xs font-extrabold"><Grid2X2 className="h-4 w-4" />Todas as categorias<ChevronDown className="h-3.5 w-3.5" /></Link>{NAV_ITEMS.map(([label,href])=><Link key={label} href={href} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC]">{label}</Link>)}<a href={ARQDOR_PROJECTS_URL} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[#F8FAFC]">Projetos</a><Link href="/marketplace" className="ml-auto shrink-0 rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-extrabold text-white">Vender no Praça.ai</Link></nav></div>
      {menuOpen ? <div className="border-b bg-white p-4 lg:hidden"><form onSubmit={submitSearch} className="flex overflow-hidden rounded-xl border"><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Buscar no Praça.ai" className="h-11 min-w-0 flex-1 px-3 text-sm outline-none" /><button className="w-12 bg-[#10D3B8]" aria-label="Buscar"><Search className="mx-auto h-5 w-5" /></button></form><nav className="mt-3 grid grid-cols-2 gap-2 text-sm">{NAV_ITEMS.map(([label,href])=><Link key={label} href={href} className="rounded-lg bg-[#F8FAFC] px-3 py-2 font-semibold">{label}</Link>)}<a href={ARQDOR_PROJECTS_URL} target="_blank" rel="noreferrer" className="rounded-lg bg-[#F8FAFC] px-3 py-2 font-semibold">Projetos no ARQDOR</a></nav></div> : null}
    </header>

    <main className="mx-auto max-w-[1500px] px-3 py-3 pb-20 md:px-4 md:py-4 lg:px-6">
      {!city && <div className="mb-4 rounded-xl border border-[#BCEDE5] bg-[#F0FCFA] p-4 text-sm"><strong>Escolha sua cidade</strong><p className="mt-1 text-[#64748B]">O Praça.ai mostra produtos e rodadas disponíveis no município selecionado.</p></div>}
      <nav aria-label="Categorias rápidas" className="mb-3 flex gap-3 overflow-x-auto pb-2 md:hidden">{[["Ofertas","/listing?sort=offers",BadgeCheck],["Eletrônicos","/listing?category=eletronicos-cameras-e-audio",Laptop],["Casa","/listing?category=casa-moveis-e-decoracao",Home],["Moda","/listing?category=calcados-roupas-e-bolsas",Shirt],["Veículos","/veiculos",Car],["Serviços","/servicos",Wrench],["Mais","/listing",Grid2X2]].map(([label,href,Icon])=><Link key={label as string} href={href as string} className="flex min-w-16 flex-col items-center gap-1 text-center text-[10px] font-semibold"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#EDF6FB]"><Icon className="h-5 w-5" /></span>{label as string}</Link>)}</nav>
      <section className="mb-3 rounded-xl bg-[#0B2240] px-4 py-4 text-white md:hidden"><h1 className="font-[Manrope] text-lg font-extrabold">Tudo o que você precisa, <span className="text-[#10D3B8]">em um só lugar.</span></h1><p className="my-2 text-xs text-white/80">Produtos e oportunidades para você.</p><Link href="/listing" className="inline-flex items-center gap-1 rounded-lg bg-[#10D3B8] px-3 py-2 text-xs font-bold text-[#0B2240]">Ver ofertas <ArrowRight className="h-3 w-3" /></Link></section>
      <section className="hidden gap-3 md:grid xl:grid-cols-[210px_1fr_320px]">
        <nav aria-label="Departamentos" className="hidden rounded-2xl border border-[#E5EAF0] bg-white p-2 xl:block">{CATEGORIES.map(([label,href,Icon])=><Link key={label} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold hover:bg-[#F8FAFC] hover:text-[#0077FF]"><Icon className="h-4 w-4" />{label}</Link>)}<Link href="/listing" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-extrabold text-[#0077FF]"><Grid2X2 className="h-4 w-4" />Ver todas as categorias</Link></nav>
        <article className="relative min-h-[350px] overflow-hidden rounded-2xl bg-[#0B2240] text-white"><img src={HERO_IMAGE} alt="Casa moderna representando negócios e oportunidades locais" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#07172C]/95 via-[#07172C]/65 to-transparent" /><div className="relative flex min-h-[350px] max-w-xl flex-col justify-center p-7 sm:p-10"><span className="mb-4 w-fit rounded-full bg-[#10D3B8] px-3 py-1 text-xs font-extrabold text-[#0B2240]">Marketplace da sua cidade</span><h1 className="font-[Manrope] text-4xl font-extrabold leading-[.98] sm:text-5xl">Tudo para comprar, vender e negociar <span className="text-[#10D3B8]">em um só lugar.</span></h1><p className="mt-4 max-w-lg text-sm text-white/80 sm:text-base">Produtos, serviços, imóveis e fornecedores com a segurança e a inteligência do Praça.ai.</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/listing" className="inline-flex items-center gap-2 rounded-xl bg-[#10D3B8] px-5 py-3 text-sm font-extrabold text-[#0B2240]">Comprar agora<ArrowRight className="h-4 w-4" /></Link><Link href="/cotacao" className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-[#0B2240]/40 px-5 py-3 text-sm font-extrabold"><ClipboardList className="h-4 w-4" />Solicitar cotação</Link><Link href="/marketplace" className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-[#0B2240]/40 px-5 py-3 text-sm font-extrabold"><Store className="h-4 w-4" />Vender no Praça.ai</Link></div></div></article>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><article className="relative min-h-40 overflow-hidden rounded-2xl bg-[#0B2240] p-5 text-white"><div className="absolute inset-y-0 right-0 w-2/5 bg-[linear-gradient(135deg,#10D3B8,#0077FF)] opacity-25" /><div className="relative max-w-[70%]"><p className="text-xs font-bold text-[#10D3B8]">NEGÓCIOS B2B</p><h2 className="mt-1 font-[Manrope] text-xl font-extrabold">Sua obra completa com os melhores fornecedores</h2><p className="mt-1 text-xs text-white/70">Compare propostas e negocie em volume.</p><Link href="/cotacao" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#10D3B8] px-3 py-2 text-xs font-extrabold text-[#0B2240]">Solicitar cotação<ArrowRight className="h-3.5 w-3.5" /></Link></div></article><article className="relative min-h-40 overflow-hidden rounded-2xl bg-[#E8F2FF] p-5"><div className="max-w-[65%]"><p className="text-xs font-bold text-[#0077FF]">IMÓVEIS</p><h2 className="mt-1 font-[Manrope] text-xl font-extrabold">Oportunidades em destaque na sua cidade</h2><p className="mt-1 text-xs text-[#4B5563]">Casas, terrenos e empreendimentos.</p><Link href="/imoveis" className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[#0B2240] px-3 py-2 text-xs font-extrabold">Ver imóveis<ArrowRight className="h-3.5 w-3.5" /></Link></div><Home className="absolute bottom-3 right-4 h-20 w-20 text-[#0077FF]/20" /></article></div>
      </section>

      <section aria-label="Atalhos de categorias" className="mt-3 hidden md:flex gap-2 overflow-x-auto rounded-2xl border border-[#E5EAF0] bg-white p-2">{QUICK_CATEGORIES.map(([label,href,Icon])=><Link key={label} href={href} className="group flex min-w-28 flex-1 flex-col items-center gap-2 rounded-xl px-3 py-3 text-center text-xs font-bold hover:bg-[#F8FAFC]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F0F7FF] text-[#0077FF] group-hover:bg-[#10D3B8] group-hover:text-[#0B2240]"><Icon className="h-5 w-5" /></span>{label}</Link>)}</section>


      <section aria-label="Formas de negociar" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Link href="/listing" className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#E5EAF0] bg-white p-4 transition hover:border-[#10D3B8] hover:shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><ShoppingCart className="h-5 w-5" /></span><span><strong className="block text-sm">Comprar no marketplace</strong><span className="text-xs text-[#64748B]">Encontre produtos e lojas</span></span></Link>
        <Link href="/cotacao" className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#E5EAF0] bg-white p-4 transition hover:border-[#10D3B8] hover:shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><ClipboardList className="h-5 w-5" /></span><span><strong className="block text-sm">Pedir cotação</strong><span className="text-xs text-[#64748B]">Envie uma necessidade a lojas</span></span></Link>
        <Link href="/rodadas" className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#BCEDE5] bg-[#F0FCFA] p-4 transition hover:border-[#10D3B8] hover:shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#10D3B8]/20 text-[#008878]"><Users className="h-5 w-5" /></span><span><strong className="block text-sm">Rodadas de negócios</strong><span className="text-xs text-[#64748B]">Veja lotes e oportunidades</span></span></Link>
        <a href={ARQDOR_PROJECTS_URL} target="_blank" rel="noreferrer" className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#BFDBFE] bg-[#E8F2FF] p-4 transition hover:border-[#0077FF] hover:shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#0077FF]"><Building2 className="h-5 w-5" /></span><span><strong className="block text-sm">Criar pré-projeto</strong><span className="text-xs text-[#64748B]">Planeje sua obra no Arqdor</span></span></a>
      </section>
      <div className="space-y-8 py-8">
        <section><SectionHeading icon={BadgeCheck} title="Ofertas do dia" subtitle="Produtos reais das lojas conectadas ao Praça.ai." href="/listing?sort=offers" action="Ver todas as ofertas" />{(homeLoading || catalogLoading) && !products.length ? <PageLoader /> : products.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{products.slice(0,6).map((product)=><ProductCard key={product.id} product={product} className="h-full" compact />)}</div> : <EmptySection title="As ofertas estão sendo atualizadas" text="Explore o catálogo completo enquanto as lojas publicam novas condições." href="/listing" action="Explorar produtos" />}</section>

        <section className="grid gap-3 md:grid-cols-3"><article className="relative overflow-hidden rounded-2xl bg-[#083B45] p-6 text-white"><Hammer className="absolute -bottom-5 right-2 h-28 w-28 text-[#10D3B8]/20" /><div className="relative"><p className="text-xs font-bold text-[#10D3B8]">PARA SUA OBRA</p><h2 className="mt-1 font-[Manrope] text-2xl font-extrabold">Materiais e ferramentas perto de você</h2><Link href="/listing?category=construcao" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#10D3B8] px-4 py-2.5 text-sm font-extrabold text-[#0B2240]">Ver produtos<ArrowRight className="h-4 w-4" /></Link></div></article><article className="relative overflow-hidden rounded-2xl bg-[#075EC8] p-6 text-white"><Users className="absolute -bottom-5 right-2 h-28 w-28 text-white/15" /><div className="relative"><p className="text-xs font-bold text-white/70">NEGÓCIOS B2B</p><h2 className="mt-1 font-[Manrope] text-2xl font-extrabold">Compare fornecedores e compre em volume</h2><Link href="/cotacao" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-[#075EC8]">Saiba mais<ArrowRight className="h-4 w-4" /></Link></div></article><article className="relative overflow-hidden rounded-2xl border border-[#BFDBFE] bg-[#E8F2FF] p-6"><Store className="absolute -bottom-5 right-2 h-28 w-28 text-[#0077FF]/15" /><div className="relative"><p className="text-xs font-bold text-[#0077FF]">SEJA UM VENDEDOR</p><h2 className="mt-1 font-[Manrope] text-2xl font-extrabold">Amplie suas vendas no Praça.ai</h2><Link href="/marketplace" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0077FF] px-4 py-2.5 text-sm font-extrabold text-white">Cadastre-se grátis<ArrowRight className="h-4 w-4" /></Link></div></article></section>

        {homeData?.carousels.slice(0,2).map((carousel,index)=><section key={carousel.category.id}><SectionHeading icon={index===0 ? Home : Wrench} title={carousel.category.name} subtitle="Seleção atualizada com dados reais do catálogo." href={`/listing?category=${carousel.category.slug}`} action="Ver todos" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{carousel.products.slice(0,6).map((product)=><ProductCard key={product.id} product={toCard(product)} className="h-full" compact />)}</div></section>)}

        <section><SectionHeading icon={Store} title="Lojas em destaque" subtitle="Fornecedores com produtos ativos no Praça.ai." href="/listing" action="Ver catálogo" />{stores.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{stores.map((store)=><Link key={store.id} href={`/listing?vendorId=${encodeURIComponent(store.id)}`} className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-[#E5EAF0] p-4 text-center transition hover:border-[#10D3B8] hover:shadow-md">{store.logo ? <img src={store.logo} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-[#E8F2FF] font-[Manrope] text-lg font-extrabold text-[#0077FF]">{store.name.charAt(0)}</span>}<span className="mt-3 line-clamp-2 text-xs font-extrabold">{store.name}</span></Link>)}</div> : <EmptySection title="Nenhuma loja disponível agora" text="As lojas aparecem aqui quando publicam produtos ativos." href="/servicos" action="Explorar empresas" />}</section>

        <section aria-label="Benefícios do Praça.ai" className="grid gap-3 rounded-2xl border border-[#E5EAF0] bg-[#F8FAFC] p-4 sm:grid-cols-2 lg:grid-cols-4">{[[ShieldCheck,"Compra segura","Seus dados protegidos"],[Truck,"Entrega para todo o Brasil","Opções conforme cada vendedor"],[CreditCard,"Pague como quiser","Formas disponíveis no checkout"],[Headphones,"Suporte especializado","Para você e sua empresa"]].map(([Icon,title,text])=><div key={title as string} className="flex items-center gap-3 rounded-xl bg-white p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E8F2FF] text-[#0077FF]"><Icon className="h-5 w-5" /></span><div><h2 className="text-sm font-extrabold">{title as string}</h2><p className="text-xs text-[#4B5563]">{text as string}</p></div></div>)}</section>
      </div>
    </main>

    <nav aria-label="Navegação mobile" className="fixed inset-x-0 bottom-0 z-50 grid h-[calc(60px+env(safe-area-inset-bottom))] grid-cols-5 border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {[[Home,"Início","/"],[ShoppingCart,"Comprar","/listing"],[ClipboardList,"Cotação","/cotacao"],[Users,"Rodadas","/rodadas"],[User,"Conta","/profile"]].map(([Icon,label,href])=><Link key={label as string} href={href as string} className="flex flex-col items-center justify-center gap-1 text-[10px] text-[#0B2240]"><Icon className="h-5 w-5" />{label as string}</Link>)}
    </nav>
    <footer className="hidden bg-[#0B2240] px-4 py-10 text-white md:block lg:px-7"><div className="mx-auto grid max-w-[1500px] gap-8 sm:grid-cols-2 lg:grid-cols-4"><div><p className="font-[Manrope] text-xl font-extrabold">Praça<span className="text-[#10D3B8]">.ai</span></p><p className="mt-2 text-sm text-white/60">Tudo para seus negócios, em um só lugar.</p></div><div><h2 className="font-bold">Explore</h2><div className="mt-3 grid gap-2 text-sm text-white/65"><Link href="/listing">Categorias</Link><Link href="/imoveis">Imóveis</Link><Link href="/veiculos">Veículos</Link></div></div><div><h2 className="font-bold">Sua conta</h2><div className="mt-3 grid gap-2 text-sm text-white/65"><Link href="/favorites">Favoritos</Link><Link href="/orders">Compras</Link><Link href="/profile">Área pessoal</Link></div></div><div><h2 className="font-bold">Negócios</h2><div className="mt-3 grid gap-2 text-sm text-white/65"><Link href="/cotacao">Solicitar cotação</Link><Link href="/marketplace">Vender no Praça.ai</Link><span>Atendimento na sua cidade</span></div></div></div></footer>
  </div>
}
