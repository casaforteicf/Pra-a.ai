import * as React from "react"
import { Search, ShieldCheck, Truck, Store, MapPin, Search as SearchIcon, ArrowRight, Shirt, Bike, Smartphone, Sofa, Wrench, ShoppingCart, Pill, Dumbbell, Car, Home as HomeIcon, UtensilsCrossed, Paintbrush, Droplet, Grid3x3, Trees, DoorOpen, Zap, Waves, Blocks, Package } from "lucide-react"
import { useGetHome, getGetHomeQueryKey } from "@workspace/api-client-react"
import { Link } from "wouter"
import { formatMoney } from "@/lib/utils"
import { PageLoader, Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ProductCard } from "@/components/ProductCard"

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
}

export default function HomePage() {
  const { data: homeData, isLoading, isError } = useGetHome({
    query: { queryKey: getGetHomeQueryKey() }
  })

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col pb-8">
      {/* Sticky Header */}
      <header className="sticky top-0 inset-x-0 z-30 rounded-b-[24px] bg-primary px-4 pb-4 pt-4 shadow-lg shadow-primary/10 lg:px-8 lg:py-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Store className="w-6 h-6 fill-white" />
            Praça.ai
          </h1>
          <div className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-md">
            <MapPin className="w-3 h-3" />
            Chapecó, SC
          </div>
        </div>
        
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="O que você procura hoje?" 
            className="w-full bg-white border-none h-12 pl-12 rounded-2xl text-base shadow-inner font-medium"
          />
        </div>
      </header>

      {/* Trust Strip */}
      <div className="flex items-center justify-center gap-6 py-3 bg-primary/5 border-b border-primary/10 px-4 text-xs font-bold text-primary">
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
        <div className="flex flex-col gap-8 mt-6">
          
          {/* Banners */}
          <section className="px-4">
            <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory hide-scrollbar">
              {homeData.banners.map((banner) => (
                <div key={banner.id} className="snap-center shrink-0 w-[300px] h-[160px] relative rounded-3xl overflow-hidden shadow-md">
                  <img src={banner.imageUrl} alt={banner.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent p-6 flex flex-col justify-end">
                    {banner.badgeText && (
                      <Badge className="w-fit mb-2 bg-terracota">{banner.badgeText}</Badge>
                    )}
                    <h2 className="text-white font-black text-xl leading-tight mb-1">{banner.title}</h2>
                    {banner.subtitle && <p className="text-white/80 text-sm font-medium">{banner.subtitle}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Categories Grid */}
          <section className="px-4">
            <div className="grid grid-cols-4 gap-x-2 gap-y-4 md:grid-cols-6 lg:grid-cols-8">
              {homeData.categories.map((category) => {
                const Icon = CATEGORY_ICON_MAP[(category as any).icon] ?? Package
                return (
                  <Link key={category.id} href={`/listing?category=${category.slug}`} className="flex flex-col items-center gap-2 group">
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-muted group-active:scale-95 transition-transform">
                      <Icon className="w-7 h-7 text-primary" />
                    </div>
                    <span className="text-[11px] font-bold text-center leading-tight">{category.name}</span>
                  </Link>
                )
              })}
              {/* Veículos não vem do catálogo dinâmico (produtos_catalogo) —
                  fica numa tabela própria do Vendor.ai, por isso é fixo aqui. */}
              <Link href="/veiculos" className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-muted group-active:scale-95 transition-transform">
                  <Car className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Veículos</span>
              </Link>
              <Link href="/imoveis" className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-muted group-active:scale-95 transition-transform">
                  <HomeIcon className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Imóveis</span>
              </Link>
              <Link href="/farmacia" className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-muted group-active:scale-95 transition-transform">
                  <Pill className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Farmácia</span>
              </Link>
              <Link href="/restaurantes" className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-muted group-active:scale-95 transition-transform">
                  <UtensilsCrossed className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Restaurantes</span>
              </Link>
              <Link href="/servicos" className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-muted group-active:scale-95 transition-transform">
                  <Wrench className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Serviços</span>
              </Link>
              <Link href="/fretes" className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-muted group-active:scale-95 transition-transform">
                  <Truck className="w-7 h-7 text-primary" />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight">Fretes</span>
              </Link>
            </div>
          </section>

          {/* Flash Deals */}
          {homeData.flashDeals && homeData.flashDeals.length > 0 && (
            <section className="px-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-xl">Ofertas Relâmpago</h3>
                  <Badge variant="terracota" className="animate-pulse">03:45:12</Badge>
                </div>
                <Link href="/listing" className="text-primary text-sm font-bold flex items-center gap-1">
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar -mx-4 px-4">
                {homeData.flashDeals.map((product) => (
                  <ProductCard key={product.id} product={product} className="w-[140px] shrink-0 snap-center md:w-[190px] lg:w-[220px]" />
                ))}
              </div>
            </section>
          )}

          {/* Category Carousels */}
          {homeData.carousels.map((carousel) => (
            <section key={carousel.category.id} className="px-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-xl">{carousel.category.name}</h3>
                <Link href={`/listing?category=${carousel.category.slug}`} className="text-primary text-sm font-bold flex items-center gap-1">
                  Ver mais <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar -mx-4 px-4">
                {carousel.products.map((product) => (
                  <ProductCard key={product.id} product={product} className="w-[140px] shrink-0 snap-center md:w-[190px] lg:w-[220px]" />
                ))}
              </div>
            </section>
          ))}
          
        </div>
      )}
    </div>
  )
}
