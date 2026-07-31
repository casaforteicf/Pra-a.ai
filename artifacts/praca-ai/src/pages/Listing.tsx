import * as React from "react"
import { Link, useLocation } from "wouter"
import {
  ArrowRight,
  Baby,
  Bath,
  BedDouble,
  Bike,
  Blocks,
  BookOpen,
  BriefcaseBusiness,
  Car,
  Check,
  ChevronLeft,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  Menu,
  Milk,
  PackageCheck,
  Palette,
  PenLine,
  Puzzle,
  Rocket,
  Scissors,
  Search,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Truck,
  X,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getListProductsQueryKey, useListProducts, useAddToCart } from "@workspace/api-client-react"
import type { ListProductsSort } from "@workspace/api-client-react"
import { ProductCard } from "@/components/ProductCard"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { formatMoney, cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const STATIONERY_SLUG = "arte-papelaria-e-armarinho"
const VEHICLE_CATEGORY_SLUG = "acessorios-para-veiculos"
const BABY_SLUG = "bebes"
const BEAUTY_SLUG = "beleza-e-cuidado-pessoal"
const TOYS_SLUG = "brinquedos-e-hobbies"

const stationeryDepartments = [
  { label: "Escolar", icon: GraduationCap, search: "escolar" },
  { label: "Cadernos", icon: BookOpen, search: "caderno" },
  { label: "Escrita", icon: PenLine, search: "caneta" },
  { label: "Arte", icon: Palette, search: "arte" },
  { label: "Escritório", icon: BriefcaseBusiness, search: "escritório" },
  { label: "Armarinho", icon: Scissors, search: "armarinho" },
]

const babyDepartments = [
  { label: "Passeio", icon: Bike, search: "carrinho" },
  { label: "Móveis", icon: BedDouble, search: "móvel" },
  { label: "Kit berço", icon: Baby, search: "berço" },
  { label: "Roupas", icon: Shirt, search: "roupa bebê" },
  { label: "Alimentação", icon: Milk, search: "alimentação" },
  { label: "Banho e higiene", icon: Bath, search: "higiene" },
  { label: "Saúde", icon: HeartPulse, search: "saúde bebê" },
  { label: "Brinquedos", icon: Sparkles, search: "brinquedo bebê" },
]

const beautyDepartments = [
  { label: "Cabelos", icon: Scissors, search: "cabelo" },
  { label: "Perfumaria", icon: Sparkles, search: "perfume" },
  { label: "Maquiagem", icon: Palette, search: "maquiagem" },
  { label: "Skincare", icon: Heart, search: "skincare" },
  { label: "Cuidados pessoais", icon: Bath, search: "cuidados pessoais" },
  { label: "Bem-estar", icon: HeartPulse, search: "bem-estar" },
]

const toyDepartments = [
  { label: "Primeira infância", icon: Baby, search: "bebê brinquedo" },
  { label: "Bonecas", icon: Heart, search: "boneca" },
  { label: "Carrinhos", icon: Bike, search: "carrinho brinquedo" },
  { label: "Jogos", icon: Gamepad2, search: "jogo" },
  { label: "Montar", icon: Blocks, search: "blocos" },
  { label: "Educativos", icon: GraduationCap, search: "educativo" },
  { label: "Ar livre", icon: Rocket, search: "brinquedo ar livre" },
  { label: "Hobbies", icon: Puzzle, search: "hobby" },
]

const sortOptions: Array<{ label: string; value: ListProductsSort }> = [
  { label: "Relevância", value: "relevance" },
  { label: "Menor preço", value: "price_asc" },
  { label: "Maior preço", value: "price_desc" },
  { label: "Mais vendidos", value: "best_sellers" },
  { label: "Avaliação", value: "rating" },
  { label: "Ofertas", value: "offers" },
]

// Filtro "selecione seu carro" (tipo Tuning Parts) — só pra categoria de
// acessórios para veículos. Opções vêm só do que existe cadastrado de
// verdade, sem base externa de veículos.
function VehicleFilterBar({ onResults }: { onResults: (products: any[] | null) => void }) {
  const [marca, setMarca] = React.useState("")
  const [modelo, setModelo] = React.useState("")
  const [ano, setAno] = React.useState("")

  const { data: options = [] } = useQuery<{ marca: string; modelo: string }[]>({
    queryKey: ["vehicle-filter-options"],
    queryFn: () => fetch("/api/vehicle-filter-options").then(r => r.json()),
  })

  const marcas = Array.from(new Set(options.map(o => o.marca))).sort()
  const modelos = Array.from(new Set(options.filter(o => o.marca === marca).map(o => o.modelo))).sort()
  const anos = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i)

  const buscar = async () => {
    if (!marca || !modelo || !ano) return
    const res = await fetch(`/api/products/compatibilidade-veicular?marca=${encodeURIComponent(marca)}&modelo=${encodeURIComponent(modelo)}&ano=${ano}`)
    onResults(res.ok ? await res.json() : [])
  }

  return (
    <div className="mx-4 mt-4 rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Car className="w-5 h-5 text-primary" />
        <h3 className="font-black text-sm">Selecione seu carro pra achar peças compatíveis</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select value={marca} onChange={e => { setMarca(e.target.value); setModelo(""); onResults(null) }} className="rounded-xl border px-2 py-2 text-sm bg-background">
          <option value="">Marca</option>
          {marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={modelo} onChange={e => { setModelo(e.target.value); onResults(null) }} disabled={!marca} className="rounded-xl border px-2 py-2 text-sm bg-background disabled:opacity-50">
          <option value="">Modelo</option>
          {modelos.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={ano} onChange={e => { setAno(e.target.value); onResults(null) }} disabled={!modelo} className="rounded-xl border px-2 py-2 text-sm bg-background disabled:opacity-50">
          <option value="">Ano</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <button onClick={buscar} disabled={!marca || !modelo || !ano} className="mt-3 w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-40">
        Ver peças compatíveis
      </button>
    </div>
  )
}

interface FiltersData {
  categories: { nome: string; slug: string; total: number }[]
  specs: { label: string; values: { value: string; total: number }[] }[]
}

type SpecFilter = { label: string; value: string }

// Filtro lateral por categoria (múltiplas marcáveis) + por atributo real do
// produto (ex: Altura, Ângulo de peça) — vem só do que os lojistas
// cadastraram de verdade em "especificações", não é lista fixa.
function FilterSidebar({
  selectedCategories, onToggleCategory,
  selectedSpecs, onToggleSpec,
}: {
  selectedCategories: string[]
  onToggleCategory: (slug: string) => void
  selectedSpecs: SpecFilter[]
  onToggleSpec: (spec: SpecFilter) => void
}) {
  const { data } = useQuery<FiltersData>({
    queryKey: ["products-filters", selectedCategories.join(",")],
    queryFn: () => fetch(`/api/products/filters?categories=${encodeURIComponent(selectedCategories.join(","))}`).then(r => r.json()),
  })

  const isSpecSelected = (label: string, value: string) =>
    selectedSpecs.some(s => s.label === label && s.value === value)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-black text-sm mb-3">Categoria</h3>
        <div className="space-y-2">
          {(data?.categories ?? []).map(c => (
            <label key={c.slug} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCategories.includes(c.slug)}
                onChange={() => onToggleCategory(c.slug)}
                className="rounded"
              />
              <span className="flex-1">{c.nome}</span>
              <span className="text-xs text-muted-foreground">({c.total})</span>
            </label>
          ))}
        </div>
      </div>

      {(data?.specs ?? []).map(spec => (
        <div key={spec.label}>
          <h3 className="font-black text-sm mb-3">{spec.label}</h3>
          <div className="space-y-2">
            {spec.values.map(v => (
              <label key={v.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSpecSelected(spec.label, v.value)}
                  onChange={() => onToggleSpec({ label: spec.label, value: v.value })}
                  className="rounded"
                />
                <span className="flex-1">{v.value}</span>
                <span className="text-xs text-muted-foreground">({v.total})</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Card com botão "Adicionar ao carrinho" direto na listagem (sem abrir o
// produto) — usado na listagem genérica (não na vitrine especial de papelaria,
// que usa o ProductCard compartilhado sem esse botão).
function ProductCardWithCart({ product }: { product: any }) {
  const { toast } = useToast()
  const addToCartMutation = useAddToCart()

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addToCartMutation.mutate(
      { data: { productId: product.id, quantity: 1, selectedSize: null } },
      {
        onSuccess: () => toast({ title: "Adicionado ao carrinho!" }),
        onError: () => toast({ title: "Não foi possível adicionar", variant: "destructive" }),
      },
    )
  }

  return (
    <Link href={`/product/${product.id}`}>
      <Card className="h-full border-none shadow-sm overflow-hidden flex flex-col active:scale-95 transition-transform group">
        <div className="relative aspect-square bg-muted shrink-0">
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          {product.discountPct && (
            <div className="absolute top-2 left-2 bg-terracota text-white text-xs font-black px-2 py-1 rounded-lg shadow-sm">
              -{product.discountPct}%
            </div>
          )}
          {product.freeShipping && (
            <div className="absolute bottom-2 left-2 bg-primary/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
              Frete Grátis
            </div>
          )}
        </div>
        <div className="p-3 flex flex-col flex-1">
          {product.reviewCount > 0 && (
            <div className="flex items-center gap-1 mb-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-foreground">{product.rating.toFixed(1)}</span>
              <span className="text-[10px] text-muted-foreground">({product.reviewCount})</span>
            </div>
          )}
          <h4 className="font-bold text-sm line-clamp-2 leading-tight mb-2 flex-1">{product.name}</h4>
          <div className="flex flex-col justify-end mt-auto mb-2">
            {product.originalPrice && (
              <span className="text-[11px] text-muted-foreground line-through">{formatMoney(product.originalPrice)}</span>
            )}
            <span className="font-black text-foreground text-base leading-none">
              {formatMoney(product.price)}
            </span>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={addToCartMutation.isPending}
            className="w-full py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Adicionar ao carrinho
          </button>
        </div>
      </Card>
    </Link>
  )
}

export default function ListingPage() {
  const [, setLocation] = useLocation()
  const searchParams = new URLSearchParams(window.location.search)
  const categorySlug = searchParams.get("category") || undefined
  const isStationery = categorySlug === STATIONERY_SLUG
  const isBaby = categorySlug === BABY_SLUG
  const isBeauty = categorySlug === BEAUTY_SLUG
  const isToys = categorySlug === TOYS_SLUG
  const isVehicleCategory = categorySlug === VEHICLE_CATEGORY_SLUG

  // ── Vitrine especial de papelaria (só ativa quando isStationery) ──
  const [search, setSearch] = React.useState("")
  const [submittedSearch, setSubmittedSearch] = React.useState("")
  const [sort, setSort] = React.useState<ListProductsSort>("relevance")
  const stationeryParams = { category: categorySlug, search: submittedSearch || undefined, sort, limit: 40 }
  const { data: stationeryListData, isLoading: stationeryLoading, isError: stationeryError } = useListProducts(stationeryParams, {
    query: { queryKey: getListProductsQueryKey(stationeryParams), enabled: isStationery },
  })

  // ── Vitrine especial de bebês (só ativa quando isBaby) ──
  const babyParams = { category: categorySlug, search: submittedSearch || undefined, sort, limit: 40 }
  const { data: babyListData, isLoading: babyLoading, isError: babyError } = useListProducts(babyParams, {
    query: { queryKey: getListProductsQueryKey(babyParams), enabled: isBaby },
  })

  // ── Vitrine especial de beleza (só ativa quando isBeauty) ──
  const beautyParams = { category: categorySlug, search: submittedSearch || undefined, sort, limit: 40 }
  const { data: beautyListData, isLoading: beautyLoading, isError: beautyError } = useListProducts(beautyParams, {
    query: { queryKey: getListProductsQueryKey(beautyParams), enabled: isBeauty },
  })

  // ── Vitrine especial de brinquedos (só ativa quando isToys) ──
  const toysParams = { category: categorySlug, search: submittedSearch || undefined, sort, limit: 40 }
  const { data: toysListData, isLoading: toysLoading, isError: toysError } = useListProducts(toysParams, {
    query: { queryKey: getListProductsQueryKey(toysParams), enabled: isToys },
  })

  const submitSearch = (event?: React.FormEvent) => {
    event?.preventDefault()
    setSubmittedSearch(search.trim())
  }
  const selectDepartment = (departmentSearch: string) => {
    setSearch(departmentSearch)
    setSubmittedSearch(departmentSearch)
  }

  // ── Listagem genérica com filtro lateral (categoria + atributos) e
  // "Adicionar ao carrinho" no card — usada por todas as outras categorias ──
  const [activeSort, setActiveSort] = React.useState('Relevância')
  const [vehicleResults, setVehicleResults] = React.useState<any[] | null>(null)
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(categorySlug ? [categorySlug] : [])
  const [selectedSpecs, setSelectedSpecs] = React.useState<SpecFilter[]>([])
  const [showFilters, setShowFilters] = React.useState(false)

  const sortParam = activeSort === 'Menor Preço' ? 'price_asc' : activeSort === 'Ofertas' ? 'offers' : undefined

  const { data: listData, isLoading } = useQuery({
    queryKey: ["products-listing", selectedCategories.join(","), selectedSpecs, sortParam],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","))
      if (selectedSpecs.length > 0) params.set("specs", JSON.stringify(selectedSpecs))
      if (sortParam) params.set("sort", sortParam)
      return fetch(`/api/products?${params.toString()}`).then(r => r.json())
    },
    enabled: !isStationery && !isBaby && !isBeauty && !isToys,
  })

  const toggleCategory = (slug: string) => {
    setSelectedCategories(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug])
  }
  const toggleSpec = (spec: SpecFilter) => {
    setSelectedSpecs(prev =>
      prev.some(s => s.label === spec.label && s.value === spec.value)
        ? prev.filter(s => !(s.label === spec.label && s.value === spec.value))
        : [...prev, spec],
    )
  }

  const sorts = ['Relevância', 'Menor Preço', 'Mais Vendidos', 'Avaliação', 'Ofertas']

  if (!isStationery && !isBaby && !isBeauty && !isToys) {
    const displayedProducts = isVehicleCategory && vehicleResults !== null ? vehicleResults : listData?.products

    return (
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col bg-background pb-8">
        <header className="sticky top-0 inset-x-0 z-30 border-b bg-background/95 px-4 pb-3 pt-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation('/')}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-black capitalize">{categorySlug ? categorySlug.replaceAll('-', ' ') : 'Explorar'}</h1>
              {listData && <p className="text-xs text-muted-foreground font-bold">{listData.total} resultados</p>}
            </div>
            <button
              onClick={() => setShowFilters(true)}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 text-primary lg:hidden"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          <div className="flex overflow-x-auto gap-2 mt-4 hide-scrollbar -mx-4 px-4 pb-1">
            {sorts.map(sort => (
              <button
                key={sort}
                onClick={() => setActiveSort(sort)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  activeSort === sort
                    ? 'bg-primary text-white'
                    : 'bg-white border text-foreground'
                }`}
              >
                {sort}
              </button>
            ))}
          </div>
        </header>

        {isVehicleCategory && <VehicleFilterBar onResults={setVehicleResults} />}

        <div className="flex gap-6 p-4">
          <aside className="hidden lg:block w-56 shrink-0">
            <FilterSidebar
              selectedCategories={selectedCategories}
              onToggleCategory={toggleCategory}
              selectedSpecs={selectedSpecs}
              onToggleSpec={toggleSpec}
            />
          </aside>

          {showFilters && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-black">Filtrar por</h2>
                  <button onClick={() => setShowFilters(false)}><X className="w-5 h-5" /></button>
                </div>
                <FilterSidebar
                  selectedCategories={selectedCategories}
                  onToggleCategory={toggleCategory}
                  selectedSpecs={selectedSpecs}
                  onToggleSpec={toggleSpec}
                />
                <button
                  onClick={() => setShowFilters(false)}
                  className="mt-6 w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Aplicar
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {isLoading && <PageLoader />}

            {displayedProducts && (
              <>
                {isVehicleCategory && vehicleResults !== null && (
                  <p className="text-xs text-muted-foreground font-bold mb-3">
                    {vehicleResults.length} peça(s) compatível(is) encontrada(s)
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {displayedProducts.map((product: any) => (
                    <ProductCardWithCart key={product.id} product={product} />
                  ))}
                </div>

                {!isVehicleCategory && listData?.hasMore && (
                  <div className="mt-8 flex justify-center">
                    <button className="px-6 py-3 rounded-xl border-2 border-primary text-primary font-bold text-sm active:bg-primary/5">
                      Carregar mais
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isToys) {
    return (
      <div className="min-h-full w-full bg-[#f8f5f5] pb-12 text-[#251745]">
        <header className="bg-[#ffe915] text-[#251745]">
          <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6 lg:gap-8 lg:px-8">
            <Link href="/" className="flex items-center gap-2 text-xl font-black"><Gift className="h-8 w-8 text-[#e43286]" /> Praça.ai <span className="hidden text-sm text-[#604f1c] sm:inline">Brinquedos</span></Link>
            <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Encontre aqui um mundo de diversão..." className="h-12 rounded-full border-0 bg-white pl-12 pr-12 text-[#251745]" /><button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#6a31a8] p-2 text-white"><ArrowRight className="h-4 w-4" /></button></form>
            <div className="flex items-center gap-3 justify-self-end"><Link href="/profile" className="hidden text-sm font-bold sm:block">Acesse sua conta</Link><span className="rounded-full bg-black/10 p-2.5"><ShoppingCart className="h-5 w-5" /></span></div>
          </div>
          <nav className="border-t border-black/10"><div className="mx-auto flex max-w-6xl items-center gap-7 overflow-x-auto px-4 py-3 text-xs font-black sm:px-6 lg:px-8"><span className="flex shrink-0 items-center gap-2"><Menu className="h-4 w-4" /> Departamentos</span><button onClick={() => setSubmittedSearch("")} className="shrink-0">Novidades</button><button onClick={() => setSort("offers")} className="shrink-0 text-[#a60070]">Ofertas</button>{toyDepartments.slice(0, 5).map((item) => <button key={item.label} onClick={() => selectDepartment(item.search)} className="shrink-0">{item.label}</button>)}</div></nav>
        </header>
        <main>
          <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5a2a91] via-[#7337aa] to-[#8d40ba] p-7 text-white sm:p-10 lg:min-h-[390px]">
              <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#19bfe8]/60" /><div className="absolute -bottom-28 right-1/4 h-64 w-64 rounded-full bg-[#ffdf18]/40" />
              <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_0.8fr]"><div><span className="inline-flex items-center gap-2 rounded-full bg-[#21c1e6] px-3 py-1.5 text-xs font-black text-[#251745]">Diversão para todas as idades</span><h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] sm:text-6xl">Um mundo de brincadeiras</h1><p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">Brinquedos, jogos e hobbies das lojas da sua região para aprender, imaginar e se divertir.</p><Button onClick={() => document.getElementById("produtos-brinquedos")?.scrollIntoView({ behavior: "smooth" })} className="mt-7 bg-[#ffe915] text-[#251745] hover:bg-[#f5dc00]">Ver brinquedos</Button></div><div className="relative hidden min-h-64 lg:block"><div className="absolute left-1/2 top-1/2 flex h-60 w-60 -translate-x-1/2 -translate-y-1/2 rotate-6 items-center justify-center rounded-[35%_65%_55%_45%] bg-[#ef3c8f] shadow-2xl"><Rocket className="h-32 w-32 -rotate-6 text-white" strokeWidth={1.2} /></div><Blocks className="absolute bottom-3 left-3 h-16 w-16 text-[#ffe915]" /></div></div>
            </div>
          </section>
          <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#6a31a8]">Escolha a diversão</p><h2 className="mt-1 text-2xl font-black">Todos os departamentos</h2></div></div><div className="grid grid-cols-4 gap-3 lg:grid-cols-8">{toyDepartments.map(({ label, icon: Icon, search: term }, index) => <button key={label} onClick={() => selectDepartment(term)} className="group flex flex-col items-center rounded-2xl bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className={cn("flex h-14 w-14 items-center justify-center rounded-full", index % 4 === 0 ? "bg-yellow-100 text-yellow-700" : index % 4 === 1 ? "bg-pink-100 text-pink-600" : index % 4 === 2 ? "bg-cyan-100 text-cyan-700" : "bg-violet-100 text-violet-700")}><Icon className="h-7 w-7" /></span><span className="mt-2 text-[11px] font-black leading-tight">{label}</span></button>)}</div></section>
          <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8"><div className="mb-5 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#e43286]">Presente por idade</p><h2 className="mt-1 text-2xl font-black">A escolha certa para cada fase</h2></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["0 a 2 anos","bebê brinquedo","bg-[#c7f0f7]"],["3 a 5 anos","brinquedo infantil","bg-[#ffe4ef]"],["6 a 8 anos","jogo educativo","bg-[#fff4a8]"],["9 anos ou mais","hobby jogo","bg-[#e8dafa]"]].map(([label,term,color]) => <button key={label} onClick={() => selectDepartment(term)} className={cn("rounded-2xl p-5 text-center font-black transition hover:-translate-y-1",color)}><Gift className="mx-auto mb-2 h-7 w-7" />{label}</button>)}</div></section>
          <section id="produtos-brinquedos" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#6a31a8]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Brinquedos e hobbies</h2>{toysListData && <p className="mt-1 text-sm text-muted-foreground">{toysListData.total} produtos encontrados{submittedSearch ? ` para "${submittedSearch}"` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold",sort===option.value?"border-[#6a31a8] bg-[#6a31a8] text-white":"bg-white")}>{option.label}</button>)}</div></div>{toysLoading?<div className="py-16"><PageLoader /></div>:toysError?<EmptyCatalog title="Não foi possível carregar os brinquedos" text="Tente novamente em alguns instantes." clear={()=>setSubmittedSearch("")} />:toysListData&&toysListData.products.length>0?<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{toysListData.products.map((product)=><ProductCard key={product.id} product={product} />)}</div>:<EmptyCatalog title={submittedSearch?"Nenhum brinquedo encontrado":"A loja de brinquedos está recebendo produtos"} text={submittedSearch?"Tente outra busca ou veja o catálogo completo.":"As lojas parceiras ainda estão publicando seus brinquedos. Volte em breve para conferir as novidades."} clear={()=>{setSearch("");setSubmittedSearch("")}} />}</div></section>
        </main>
      </div>
    )
  }

  if (isBeauty) {
    return (
      <div className="min-h-full w-full bg-[#f6f3f8] pb-12 text-[#241f2d]">
        <div className="bg-[#241f2d] py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-white">Beleza local, entrega perto de você</div>
        <header className="bg-[#aaa4b1] text-white">
          <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6 lg:gap-8 lg:px-8">
            <Link href="/" className="flex items-center gap-2 text-xl font-black"><Sparkles className="h-7 w-7" /> Praça.ai <span className="hidden text-xs font-semibold text-white/70 sm:inline">Beleza</span></Link>
            <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que você procura hoje?" className="h-12 border-0 bg-white pl-12 pr-12 text-[#241f2d]" />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#5e287d] p-2"><ArrowRight className="h-4 w-4" /></button>
            </form>
            <div className="flex items-center gap-3 justify-self-end"><Link href="/profile" className="hidden text-sm font-bold sm:block">Entrar</Link><span className="rounded-full bg-white/15 p-2.5"><ShoppingCart className="h-5 w-5" /></span></div>
          </div>
          <nav className="border-t border-white/15 bg-[#77717e]">
            <div className="mx-auto flex max-w-6xl items-center gap-7 overflow-x-auto px-4 py-3 text-xs font-black sm:px-6 lg:px-8">
              <button onClick={() => setSort("offers")} className="shrink-0 text-[#f1d4ff]">Promoções</button>
              {beautyDepartments.map((item) => <button key={item.label} onClick={() => selectDepartment(item.search)} className="shrink-0 hover:text-[#f1d4ff]">{item.label}</button>)}
            </div>
          </nav>
        </header>
        <main>
          <section className="relative overflow-hidden bg-gradient-to-r from-[#e9def4] via-[#f2e9fb] to-[#ddd0ee]">
            <div className="absolute -right-16 -top-24 h-96 w-96 rounded-full border-[60px] border-white/25" />
            <div className="absolute bottom-0 left-[45%] h-28 w-28 rounded-full bg-[#b783cc]/25 blur-2xl" />
            <div className="relative mx-auto grid min-h-[390px] max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1fr_0.75fr] lg:px-8">
              <div><span className="inline-flex rounded-full bg-white/70 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#5e287d]">Seu momento de cuidado</span><h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.05] sm:text-6xl">Beleza que combina com você</h1><p className="mt-4 max-w-xl text-base text-[#4d4655] sm:text-lg">Cabelos, perfumaria, maquiagem, skincare e bem-estar das melhores lojas da sua região.</p><Button onClick={() => document.getElementById("produtos-beleza")?.scrollIntoView({ behavior: "smooth" })} className="mt-7 bg-[#5e287d] hover:bg-[#4a1f63]">Descobrir produtos</Button></div>
              <div className="relative hidden min-h-64 lg:block"><div className="absolute left-1/2 top-1/2 flex h-60 w-60 -translate-x-1/2 -translate-y-1/2 rotate-6 items-center justify-center rounded-[38%_62%_45%_55%] bg-gradient-to-br from-[#7e4b9b] to-[#bf86d2] shadow-2xl"><Sparkles className="h-28 w-28 -rotate-6 text-white" strokeWidth={1.2} /></div><Heart className="absolute bottom-5 left-8 h-12 w-12 fill-white/70 text-white/70" /></div>
            </div>
          </section>
          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-5 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#7e4b9b]">Seu ritual, suas escolhas</p><h2 className="mt-1 text-2xl font-black">Explore por categoria</h2></div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{beautyDepartments.map(({ label, icon: Icon, search: term }, index) => <button key={label} onClick={() => selectDepartment(term)} className="group flex flex-col items-center rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className={cn("flex h-14 w-14 items-center justify-center rounded-full", index % 2 === 0 ? "bg-[#efe3f5] text-[#7e4b9b]" : "bg-[#f8e6ee] text-[#a34c72]")}><Icon className="h-7 w-7" /></span><span className="mt-2 text-[11px] font-black leading-tight">{label}</span></button>)}</div>
          </section>
          <section className="mx-auto grid max-w-6xl gap-3 px-4 pb-8 sm:grid-cols-3 sm:px-6 lg:px-8">
            <BeautyPromo icon={Scissors} title="Cabelos incríveis" text="Tratamento, finalização e cor" color="bg-[#eee4f5] text-[#653a80]" search="cabelo" select={selectDepartment} />
            <BeautyPromo icon={Palette} title="Realce sua beleza" text="Maquiagem para todos os estilos" color="bg-[#fae5ec] text-[#9c4568]" search="maquiagem" select={selectDepartment} />
            <BeautyPromo icon={Heart} title="Rotina de skincare" text="Limpeza, hidratação e proteção" color="bg-[#e5f1ef] text-[#39796f]" search="skincare" select={selectDepartment} />
          </section>
          <section id="produtos-beleza" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#7e4b9b]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Beleza e cuidados pessoais</h2>{beautyListData && <p className="mt-1 text-sm text-muted-foreground">{beautyListData.total} produtos encontrados{submittedSearch ? ` para "${submittedSearch}"` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold", sort === option.value ? "border-[#5e287d] bg-[#5e287d] text-white" : "bg-white")}>{option.label}</button>)}</div></div>
            {beautyLoading ? <div className="py-16"><PageLoader /></div> : beautyError ? <EmptyCatalog title="Não foi possível carregar os produtos" text="Tente novamente em alguns instantes." clear={() => setSubmittedSearch("")} /> : beautyListData && beautyListData.products.length > 0 ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{beautyListData.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyCatalog title={submittedSearch ? "Nenhum produto encontrado" : "A vitrine de beleza está recebendo produtos"} text={submittedSearch ? "Tente outra busca ou confira o catálogo completo." : "As lojas parceiras ainda estão publicando seus itens. Volte em breve para conferir as novidades."} clear={() => { setSearch(""); setSubmittedSearch("") }} />}
          </div></section>
        </main>
      </div>
    )
  }

  if (isBaby) {
    return (
      <div className="min-h-full w-full bg-[#fffaf5] pb-12 text-slate-950">
        <header className="bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6 lg:gap-8 lg:px-8 lg:py-5">
            <Link href="/" className="flex items-center gap-2 text-xl font-black text-[#f28a22]"><Baby className="h-8 w-8" /> Praça.ai <span className="hidden text-sm text-slate-500 sm:inline">Bebê</span></Link>
            <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que você está procurando?" className="h-12 rounded-full bg-white pl-12 pr-12 shadow-sm" />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#f28a22] p-2 text-white"><ArrowRight className="h-4 w-4" /></button>
            </form>
            <div className="flex items-center gap-3 justify-self-end"><Link href="/profile" className="hidden text-sm font-bold text-slate-600 sm:block">Entre ou cadastre-se</Link><span className="rounded-full bg-orange-50 p-2.5 text-[#f28a22]"><ShoppingCart className="h-5 w-5" /></span></div>
          </div>
          <nav className="bg-[#49aaa8] text-white">
            <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 py-3 text-xs font-black sm:px-6 lg:px-8">
              {babyDepartments.map((item) => <button key={item.label} onClick={() => selectDepartment(item.search)} className="shrink-0 hover:text-orange-100">{item.label}</button>)}
              <button onClick={() => setSort("offers")} className="shrink-0 rounded-full bg-white px-3 text-[#318d8b]">Ofertas</button>
            </div>
          </nav>
        </header>

        <main>
          <section className="relative overflow-hidden bg-gradient-to-br from-[#a9dcf6] via-[#c5e9fa] to-[#e9f6fd]">
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full border-[45px] border-white/20" />
            <div className="absolute bottom-0 right-[18%] h-52 w-52 rounded-full bg-[#8ecf79]/40 blur-2xl" />
            <div className="relative mx-auto grid min-h-[390px] max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1fr_0.8fr] lg:px-8">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-black text-[#318d8b]"><Heart className="h-4 w-4 fill-[#f28a22] text-[#f28a22]" /> Cuidado em cada fase</span>
                <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.05] text-[#155d70] sm:text-6xl">Tudo para grandes aventuras</h1>
                <p className="mt-4 max-w-xl text-base text-[#155d70]/80 sm:text-lg">Produtos para passeio, quarto, alimentação, higiene e diversão do seu bebê, vendidos por lojas da sua região.</p>
                <Button onClick={() => document.getElementById("produtos-bebes")?.scrollIntoView({ behavior: "smooth" })} className="mt-7 bg-[#f28a22] hover:bg-[#dc7817]">Ver produtos</Button>
              </div>
              <div className="relative hidden min-h-64 lg:block">
                <div className="absolute left-1/2 top-1/2 flex h-60 w-60 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[40%_60%_55%_45%] bg-white/65 shadow-xl"><Baby className="h-32 w-32 text-[#f28a22]" strokeWidth={1.2} /></div>
                <Sparkles className="absolute right-5 top-5 h-14 w-14 text-white" /><Heart className="absolute bottom-5 left-6 h-12 w-12 fill-[#f7b6ba] text-[#f7b6ba]" />
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-5 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#49aaa8]">Tudo para o bebê</p><h2 className="mt-1 text-2xl font-black">Compre por departamento</h2></div>
            <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">{babyDepartments.map(({ label, icon: Icon, search: term }, index) => <button key={label} onClick={() => selectDepartment(term)} className="group flex flex-col items-center rounded-2xl bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className={cn("flex h-14 w-14 items-center justify-center rounded-full", index % 3 === 0 ? "bg-orange-100 text-[#f28a22]" : index % 3 === 1 ? "bg-cyan-100 text-[#318d8b]" : "bg-rose-100 text-rose-500")}><Icon className="h-7 w-7" /></span><span className="mt-2 text-[11px] font-black leading-tight">{label}</span></button>)}</div>
          </section>

          <section className="mx-auto grid max-w-6xl gap-3 px-4 pb-8 sm:grid-cols-3 sm:px-6 lg:px-8">
            <BabyPromo icon={Bike} title="Hora do passeio" text="Carrinhos, cadeirinhas e acessórios" color="bg-[#dff3f2] text-[#267c7a]" search="carrinho" select={selectDepartment} />
            <BabyPromo icon={BedDouble} title="Quarto aconchegante" text="Berços, móveis e enxoval" color="bg-[#fff0dd] text-[#b96818]" search="berço" select={selectDepartment} />
            <BabyPromo icon={Sparkles} title="Brincar e descobrir" text="Brinquedos para cada fase" color="bg-[#f9e6ee] text-[#b84e76]" search="brinquedo bebê" select={selectDepartment} />
          </section>

          <section id="produtos-bebes" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#49aaa8]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Artigos para bebês</h2>{babyListData && <p className="mt-1 text-sm text-muted-foreground">{babyListData.total} produtos encontrados{submittedSearch ? ` para "${submittedSearch}"` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold", sort === option.value ? "border-[#49aaa8] bg-[#49aaa8] text-white" : "bg-white")}>{option.label}</button>)}</div></div>
              {babyLoading ? <div className="py-16"><PageLoader /></div> : babyError ? <EmptyCatalog title="Não foi possível carregar os artigos" text="Tente novamente em alguns instantes." clear={() => setSubmittedSearch("")} /> : babyListData && babyListData.products.length > 0 ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{babyListData.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyCatalog title={submittedSearch ? "Nenhum produto encontrado" : "A loja do bebê está recebendo produtos"} text={submittedSearch ? "Tente outra busca ou confira todo o catálogo." : "As lojas parceiras ainda estão publicando seus artigos. Volte em breve para conferir as novidades."} clear={() => { setSearch(""); setSubmittedSearch("") }} />}
            </div>
          </section>
        </main>
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
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#2f78a7]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Produtos de papelaria</h2>{stationeryListData && <p className="mt-1 text-sm text-muted-foreground">{stationeryListData.total} produtos encontrados{submittedSearch ? ` para “${submittedSearch}”` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold", sort === option.value ? "border-[#2f78a7] bg-[#2f78a7] text-white" : "bg-white")}>{option.label}</button>)}</div></div>

            {stationeryLoading ? <div className="py-16"><PageLoader /></div> : stationeryError ? <EmptyCatalog title="Não foi possível carregar a papelaria" text="Tente novamente em alguns instantes." clear={() => setSubmittedSearch("")} /> : stationeryListData && stationeryListData.products.length > 0 ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{stationeryListData.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyCatalog title={submittedSearch ? "Nenhum produto encontrado" : "A papelaria está recebendo produtos"} text={submittedSearch ? "Tente outro termo ou veja o catálogo completo." : "As lojas parceiras ainda estão publicando seus materiais. Volte em breve para conferir as novidades."} clear={() => { setSearch(""); setSubmittedSearch("") }} />}
          </div>
        </section>
      </main>
    </div>
  )
}

function PromoTile({ icon: Icon, title, subtitle, color, onClick }: { icon: typeof PenLine; title: string; subtitle: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={cn("flex min-h-36 flex-col items-start justify-between rounded-2xl p-5 text-left transition hover:-translate-y-1", color)}><Icon className="h-8 w-8" /><div><p className="font-black">{title}</p><p className="mt-1 text-xs opacity-75">{subtitle}</p></div></button>
}

function BabyPromo({ icon: Icon, title, text, color, search, select }: { icon: typeof Baby; title: string; text: string; color: string; search: string; select: (search: string) => void }) {
  return <button onClick={() => select(search)} className={cn("flex min-h-36 items-center gap-5 rounded-2xl p-6 text-left transition hover:-translate-y-1", color)}><span className="rounded-full bg-white/70 p-4"><Icon className="h-8 w-8" /></span><div><h3 className="text-lg font-black">{title}</h3><p className="mt-1 text-sm opacity-75">{text}</p></div></button>
}

function BeautyPromo({ icon: Icon, title, text, color, search, select }: { icon: typeof Sparkles; title: string; text: string; color: string; search: string; select: (search: string) => void }) {
  return <button onClick={() => select(search)} className={cn("flex min-h-36 items-center gap-5 rounded-2xl p-6 text-left transition hover:-translate-y-1", color)}><span className="rounded-full bg-white/70 p-4"><Icon className="h-8 w-8" /></span><div><h3 className="text-lg font-black">{title}</h3><p className="mt-1 text-sm opacity-75">{text}</p></div></button>
}

function EmptyCatalog({ title, text, clear }: { title: string; text: string; clear: () => void }) {
  return <Card className="mt-6 flex flex-col items-center rounded-2xl border-dashed p-10 text-center"><Heart className="h-10 w-10 text-[#2f78a7]" /><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p><Button variant="outline" onClick={clear} className="mt-5">Ver catálogo completo</Button></Card>
}
