import * as React from "react"
import { ArrowRight, Building2, Car, ChevronDown, ClipboardList, Grid2X2, Hammer, Heart, Home, Laptop, Leaf, MapPin, Menu, MessageCircle, Package, Search, Shirt, ShoppingCart, Store, User, Users, Wrench, X } from "lucide-react"
import { getGetHomeQueryKey, getListProductsQueryKey, useGetHome, useListProducts } from "@workspace/api-client-react"
import type { Product } from "@workspace/api-client-react"
import { Link, useLocation } from "wouter"
import { ProductCard, type ProductCardData } from "@/components/ProductCard"
import { PageLoader } from "@/components/ui/skeleton"

const TYPES = [["Tudo", "/listing"], ["Produtos", "/listing"], ["Imóveis", "/imoveis"], ["Veículos", "/veiculos"], ["Serviços", "/servicos"], ["Empresas", "/listing"]] as const
const CATEGORIES = [
  ["Imóveis", "/imoveis", Home], ["Construção", "/listing?category=construcao", Hammer], ["Casa e decoração", "/listing?category=casa-moveis-e-decoracao", Building2],
  ["Eletrônicos", "/listing?category=eletronicos-cameras-e-audio", Laptop], ["Veículos", "/veiculos", Car], ["Agro", "/listing?category=agro", Leaf],
  ["Moda", "/listing?category=calcados-roupas-e-bolsas", Shirt], ["Serviços", "/servicos", Wrench],
] as const
const SHOWCASES = [
  ["Encontre seu imóvel", "Casas, apartamentos, terrenos e oportunidades na região.", "/imoveis", "Ver imóveis", Home, "from-[#08233d] to-[#174d73]"],
  ["Construa ou reforme", "Materiais, ferramentas e serviços para o seu projeto.", "/listing?category=construcao", "Ver opções", Hammer, "from-[#17354d] to-[#806b40]"],
  ["Equipe e decore", "Móveis, eletrodomésticos e soluções para a sua casa.", "/listing?category=casa-moveis-e-decoracao", "Ver produtos", Building2, "from-[#263a42] to-[#8b6a4b]"],
] as const

