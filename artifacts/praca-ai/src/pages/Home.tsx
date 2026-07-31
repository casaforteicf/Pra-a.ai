import * as React from "react"
import { ShieldCheck, Truck, Store, MapPin, Search as SearchIcon, ArrowRight, Shirt, Bike, Smartphone, Sofa, Wrench, ShoppingCart, Pill, Dumbbell, Car, Home as HomeIcon, UtensilsCrossed, Paintbrush, Droplet, Grid3x3, Trees, DoorOpen, Zap, Waves, Blocks, Package, ChevronDown, Tag, Headphones, CreditCard, Sparkles, Gamepad2, Camera, Music, Watch, BookOpen, PawPrint, Plane } from "lucide-react"
import { useGetHome, getGetHomeQueryKey } from "@workspace/api-client-react"
import { Link } from "wouter"
import { formatMoney } from "@/lib/utils"
import { PageLoader, Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ProductCard } from "@/components/ProductCard"
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
}

export default function HomePage() {
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
    <div className="flex min-h-full w-full flex-col bg-[#ebebeb] pb-10">
      {/* Marketplace header */}
      <header className="sticky top-0 inset-x-0 z-30 bg-primary px-4 py-3 shadow-sm lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 lg:gap-x-8">
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Store className="w-6 h-6 fill-white" />
            Praça.ai
          </h1>
          <div className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos, lojas e serviços"
              className="h-11 w-full rounded-md border-none bg-white pl-12 pr-4 text-base shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 justify-self-end rounded-full bg-white/15 px-3 py-2 text-xs font-bold text-white">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Chapecó, SC</span>
          </div>
          <nav className="col-span-3 hidden items-center gap-6 border-t border-white/15 pt-3 text-sm font-semibold text-white/90 lg:flex">
            <Link href="/listing" className="flex items-center gap-1 hover:text-white">Categorias <ChevronDown className="h-4 w-4" /></Link>
            <Link href="/listing" className="hover:text-white">Ofertas</Link>
            <Link href="/servicos" className="hover:text-white">Serviços</Link>
            <Link href="/restaurantes" className="hover:text-white">Restaurantes</Link>
            <Link href="/fretes" className="hover:text-white">Fretes</Link>
            <Link href="/listing?category=viagens-e-hoteis" className="hover:text-white">Viagens</Link>
          </nav>
        </div>
      </header>

      {/* Trust Strip */}
      <div className="hidden items-center justify-center gap-10 border-b bg-white px-4 py-2.5 text-xs font-bold text-primary md:flex">
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
          
          {/* Banners */}
          <section className="bg-primary/10">
            <div className="mx-auto flex max-w-[1440px] snap-x snap-mandatory gap-0 overflow-x-auto hide-scrollbar">
              {homeData.banners.slice(0, 1).map((banner) => (
                <div key={banner.id} className="relative h-[250px] w-full shrink-0 snap-center overflow-hidden sm:h-[330px] lg:h-[390px]">
                  <img src={banner.imageUrl} alt={banner.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-black/75 via-black/35 to-transparent px-6 sm:px-12 lg:px-[max(3rem,calc((100%-1152px)/2))]">
                    {banner.badgeText && (
                      <Badge className="w-fit mb-2 bg-terracota">{banner.badgeText}</Badge>
                    )}
                    <h2 className="max-w-xl text-3xl font-black leading-tight text-white sm:text-5xl">{banner.title}</h2>
                    {banner.subtitle && <p className="mt-2 max-w-lg text-base font-medium text-white/90 sm:text-xl">{banner.subtitle}</p>}
                    <Link href="/listing" className="mt-5 w-fit rounded-md bg-white px-5 py-2.5 text-sm font-bold text-primary shadow">Ver ofertas</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Categories Grid */}
          <section className="relative z-10 mx-auto -mt-5 w-[calc(100%-2rem)] max-w-6xl rounded-lg bg-white px-4 py-5 shadow-sm lg:-mt-8 lg:px-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Encontre tudo na sua cidade</h2>
              <Link href="/listing" className="hidden text-sm font-semibold text-primary sm:block">Ver todas as categorias</Link>
            </div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-5 md:grid-cols-7 lg:grid-cols-10">
              {homeData.categories.map((category) => {
                const Icon = CATEGORY_ICON_MAP[(category as any).icon] ?? Package
                return (
                  <Link key={category.id} href={`/listing?category=${category.slug}`} className="flex flex-col items-center gap-2 group">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:-translate-y-1 group-active:scale-95">
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
              <div key={title as string} className="flex min-h-24 items-center gap-3 bg-white p-4">
                <Icon className="h-7 w-7 shrink-0 text-primary" />
                <div><p className="text-sm font-bold">{title as string}</p><p className="text-xs text-muted-foreground">{subtitle as string}</p></div>
              </div>
            ))}
          </section>

          {/* Flash Deals */}
          {homeData.flashDeals && homeData.flashDeals.length > 0 && (
            <section className="mx-auto mt-8 w-[calc(100%-2rem)] max-w-6xl rounded-lg bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-xl">Ofertas Relâmpago</h3>
                  <Badge variant="terracota" className="animate-pulse">03:45:12</Badge>
                </div>
                <Link href="/listing" className="text-primary text-sm font-bold flex items-center gap-1">
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 hide-scrollbar">
                {homeData.flashDeals.map((product) => (
                  <ProductCard key={product.id} product={product} className="w-[140px] shrink-0 snap-center md:w-[190px] lg:w-[220px]" />
                ))}
              </div>
            </section>
          )}

          {/* Category Carousels */}
          {homeData.carousels.map((carousel) => (
            <section key={carousel.category.id} className="mx-auto mt-8 w-[calc(100%-2rem)] max-w-6xl rounded-lg bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-xl">{carousel.category.name}</h3>
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
                <h3 className="text-2xl font-black">Todos os produtos</h3>
                <p className="text-sm text-muted-foreground">Continue rolando para descobrir mais ofertas da sua região.</p>
              </div>
              <Link href="/listing" className="hidden shrink-0 text-sm font-bold text-primary sm:flex sm:items-center sm:gap-1">
                Explorar catálogo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {infiniteProducts.map((product) => (
                <ProductCard key={product.id} product={product} className="h-full w-full" />
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
          
        </div>
      )}
    </div>
  )
}
