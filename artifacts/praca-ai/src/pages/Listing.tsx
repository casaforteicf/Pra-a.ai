import * as React from "react"
import { Link, useLocation } from "wouter"
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  GraduationCap,
  Heart,
  Menu,
  PackageCheck,
  Palette,
  PenLine,
  Scissors,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Truck,
} from "lucide-react"
import { getListProductsQueryKey, useListProducts } from "@workspace/api-client-react"
import type { ListProductsSort } from "@workspace/api-client-react"
import { ProductCard } from "@/components/ProductCard"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const STATIONERY_SLUG = "arte-papelaria-e-armarinho"

const stationeryDepartments = [
  { label: "Escolar", icon: GraduationCap, search: "escolar" },
  { label: "Cadernos", icon: BookOpen, search: "caderno" },
  { label: "Escrita", icon: PenLine, search: "caneta" },
  { label: "Arte", icon: Palette, search: "arte" },
  { label: "Escritório", icon: BriefcaseBusiness, search: "escritório" },
  { label: "Armarinho", icon: Scissors, search: "armarinho" },
]

const sortOptions: Array<{ label: string; value: ListProductsSort }> = [
  { label: "Relevância", value: "relevance" },
  { label: "Menor preço", value: "price_asc" },
  { label: "Maior preço", value: "price_desc" },
  { label: "Mais vendidos", value: "best_sellers" },
  { label: "Avaliação", value: "rating" },
  { label: "Ofertas", value: "offers" },
]

