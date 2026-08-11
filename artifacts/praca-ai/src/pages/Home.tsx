import * as React from "react"
import { ShieldCheck, Truck, Store, MapPin, Search as SearchIcon, ArrowRight, Shirt, Bike, Smartphone, Sofa, Wrench, ShoppingCart, Pill, Dumbbell, Car, Home as HomeIcon, UtensilsCrossed, Paintbrush, Droplet, Grid3x3, Trees, DoorOpen, Zap, Waves, Blocks, Package, ChevronDown, Tag, Headphones, CreditCard, Sparkles, Gamepad2, Camera, Music, Watch, BookOpen, PawPrint, Plane } from "lucide-react"
import { useGetHome, getGetHomeQueryKey } from "@workspace/api-client-react"
import { Link, useLocation } from "wouter"
import { formatMoney } from "@/lib/utils"
import { PageLoader, Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ProductCard } from "@/components/ProductCard"
import { StoriesRow } from "@/components/StoriesRow"
import { VariedadesDiaSection } from "@/components/VariedadesDiaSection"
import type { Product } from "@workspace/api-client-react"

// Mapa dos nomes de ícone que o backend calcula (lib/catalogService.ts,
// ICON_BY_NAME) pros componentes reais do lucide-react. Categoria sem
// ícone mapeado cai no Package (nunca mais fica em branco).
const CATEGORY_ICON_MAP: Record<string, typeof Package> = {
  shirt: Shirt,
  bike: Bike,
  smartphone: Smartphone,
  sofa: Sofa,
  wrench: Wrench,
  "shopping-cart": ShoppingCart,
  pill: Pill,
  dumbbell: Dumbbell,
  home: HomeIcon,
  car: Car,
  truck: Truck,
  paintbrush: Paintbrush,
  droplet: Droplet,
  grid: Grid3x3,
  trees: Trees,
  "door-open": DoorOpen,
  zap: Zap,
  waves: Waves,
  blocks: Blocks,
  package: Package,
  sparkles: Sparkles,
  gamepad: Gamepad2,
  camera: Camera,
  music: Music,
  watch: Watch,
  book: BookOpen,
  "paw-print": PawPrint,
  store: Store,
}

