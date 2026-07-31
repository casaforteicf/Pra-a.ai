import * as React from "react"
import { useLocation } from "wouter"
import { ChevronLeft, SlidersHorizontal, Star, Car } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react"
import { Link } from "wouter"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

const VEHICLE_CATEGORY_SLUG = "acessorios-para-veiculos"

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
        <select
          value={marca}
          onChange={e => { setMarca(e.target.value); setModelo(""); onResults(null) }}
          className="rounded-xl border px-2 py-2 text-sm bg-background"
        >
          <option value="">Marca</option>
          {marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={modelo}
          onChange={e => { setModelo(e.target.value); onResults(null) }}
          disabled={!marca}
          className="rounded-xl border px-2 py-2 text-sm bg-background disabled:opacity-50"
        >
          <option value="">Modelo</option>
          {modelos.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={ano}
          onChange={e => { setAno(e.target.value); onResults(null) }}
          disabled={!modelo}
          className="rounded-xl border px-2 py-2 text-sm bg-background disabled:opacity-50"
        >
          <option value="">Ano</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <button
        onClick={buscar}
        disabled={!marca || !modelo || !ano}
        className="mt-3 w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-40"
      >
        Ver peças compatíveis
      </button>
    </div>
  )
}

export default function ListingPage() {
  const [, setLocation] = useLocation()
  // Mocking search params since wouter doesn't have useSearchParams built-in hook out of the box in this setup easily
  const searchParams = new URLSearchParams(window.location.search)
  const categorySlug = searchParams.get('category') || undefined
  
  const [activeSort, setActiveSort] = React.useState('Relevância')
  const [vehicleResults, setVehicleResults] = React.useState<any[] | null>(null)

  const { data: listData, isLoading } = useListProducts({ category: categorySlug }, {
    query: { queryKey: getListProductsQueryKey({ category: categorySlug }) }
  })

  const isVehicleCategory = categorySlug === VEHICLE_CATEGORY_SLUG
  const displayedProducts = isVehicleCategory && vehicleResults !== null ? vehicleResults : listData?.products

  const sorts = ['Relevância', 'Menor Preço', 'Mais Vendidos', 'Avaliação', 'Ofertas']

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 inset-x-0 z-30 border-b bg-background/95 px-4 pb-3 pt-4 backdrop-blur-md lg:px-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLocation('/')}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black capitalize">{categorySlug ? categorySlug.replace('-', ' ') : 'Explorar'}</h1>
            {listData && <p className="text-xs text-muted-foreground font-bold">{listData.total} resultados</p>}
          </div>
          <button className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 text-primary">
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Sort Chips */}
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

      {isLoading && <PageLoader />}

      {displayedProducts && (
        <div className="p-4">
          {isVehicleCategory && vehicleResults !== null && (
            <p className="text-xs text-muted-foreground font-bold mb-3">
              {vehicleResults.length} peça(s) compatível(is) encontrada(s)
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {displayedProducts.map(product => (
              <Link key={product.id} href={`/product/${product.id}`}>
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
                    <div className="flex flex-col justify-end mt-auto">
                      {product.originalPrice && (
                        <span className="text-[11px] text-muted-foreground line-through">{formatMoney(product.originalPrice)}</span>
                      )}
                      <span className="font-black text-foreground text-base leading-none">
                        {formatMoney(product.price)}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {!isVehicleCategory && listData?.hasMore && (
            <div className="mt-8 flex justify-center">
              <button className="px-6 py-3 rounded-xl border-2 border-primary text-primary font-bold text-sm active:bg-primary/5">
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
