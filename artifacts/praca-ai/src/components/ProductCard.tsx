import { Link } from "wouter"
import { Star, Truck } from "lucide-react"
import { formatMoney, cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

export interface ProductCardData {
  id: string
  name: string
  price: number
  originalPrice?: number | null
  discountPct?: number | null
  imageUrl: string | null
  vendorName: string
  rating?: number
  reviewCount?: number
  freeShipping?: boolean
}

/**
 * Card de produto no padrão Mercado Livre: densidade de informação alta
 * (avaliação em estrelas, frete grátis, desconto em destaque), sem
 * simular parcelamento — o checkout não suporta parcelas de verdade hoje,
 * então mostrar "em 10x sem juros" seria prometer algo que não existe.
 */
export function ProductCard({ product, className, compact = false }: { product: ProductCardData; className?: string; compact?: boolean }) {
  const hasRating = (product.reviewCount ?? 0) > 0

  return (
    <Link href={`/product/${product.id}`} className={cn("block", className)}>
      <Card className="h-full border-none shadow-sm overflow-hidden active:scale-95 transition-transform group">
        <div className={cn("relative bg-muted", compact ? "aspect-[1.18/1] sm:aspect-square" : "aspect-square")}>
          <img
            src={product.imageUrl ?? undefined}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {product.discountPct && (
            <div className="absolute top-2 left-2 bg-terracota text-white text-xs font-black px-2 py-1 rounded-lg">
              -{product.discountPct}%
            </div>
          )}
        </div>
        <div className={cn("space-y-1", compact ? "p-2 sm:p-3" : "p-3")}>
          <p className="text-[11px] text-muted-foreground font-bold truncate">{product.vendorName}</p>
          <h4 className={cn("font-bold line-clamp-2 leading-tight", compact ? "text-[13px] sm:text-sm" : "text-sm")}>{product.name}</h4>

          {hasRating && (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-3 h-3",
                      i < Math.round(product.rating ?? 0) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
                    )}
                  />
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">({product.reviewCount})</span>
            </div>
          )}

          <div className="flex flex-col">
            {product.originalPrice && (
              <span className="text-xs text-muted-foreground line-through">{formatMoney(product.originalPrice)}</span>
            )}
            <span className={cn("font-black text-foreground", compact ? "text-sm sm:text-base" : "text-base")}>{formatMoney(product.price)}</span>
          </div>

          {product.freeShipping && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
              <Truck className="w-3 h-3" />
              <span>Frete grátis</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}