export default function HomePage() {
  const [, navigate] = useLocation()
  const [search, setSearch] = React.useState("")
  const { data: homeData, isLoading, isError } = useGetHome({
    query: { queryKey: getGetHomeQueryKey() }
  })

  const [infiniteProducts, setInfiniteProducts] = React.useState<Product[]>([])
  const [hasMoreProducts, setHasMoreProducts] = React.useState(true)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const productsPageRef = React.useRef(1)
  const loadingMoreRef = React.useRef(false)
  const hasMoreRef = React.useRef(true)
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = search.trim()
    navigate(query ? `/listing?search=${encodeURIComponent(query)}` : "/listing")
  }

  const offerProducts = React.useMemo(() => {
    const products = [...(homeData?.flashDeals ?? [])]
    return products.filter((product, index) => products.findIndex((item) => item.id === product.id) === index)
  }, [homeData?.flashDeals])

  const loadMoreProducts = React.useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return
    loadingMoreRef.current = true
    setIsLoadingMore(true)

    try {
      const response = await fetch(`/api/products?page=${productsPageRef.current}&limit=20`)
      if (!response.ok) throw new Error("Falha ao carregar produtos")
      const data = await response.json() as { products: Product[]; hasMore: boolean }

      setInfiniteProducts((current) => {
        const knownIds = new Set(current.map((product) => product.id))
        return [...current, ...data.products.filter((product) => !knownIds.has(product.id))]
      })
      productsPageRef.current += 1
      hasMoreRef.current = data.hasMore
      setHasMoreProducts(data.hasMore)
    } catch (error) {
      console.error("[home] erro ao carregar mais produtos:", error)
      hasMoreRef.current = false
      setHasMoreProducts(false)
    } finally {
      loadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [])

  React.useEffect(() => {
    void loadMoreProducts()
  }, [loadMoreProducts])

  React.useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreProducts()
      },
      { rootMargin: "500px 0px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMoreProducts])

  return (
    <div className="flex min-h-full w-full flex-col bg-background pb-10">
      {/* Marketplace header */}
      <header className="sticky top-0 inset-x-0 z-30 border-b border-white/10 bg-[#0B1B2F] px-4 py-3 text-white shadow-[0_10px_30px_rgba(11,27,47,.28)] lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 lg:gap-x-8">
          <h1 className="flex items-center gap-2 font-serif text-2xl font-black tracking-tight text-white">
            <Store className="h-6 w-6 fill-amber-500 text-amber-500" />
            Praça.ai
          </h1>
          <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 flex rounded-full border border-white/10 bg-white/[.08] p-1 transition focus-within:border-amber-500 focus-within:bg-white/[.13] lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produtos, lojas e serviços"
              aria-label="Buscar produtos, lojas e serviços"
              className="h-11 flex-1 rounded-full border-0 bg-transparent pl-12 pr-3 text-base text-white shadow-none placeholder:text-white/50 focus-visible:ring-0"
            />
            <button type="submit" className="hidden rounded-full bg-amber-500 px-5 text-sm font-bold text-[#0B1B2F] transition hover:bg-amber-600 sm:block">Buscar</button>
          </form>
          <div className="flex items-center gap-2 justify-self-end rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white backdrop-blur">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Chapecó, SC</span>
          </div>
          <nav className="col-span-3 hidden items-center gap-6 border-t border-white/10 pt-3 text-sm font-semibold text-white/75 lg:flex">
            <Link href="/" className="hover:text-amber-500">Início</Link>
            <Link href="/listing" className="flex items-center gap-1 hover:text-amber-500">Categorias <ChevronDown className="h-4 w-4" /></Link>
            <Link href="/listing" className="hover:text-amber-500">Ofertas</Link>
            <Link href="/servicos" className="hover:text-amber-500">Serviços</Link>
            <Link href="/restaurantes" className="hover:text-amber-500">Restaurantes</Link>
            <Link href="/fretes" className="hover:text-amber-500">Fretes</Link>
            <Link href="/listing?category=viagens-e-hoteis" className="hover:text-amber-500">Viagens</Link>
            <a
              href="https://appvendorai.com/cadastro-praca"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 font-black text-[#0B1B2F] shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-600"
            >
              <Store className="h-4 w-4" /> Cadastre sua loja grátis
            </a>
          </nav>
        </div>
      </header>

      {/* CTA cadastro de vendedor — visível também no mobile, onde o nav de cima fica escondido */}
      <a
        href="https://appvendorai.com/cadastro-praca"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2.5 text-center text-sm font-black text-[#0B1B2F] lg:hidden"
      >
        <Store className="h-4 w-4 shrink-0" /> Tem uma loja? Cadastre-se grátis no Praça.ai
      </a>

      {/* Trust Strip */}
      <div className="hidden items-center justify-center gap-10 border-b bg-white px-4 py-2.5 text-xs font-bold text-primary shadow-sm md:flex">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          <span>Compra Segura</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Truck className="w-4 h-4" />
          <span>Entrega Local Rápida</span>
        </div>
      </div>

      {isLoading && <PageLoader />}
      
      {isError && !isLoading && (
        <div className="p-8 text-center text-muted-foreground">
          <p>Erro ao carregar os dados. Tente novamente mais tarde.</p>
        </div>
      )}

      {homeData && (
        <div className="flex flex-col">

          <StoriesRow groups={(homeData as any).stories ?? []} />

          {/* Banners */}
          <section className="px-4 pt-5 lg:px-8">
            <div className="mx-auto flex max-w-[1376px] snap-x snap-mandatory gap-0 overflow-hidden rounded-[28px] shadow-neon hide-scrollbar">
              {homeData.banners.slice(0, 1).map((banner) => (
                <div key={banner.id} className="relative h-[250px] w-full shrink-0 snap-center overflow-hidden sm:h-[330px] lg:h-[390px]">
                  <img src={banner.imageUrl} alt={banner.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-[#0B1B2F]/95 via-[#1A365D]/75 to-[#0B1B2F]/10 px-6 sm:px-12 lg:px-16">
                    {banner.badgeText && (
                      <Badge className="w-fit mb-2 bg-terracota">{banner.badgeText}</Badge>
                    )}
                    <h2 className="max-w-xl font-serif text-3xl font-black leading-tight text-white sm:text-5xl">{banner.title}</h2>
                    {banner.subtitle && <p className="mt-2 max-w-lg text-base font-medium text-white/90 sm:text-xl">{banner.subtitle}</p>}
                    <Link href="/listing" className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-black text-[#0B1B2F] shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-600">Ver ofertas <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Categories Grid */}
          <section className="relative z-10 mx-auto -mt-4 w-[calc(100%-2rem)] max-w-6xl rounded-[24px] border border-white bg-card px-4 py-5 shadow-[0_18px_45px_rgba(45,39,110,.12)] lg:-mt-7 lg:px-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold">Encontre tudo na sua cidade</h2>
              <Link href="/listing" className="hidden text-sm font-semibold text-primary sm:block">Ver todas as categorias</Link>
            </div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-5 md:grid-cols-7 lg:grid-cols-10">
              {homeData.categories.map((category) => {
                const Icon = CATEGORY_ICON_MAP[(category as any).icon] ?? Package
                return (
                  <Link key={category.id} href={category.slug === "marketplace" ? "/marketplace" : `/listing?category=${category.slug}`} className="flex flex-col items-center gap-2 group">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 transition-all group-hover:-translate-y-1 group-hover:bg-amber-100 group-hover:shadow-neon-sm group-active:scale-95">
                      <Icon className="w-7 h-7 text-primary" />
                    </div>
                    <span className="text-[11px] font-bold text-center leading-tight">{category.name}</span>
                  </Link>
                )
              })}
              {/* Veículos não vem do catálogo dinâmico (produtos_catalogo) —
                  fica numa tabela própria do Vendor.ai, por isso é fixo aqui. */}
              <Link href="/veiculos" className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:-translate-y-1 group-active:scale-95">
                  <Car className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Veículos</span>
              </Link>
              <Link href="/imoveis" className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:-translate-y-1 group-active:scale-95">
                  <HomeIcon className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Imóveis</span>
              </Link>
              <Link href="/farmacia" className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:-translate-y-1 group-active:scale-95">
                  <Pill className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Farmácia</span>
              </Link>
              <Link href="/restaurantes" className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:-translate-y-1 group-active:scale-95">
                  <UtensilsCrossed className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Restaurantes</span>
              </Link>
              <Link href="/servicos" className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:-translate-y-1 group-active:scale-95">
                  <Wrench className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Serviços</span>
              </Link>
              <Link href="/fretes" className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:-translate-y-1 group-active:scale-95">
                  <Truck className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Fretes</span>
              </Link>
              <Link href="/listing?category=viagens-e-hoteis" className="flex flex-col items-center gap-2 group">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:-translate-y-1 group-active:scale-95">
                  <Plane className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Viagens e hotéis</span>
              </Link>
            </div>
          </section>

          <section className="mx-auto mt-6 grid w-[calc(100%-2rem)] max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-lg bg-border shadow-sm md:grid-cols-4">
            {[
              [CreditCard, "Pagamento seguro", "Compre com tranquilidade"],
              [Truck, "Entrega local", "Receba mais rápido"],
              [Tag, "Ofertas da região", "Preços perto de você"],
              [Headphones, "Atendimento", "Suporte quando precisar"],
            ].map(([Icon, title, subtitle]) => (
              <div key={title as string} className="flex min-h-24 items-center gap-3 bg-card p-4">
                <Icon className="h-7 w-7 shrink-0 text-primary" />
                <div><p className="text-sm font-bold">{title as string}</p><p className="text-xs text-muted-foreground">{subtitle as string}</p></div>
              </div>
            ))}
          </section>

          {/* Produtos aparecem cedo no mobile, antes dos blocos editoriais. */}
          {infiniteProducts.length > 0 && (
            <section className="mx-auto mt-6 w-[calc(100%-2rem)] max-w-6xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-serif text-2xl font-bold">Destaques para você</h3>
                <Link href="/listing" className="flex items-center gap-1 text-sm font-bold text-primary">
                  Ver mais <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-6">
                {infiniteProducts.slice(0, 6).map((product) => (
                  <ProductCard key={product.id} product={product} compact className="h-full w-full" />
                ))}
              </div>
            </section>
          )}

          {/* Flash Deals */}
          {offerProducts.length > 0 && <section className="mx-auto mt-8 w-[calc(100%-2rem)] max-w-6xl rounded-[24px] border border-slate-200 bg-card p-5 shadow-[0_12px_32px_rgba(11,27,47,.06)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-2xl font-bold">Ofertas do dia</h3>
                  <Badge variant="terracota">Seleção local</Badge>
                </div>
                <Link href="/listing" className="text-primary text-sm font-bold flex items-center gap-1">
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 hide-scrollbar">
                  {offerProducts.map((product) => (
                    <ProductCard key={product.id} product={product} className="w-[140px] shrink-0 snap-center md:w-[190px] lg:w-[220px]" />
                  ))}
              </div>
          </section>}

          {/* Category Carousels */}
          {homeData.carousels.map((carousel) => (
            <section key={carousel.category.id} className="mx-auto mt-8 w-[calc(100%-2rem)] max-w-6xl rounded-[24px] border border-slate-200 bg-card p-5 shadow-[0_12px_32px_rgba(11,27,47,.06)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-2xl font-bold">{carousel.category.name}</h3>
                <Link href={`/listing?category=${carousel.category.slug}`} className="text-primary text-sm font-bold flex items-center gap-1">
                  Ver mais <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 hide-scrollbar">
                {carousel.products.map((product) => (
                  <ProductCard key={product.id} product={product} className="w-[140px] shrink-0 snap-center md:w-[190px] lg:w-[220px]" />
                ))}
              </div>
            </section>
          ))}

          {/* Infinite product discovery */}
          <section className="mx-auto mt-8 w-[calc(100%-2rem)] max-w-6xl">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h3 className="font-serif text-3xl font-bold">Todos os produtos</h3>
                <p className="text-sm text-muted-foreground">Continue rolando para descobrir mais ofertas da sua região.</p>
              </div>
              <Link href="/listing" className="hidden shrink-0 text-sm font-bold text-primary sm:flex sm:items-center sm:gap-1">
                Explorar catálogo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
              {infiniteProducts.slice(6, 6 + 4 + (new Date().getDate() % 3) * 2).map((product) => (
                <ProductCard key={product.id} product={product} compact className="h-full w-full" />
              ))}
            </div>

            <VariedadesDiaSection variedades={(homeData as any)?.variedadesHoje ?? []} />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
              {infiniteProducts.slice(6 + 4 + (new Date().getDate() % 3) * 2).map((product) => (
                <ProductCard key={product.id} product={product} compact className="h-full w-full" />
              ))}
            </div>

            <div ref={loadMoreSentinelRef} className="flex min-h-24 items-center justify-center py-6" aria-live="polite">
              {isLoadingMore && (
                <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                  Carregando mais produtos...
                </div>
              )}
              {!hasMoreProducts && infiniteProducts.length > 0 && (
                <p className="text-sm text-muted-foreground">Você chegou ao fim do catálogo.</p>
              )}
            </div>
          </section>

          <footer className="mt-12 rounded-t-[36px] bg-[#0B1B2F] px-5 pb-28 pt-10 text-white lg:pb-10">
            <div className="mx-auto max-w-6xl">
              <div className="grid gap-6 border-b border-white/10 pb-8 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [ShieldCheck, "Compra protegida", "Mais segurança em cada pedido"],
                  [Truck, "Entrega conectada", "Acompanhe a logística do produto"],
                  [Store, "Parceiros locais", "Lojas e vendedores da sua região"],
                  [Headphones, "Atendimento", "Ajuda quando você precisar"],
                ].map(([Icon, title, subtitle]) => (
                  <div key={title as string} className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div><p className="font-bold">{title as string}</p><p className="text-xs text-white/55">{subtitle as string}</p></div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center justify-between gap-5 pt-7 sm:flex-row">
                <Link href="/" className="flex items-center gap-2 font-serif text-2xl font-bold"><Store className="h-6 w-6 text-amber-500" /> Praça.ai</Link>
                <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/60">
                  <Link href="/listing" className="hover:text-amber-500">Explorar</Link>
                  <Link href="/servicos" className="hover:text-amber-500">Serviços</Link>
                  <Link href="/fretes" className="hover:text-amber-500">Fretes</Link>
                  <Link href="/profile" className="hover:text-amber-500">Minha conta</Link>
                </nav>
                <p className="text-xs text-white/35">© 2026 Praça.ai</p>
              </div>
            </div>
          </footer>
          
        </div>
      )}
    </div>
  )
}