function toCard(product: Product): ProductCardData { return { ...product } }
function SectionHeading({ title, href, action }: { title: string; href: string; action: string }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2><Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-bold text-[#075fb9] hover:underline">{action}<ArrowRight className="h-4 w-4" /></Link></div>
}
function EmptySection({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"><Package className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-bold">{title}</h3><p className="mx-auto mt-1 max-w-lg text-sm text-slate-600">{text}</p><Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#0b2742] px-4 py-2 text-sm font-bold">{action}<ArrowRight className="h-4 w-4" /></Link></div>
}

export default function HomePage() {
  const [, navigate] = useLocation()
  const [search, setSearch] = React.useState("")
  const [region, setRegion] = React.useState("Chapecó, SC")
  const [menuOpen, setMenuOpen] = React.useState(false)
  const { data: homeData, isLoading: homeLoading } = useGetHome({ query: { queryKey: getGetHomeQueryKey() } })
  const { data: catalogData, isLoading: catalogLoading } = useListProducts({ page: 1, limit: 12 }, { query: { queryKey: getListProductsQueryKey({ page: 1, limit: 12 }) } })
  const products = React.useMemo(() => {
    const source = [...(catalogData?.products ?? []), ...(homeData?.featuredProducts ?? []), ...(homeData?.flashDeals ?? []), ...(homeData?.carousels.flatMap((item) => item.products) ?? [])]
    return [...new Map(source.map((product) => [product.id, product])).values()].slice(0, 5).map(toCard)
  }, [catalogData?.products, homeData])
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (region.trim()) params.set("location", region.trim())
    navigate(`/listing${params.size ? `?${params.toString()}` : ""}`)
  }

  return <div className="min-h-full bg-white text-[#0b2742]">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 lg:px-7">
        <Link href="/" aria-label="Praça.ai — página inicial" className="flex shrink-0 items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#ffc400]"><Store className="h-6 w-6" /></span>Praça<span className="-ml-2">.ai</span></Link>
        <Link href="/account/endereco" className="hidden items-center gap-1 text-xs font-semibold text-slate-700 md:flex"><MapPin className="h-4 w-4 text-[#0868c7]" />{region}<ChevronDown className="h-3.5 w-3.5" /></Link>
        <nav aria-label="Navegação principal" className="ml-auto hidden items-center gap-7 text-sm font-semibold lg:flex"><Link href="/listing">Todas as categorias</Link><Link href="/listing?sort=offers">Ofertas</Link><Link href="/profile">Cotações</Link><Link href="/profile">Compras em grupo</Link></nav>
        <div className="ml-auto flex items-center gap-1.5 lg:ml-2"><Link href="/marketplace" className="hidden rounded-lg border border-[#e3ad00] px-4 py-2 text-sm font-bold sm:inline-flex">Anunciar</Link><Link href="/favorites" aria-label="Favoritos" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100"><Heart className="h-5 w-5" /></Link><Link href="/profile" aria-label="Minha conta" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100"><User className="h-5 w-5" /></Link><Link href="/checkout" aria-label="Carrinho" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100"><ShoppingCart className="h-5 w-5" /></Link><button type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100 lg:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div>
      </div>
      {menuOpen ? <nav aria-label="Navegação móvel" className="border-t border-slate-200 px-4 py-3 lg:hidden"><div className="grid gap-1 text-sm font-semibold"><Link href="/listing" className="rounded-lg px-3 py-2">Todas as categorias</Link><Link href="/listing?sort=offers" className="rounded-lg px-3 py-2">Ofertas</Link><Link href="/profile" className="rounded-lg px-3 py-2">Cotações e compras em grupo</Link><Link href="/marketplace" className="rounded-lg px-3 py-2">Anunciar</Link></div></nav> : null}
    </header>
    <main>
      <section className="overflow-hidden border-b border-slate-200 bg-[linear-gradient(100deg,#fff_0%,#fff_53%,#f2f7fb_100%)]"><div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 lg:grid-cols-[1.1fr_.9fr] lg:px-7 lg:py-14">
        <div className="self-center"><p className="mb-3 text-sm font-bold uppercase tracking-[.16em] text-[#0868c7]">Marketplace da sua região</p><h1 className="max-w-3xl text-4xl font-extrabold leading-[1.04] tracking-[-.035em] sm:text-5xl lg:text-6xl">Encontre, compre e negocie na sua região.</h1><p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">Produtos, imóveis, veículos, serviços e oportunidades em um só lugar.</p>
          <form onSubmit={submitSearch} className="mt-7 grid gap-2 rounded-xl bg-white p-2 shadow-[0_12px_35px_rgba(11,39,66,.14)] ring-1 ring-slate-200 sm:grid-cols-[1fr_190px_auto]"><label className="flex min-w-0 items-center gap-3 px-3"><Search className="h-5 w-5 shrink-0 text-slate-500" /><span className="sr-only">O que você está procurando?</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que você está procurando?" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><label className="flex items-center gap-2 border-t border-slate-200 px-3 sm:border-l sm:border-t-0"><MapPin className="h-4 w-4 shrink-0 text-[#0868c7]" /><span className="sr-only">Localização</span><input value={region} onChange={(event) => setRegion(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#ffc400] px-7 text-sm font-extrabold shadow-[0_6px_16px_rgba(255,196,0,.32)]"><Search className="h-4 w-4" />Buscar</button></form>
          <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Tipos de resultado">{TYPES.map(([label, href], index) => <Link key={label} href={href} className={`shrink-0 rounded-lg px-4 py-2 text-xs font-bold ${index === 0 ? "bg-[#0b2742] text-white" : "bg-slate-100 text-slate-700"}`}>{label}</Link>)}</div>
        </div>
        <div className="relative hidden min-h-[330px] lg:block" aria-hidden="true"><div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#ffc400]/35" /><div className="absolute inset-4 grid grid-cols-2 gap-4">{[[Home, "Imóveis", "translate-y-8 bg-[#0b2742] text-white"], [Car, "Veículos", "bg-white"], [Laptop, "Produtos", "translate-y-8 bg-white"], [Wrench, "Serviços", "bg-[#ffc400]"]].map(([Icon, label, classes]) => <div key={label as string} className={`flex flex-col justify-between rounded-3xl border border-slate-200 p-6 shadow-xl ${classes as string}`}><Icon className="h-10 w-10" /><span className="text-xl font-extrabold">{label as string}</span></div>)}</div></div>
      </div></section>
      <section aria-label="Categorias em destaque" className="border-b border-slate-200"><div className="mx-auto grid max-w-[1400px] grid-cols-3 px-4 sm:grid-cols-5 lg:grid-cols-9 lg:px-7">{CATEGORIES.map(([label, href, Icon]) => <Link key={label} href={href} className="group flex min-h-24 flex-col items-center justify-center gap-2 border-b border-r border-slate-200 px-2 py-4 text-center text-xs font-semibold hover:bg-slate-50 sm:min-h-28 sm:text-sm"><Icon className="h-6 w-6 group-hover:text-[#0868c7]" />{label}</Link>)}<Link href="/listing" className="flex min-h-24 flex-col items-center justify-center gap-2 border-b border-slate-200 px-2 py-4 text-center text-xs font-semibold hover:bg-slate-50 sm:min-h-28 sm:text-sm"><Grid2X2 className="h-6 w-6" />Ver todas</Link></div></section>
      <div className="mx-auto max-w-[1400px] space-y-10 px-4 py-9 lg:px-7 lg:py-12">
        <section><SectionHeading title="Destaques da sua região" href="/listing" action="Ver mais ofertas" />{(homeLoading || catalogLoading) && products.length === 0 ? <PageLoader /> : null}{products.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map((product) => <ProductCard key={product.id} product={product} className="h-full" compact />)}</div> : !homeLoading && !catalogLoading ? <EmptySection title="Novas ofertas estão chegando" text="As empresas da região ainda estão publicando seus catálogos. Explore as categorias ou volte em breve." href="/listing" action="Explorar categorias" /> : null}</section>
        <section><SectionHeading title="Imóveis, construção e tudo para sua casa" href="/imoveis" action="Ver mais" /><div className="grid gap-3 md:grid-cols-3">{SHOWCASES.map(([title, description, href, action, Icon, className]) => <article key={title} className={`relative min-h-56 overflow-hidden rounded-xl bg-gradient-to-br p-6 text-white ${className}`}><Icon className="absolute right-5 top-5 h-20 w-20 opacity-15" /><div className="relative flex h-full flex-col justify-end"><h3 className="text-xl font-extrabold">{title}</h3><p className="mt-1 max-w-xs text-sm text-white/85">{description}</p><Link href={href} className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-[#ffc400] px-4 py-2 text-sm font-extrabold text-[#0b2742]">{action}<ArrowRight className="h-4 w-4" /></Link></div></article>)}</div></section>
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Ferramentas de negociação"><article className="flex flex-col gap-5 rounded-xl bg-[#082f54] p-6 text-white sm:flex-row sm:items-center"><ClipboardList className="h-12 w-12 shrink-0" /><div className="flex-1"><h2 className="text-xl font-extrabold">Precisa de uma cotação?</h2><p className="mt-1 text-sm text-white/75">Organize sua necessidade e acompanhe as opções disponíveis para sua empresa.</p></div><Link href="/profile" className="rounded-lg bg-[#ffc400] px-4 py-2.5 text-center text-sm font-extrabold text-[#0b2742]">Acessar minha área</Link></article><article className="flex flex-col gap-5 rounded-xl bg-[#fff8df] p-6 sm:flex-row sm:items-center"><Users className="h-12 w-12 shrink-0" /><div className="flex-1"><h2 className="text-xl font-extrabold">Listas e projetos</h2><p className="mt-1 text-sm text-slate-700">Salve referências e organize o que pretende comprar, contratar ou comparar.</p></div><Link href="/favorites" className="rounded-lg bg-[#ffc400] px-4 py-2.5 text-center text-sm font-extrabold">Ver itens salvos</Link></article></section>
        <section><SectionHeading title="Juntos, compramos melhor" href="/profile" action="Ver compras em grupo" /><EmptySection title="Nenhum grupo aberto na sua região" text="Quando houver uma negociação coletiva disponível e compatível com sua região, ela aparecerá aqui com prazo e condições reais." href="/profile" action="Acompanhar oportunidades" /></section>
        <section><SectionHeading title="Empresas e serviços perto de você" href="/servicos" action="Ver mais empresas" /><EmptySection title="Empresas da região estão chegando" text="Explore os prestadores já disponíveis ou ajuste sua localização para ampliar os resultados." href="/servicos" action="Explorar serviços" /></section>
      </div>
    </main>
    <footer className="bg-[#071d31] px-4 py-10 text-white lg:px-7"><div className="mx-auto grid max-w-[1400px] gap-8 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xl font-extrabold">Praça<span className="text-[#ffc400]">.ai</span></p><p className="mt-2 text-sm text-white/60">Encontre, compre e negocie na sua região.</p></div><div><h2 className="font-bold">Explore</h2><div className="mt-3 grid gap-2 text-sm text-white/65"><Link href="/listing">Categorias</Link><Link href="/imoveis">Imóveis</Link><Link href="/veiculos">Veículos</Link></div></div><div><h2 className="font-bold">Sua conta</h2><div className="mt-3 grid gap-2 text-sm text-white/65"><Link href="/favorites">Favoritos</Link><Link href="/orders">Compras</Link><Link href="/profile">Área pessoal</Link></div></div><div><h2 className="font-bold">Atendimento</h2><div className="mt-3 grid gap-2 text-sm text-white/65"><Link href="/profile" className="flex items-center gap-2"><MessageCircle className="h-4 w-4" />Ajuda e contato</Link><span>Chapecó e região</span></div></div></div></footer>
  </div>
}
