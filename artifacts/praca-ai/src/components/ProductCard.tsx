import { Link } from "wouter"
import { ArrowRight, Star, Truck } from "lucide-react"
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
  /** Destino alternativo usado por cards demonstrativos sem página própria. */
  href?: string
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
    <Link href={product.href ?? `/product/${product.id}`} className={cn("block", className)}>
      <Card className="group h-full overflow-hidden rounded-[20px] border border-slate-200 bg-card shadow-[0_8px_24px_rgba(11,27,47,.06)] transition-all duration-300 hover:-translate-y-1.5 hover:border-secondary hover:shadow-[0_20px_48px_rgba(11,27,47,.12)] active:scale-95">
        <div className={cn("relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-200", compact ? "aspect-[1.18/1] sm:aspect-square" : "aspect-square")}>
          <img
            src={product.imageUrl ?? undefined}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {product.discountPct && (
            <div className="absolute left-2 top-2 rounded-full bg-secondary px-2.5 py-1 text-xs font-black text-secondary-foreground shadow-md">
              -{product.discountPct}%
            </div>
          )}
        </div>
        <div className={cn("space-y-1", compact ? "p-2 sm:p-3" : "p-3")}>
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-muted-foreground">{product.vendorName}</p>
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
            <span className={cn("font-serif font-bold text-primary", compact ? "text-base sm:text-lg" : "text-xl")}>{formatMoney(product.price)}</span>
          </div>

          {product.freeShipping && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-sky-700">
              <Truck className="w-3 h-3" />
              <span>Frete grátis</span>
            </div>
          )}
          <span className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition group-hover:bg-secondary group-hover:text-secondary-foreground">
            Ver produto <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Card>
    </Link>
  )
}
