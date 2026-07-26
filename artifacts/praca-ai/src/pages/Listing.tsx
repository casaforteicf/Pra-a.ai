import * as React from "react"
import { useLocation } from "wouter"
import { ChevronLeft, SlidersHorizontal, Star } from "lucide-react"
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react"
import { Link } from "wouter"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

export default function ListingPage() {
  const [, setLocation] = useLocation()
  // Mocking search params since wouter doesn't have useSearchParams built-in hook out of the box in this setup easily
  const searchParams = new URLSearchParams(window.location.search)
  const categorySlug = searchParams.get('category') || undefined
  
  const [activeSort, setActiveSort] = React.useState('Relevância')

  const { data: listData, isLoading } = useListProducts({ category: categorySlug }, {
    query: { queryKey: getListProductsQueryKey({ category: categorySlug }) }
  })

  const sorts = ['Relevância', 'Menor Preço', 'Mais Vendidos', 'Avaliação', 'Ofertas']

  return (
    <div className="flex flex-col w-full min-h-full pb-8 bg-background">
      {/* Header */}
      <header className="sticky top-0 sm:top-7 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
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

      {isLoading && <PageLoader />}

      {listData && (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {listData.products.map(product => (
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
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-bold text-foreground">{product.rating.toFixed(1)}</span>
                      <span className="text-[10px] text-muted-foreground">({product.reviewCount})</span>
                    </div>
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

          {listData.hasMore && (
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
