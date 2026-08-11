import { Link } from "wouter"
import { ArrowUpRight, Star, Truck } from "lucide-react"
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
      <Card className="group h-full overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[0_8px_24px_rgba(45,39,110,.07)] transition-all duration-300 hover:-translate-y-1.5 hover:border-secondary/70 hover:shadow-[0_18px_40px_rgba(45,39,110,.14)] active:scale-95">
        <div className={cn("relative overflow-hidden bg-gradient-to-br from-slate-50 to-violet-50", compact ? "aspect-[1.18/1] sm:aspect-square" : "aspect-square")}>
          <img
            src={product.imageUrl ?? undefined}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {product.discountPct && (
            <div className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-400 px-2.5 py-1 text-xs font-black text-slate-950 shadow-md">
              -{product.discountPct}%
            </div>
          )}
        </div>
        <div className={cn("space-y-1", compact ? "p-2 sm:p-3" : "p-3")}>
          <div className="flex items-center justify-between gap-2"><p className="truncate text-[10px] font-black uppercase tracking-wide text-primary">{product.vendorName}</p><ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" /></div>
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
            <span className={cn("font-black text-terracota", compact ? "text-base sm:text-lg" : "text-lg")}>{formatMoney(product.price)}</span>
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
