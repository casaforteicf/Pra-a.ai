import * as React from "react"
import { useLocation } from "wouter"
import { ChevronLeft, Heart, ShoppingBag, Trash2 } from "lucide-react"
import { useListFavorites, getListFavoritesQueryKey, useToggleFavorite } from "@workspace/api-client-react"
import { useAuth } from "@/contexts/AuthContext"
import { formatMoney } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"

export default function MyFavorites() {
  const [, setLocation] = useLocation()
  const { user, isLoading: authLoading } = useAuth()
  const queryClient = useQueryClient()

  const { data: favorites, isLoading } = useListFavorites({
    query: {
      queryKey: getListFavoritesQueryKey(),
      enabled: !!user,
    },
  })

  const toggleMutation = useToggleFavorite()

  const handleRemove = (productId: string) => {
    toggleMutation.mutate(
      { productId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() })
        },
      },
    )
  }

  if (authLoading) {
    return (
      <div className="flex flex-col w-full min-h-full bg-background p-4">
        <div className="grid grid-cols-2 gap-3 mt-20">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-52 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full min-h-full bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black">Meus Favoritos</h1>
        {favorites && favorites.length > 0 && (
          <span className="ml-auto text-sm text-muted-foreground font-medium">
            {favorites.length} {favorites.length === 1 ? "item" : "itens"}
          </span>
        )}
      </header>

      <div className="p-4">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-black mb-2">Entre para ver seus favoritos</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Salve os produtos que você mais gosta.
            </p>
            <Button onClick={() => setLocation("/login")}>Entrar</Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-52 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !favorites || favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <Heart className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-black mb-2">Nenhum favorito ainda</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Explore produtos e toque no coração para salvar.
            </p>
            <Button onClick={() => setLocation("/")}>Explorar Produtos</Button>
          </div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-2 gap-3">
              {(favorites as any[]).map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="bg-background rounded-2xl border shadow-sm overflow-hidden"
                >
                  <div className="relative">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full aspect-square object-cover cursor-pointer"
                      onClick={() => setLocation(`/product/${product.id}`)}
                    />
                    <button
                      onClick={() => handleRemove(product.id)}
                      disabled={toggleMutation.isPending}
                      className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                    {product.discountPct && (
                      <div className="absolute top-2 left-2 bg-[#C45C2E] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        -{product.discountPct}%
                      </div>
                    )}
                  </div>
                  <div
                    className="p-3 cursor-pointer"
                    onClick={() => setLocation(`/product/${product.id}`)}
                  >
                    <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight mb-2">
                      {product.name}
                    </p>
                    <div className="flex items-end gap-1">
                      <span className="text-base font-black text-[#C45C2E]">
                        {formatMoney(product.price)}
                      </span>
                    </div>
                    {product.originalPrice && (
                      <span className="text-[10px] text-muted-foreground line-through">
                        {formatMoney(product.originalPrice)}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