export default function ListingPage() {
  const [, setLocation] = useLocation()
  const searchParams = new URLSearchParams(window.location.search)
  const categorySlug = searchParams.get("category") || undefined
  const isStationery = categorySlug === STATIONERY_SLUG
  const [search, setSearch] = React.useState("")
  const [submittedSearch, setSubmittedSearch] = React.useState("")
  const [sort, setSort] = React.useState<ListProductsSort>("relevance")

  const requestParams = { category: categorySlug, search: submittedSearch || undefined, sort, limit: 40 }
  const { data: listData, isLoading, isError } = useListProducts(requestParams, {
    query: { queryKey: getListProductsQueryKey(requestParams) },
  })

  const submitSearch = (event?: React.FormEvent) => {
    event?.preventDefault()
    setSubmittedSearch(search.trim())
  }

  const selectDepartment = (departmentSearch: string) => {
    setSearch(departmentSearch)
    setSubmittedSearch(departmentSearch)
  }

  if (!isStationery) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col bg-background pb-8">
        <header className="sticky inset-x-0 top-0 z-30 border-b bg-background/95 px-4 pb-3 pt-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3"><button onClick={() => setLocation("/")} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><ChevronLeft className="h-6 w-6" /></button><div className="flex-1"><h1 className="text-xl font-black capitalize">{categorySlug ? categorySlug.replaceAll("-", " ") : "Explorar"}</h1>{listData && <p className="text-xs font-bold text-muted-foreground">{listData.total} resultados</p>}</div></div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{sortOptions.map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-bold", sort === option.value ? "border-primary bg-primary text-white" : "bg-white")}>{option.label}</button>)}</div>
        </header>
        {isLoading && <PageLoader />}
        {listData && <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">{listData.products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      </div>
    )
  }

  return (
    <div className="min-h-full w-full bg-[#f4f6f8] pb-12 text-slate-950">
      <header className="bg-[#174667] text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6 lg:gap-8 lg:px-8 lg:py-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-black"><Store className="h-7 w-7 fill-white" /> Praça.ai <span className="hidden text-sm font-semibold text-white/70 sm:inline">Papelaria</span></Link>
          <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que vamos buscar hoje?" className="h-12 border-0 bg-white pl-12 pr-12 text-slate-950" />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary p-2"><ArrowRight className="h-4 w-4" /></button>
          </form>
          <div className="flex items-center gap-3 justify-self-end"><Link href="/profile" className="hidden text-sm font-bold sm:block">Entre ou cadastre-se</Link><span className="rounded-full bg-white/15 p-2.5"><ShoppingCart className="h-5 w-5" /></span></div>
        </div>
        <nav className="border-t border-white/10 bg-[#2f78a7]">
          <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4 py-3 text-xs font-black uppercase sm:px-6 lg:px-8">
            <span className="flex shrink-0 items-center gap-2"><Menu className="h-4 w-4" /> Departamentos</span>
            {stationeryDepartments.map((item) => <button key={item.label} onClick={() => selectDepartment(item.search)} className="shrink-0 hover:text-cyan-100">{item.label}</button>)}
            <button onClick={() => setSort("offers")} className="shrink-0 text-amber-200">Ofertas</button>
          </div>
        </nav>
      </header>

      <main>
        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {[
              [Truck, "Entrega local", "Receba com rapidez"],
              [ShieldCheck, "Compra segura", "Pagamento protegido"],
              [PackageCheck, "Retirada na loja", "Compre de parceiros locais"],
              [Star, "Lojas avaliadas", "Escolha com confiança"],
            ].map(([Icon, title, subtitle]) => <div key={title as string} className="flex items-center gap-3 bg-white px-4 py-4"><Icon className="h-6 w-6 shrink-0 text-[#2f78a7]" /><div><p className="text-sm font-black">{title as string}</p><p className="text-xs text-muted-foreground">{subtitle as string}</p></div></div>)}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#d8ecf8] via-[#b9e0f4] to-[#80bddd] p-7 sm:p-10">
              <Sparkles className="absolute -right-4 -top-5 h-40 w-40 text-white/30" />
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#174667]">Tudo para criar e aprender</p>
              <h1 className="mt-3 max-w-xl text-3xl font-black leading-tight text-[#123951] sm:text-5xl">Papelaria completa perto de você</h1>
              <p className="mt-3 max-w-lg text-sm text-[#174667]/80 sm:text-base">Materiais escolares, escrita, arte, escritório e armarinho das lojas da sua região.</p>
              <Button onClick={() => document.getElementById("produtos-papelaria")?.scrollIntoView({ behavior: "smooth" })} className="mt-6 bg-[#174667] hover:bg-[#174667]/90">Ver produtos</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PromoTile icon={PenLine} title="Escrita" subtitle="Canetas, lápis e marcadores" color="bg-rose-100 text-rose-800" onClick={() => selectDepartment("caneta")} />
              <PromoTile icon={BookOpen} title="Cadernos" subtitle="Para escola e organização" color="bg-amber-100 text-amber-800" onClick={() => selectDepartment("caderno")} />
              <PromoTile icon={Palette} title="Criatividade" subtitle="Pintura, desenho e artes" color="bg-violet-100 text-violet-800" onClick={() => selectDepartment("arte")} />
              <PromoTile icon={Scissors} title="Armarinho" subtitle="Materiais para seus projetos" color="bg-emerald-100 text-emerald-800" onClick={() => selectDepartment("armarinho")} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#2f78a7]">Explore por departamento</p><h2 className="mt-1 text-2xl font-black">Encontre tudo o que precisa</h2></div></div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{stationeryDepartments.map(({ label, icon: Icon, search: term }) => <button key={label} onClick={() => selectDepartment(term)} className="group flex flex-col items-center rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f2f8] text-[#2f78a7]"><Icon className="h-7 w-7" /></span><span className="mt-2 text-xs font-black">{label}</span></button>)}</div>
        </section>

        <section id="produtos-papelaria" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#2f78a7]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Produtos de papelaria</h2>{listData && <p className="mt-1 text-sm text-muted-foreground">{listData.total} produtos encontrados{submittedSearch ? ` para “${submittedSearch}”` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold", sort === option.value ? "border-[#2f78a7] bg-[#2f78a7] text-white" : "bg-white")}>{option.label}</button>)}</div></div>

            {isLoading ? <div className="py-16"><PageLoader /></div> : isError ? <EmptyCatalog title="Não foi possível carregar a papelaria" text="Tente novamente em alguns instantes." clear={() => setSubmittedSearch("")} /> : listData && listData.products.length > 0 ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{listData.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyCatalog title={submittedSearch ? "Nenhum produto encontrado" : "A papelaria está recebendo produtos"} text={submittedSearch ? "Tente outro termo ou veja o catálogo completo." : "As lojas parceiras ainda estão publicando seus materiais. Volte em breve para conferir as novidades."} clear={() => { setSearch(""); setSubmittedSearch("") }} />}
          </div>
        </section>
      </main>
    </div>
  )
}

function PromoTile({ icon: Icon, title, subtitle, color, onClick }: { icon: typeof PenLine; title: string; subtitle: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={cn("flex min-h-36 flex-col items-start justify-between rounded-2xl p-5 text-left transition hover:-translate-y-1", color)}><Icon className="h-8 w-8" /><div><p className="font-black">{title}</p><p className="mt-1 text-xs opacity-75">{subtitle}</p></div></button>
}

function EmptyCatalog({ title, text, clear }: { title: string; text: string; clear: () => void }) {
  return <Card className="mt-6 flex flex-col items-center rounded-2xl border-dashed p-10 text-center"><Heart className="h-10 w-10 text-[#2f78a7]" /><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p><Button variant="outline" onClick={clear} className="mt-5">Ver catálogo completo</Button></Card>
}
