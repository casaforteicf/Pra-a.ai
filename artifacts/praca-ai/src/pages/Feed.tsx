import * as React from "react"
import { Heart, ShoppingBag } from "lucide-react"
import { useListFeed, getListFeedQueryKey, useToggleFeedLike } from "@workspace/api-client-react"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { useAuth } from "@/contexts/AuthContext"

export default function Feed() {
  const [, setLocation] = useLocation()
  const { user } = useAuth()
  const { data: feedData, isLoading } = useListFeed({ page: 1 }, {
    query: { queryKey: getListFeedQueryKey({ page: 1 }) }
  })
  
  const toggleLikeMutation = useToggleFeedLike()
  const [likedPosts, setLikedPosts] = React.useState<Record<string, boolean>>({})

  const handleLike = (postId: string) => {
    if (!user) {
      setLocation("/login?returnTo=/feed")
      return
    }
    const isLiked = likedPosts[postId]
    setLikedPosts(prev => ({ ...prev, [postId]: !isLiked }))
    
    toggleLikeMutation.mutate({ id: postId }, {
      onSuccess: (updated) => {
        setLikedPosts(prev => ({ ...prev, [postId]: Boolean(updated.isLiked) }))
      },
      onError: () => {
        // revert on error
        setLikedPosts(prev => ({ ...prev, [postId]: isLiked }))
      }
    })
  }

  return (
    <div className="flex flex-col w-full min-h-full bg-muted/30">
      <header className="sticky top-0 inset-x-0 z-30 border-b bg-background/95 px-4 pb-3 pt-4 backdrop-blur-md">
        <h1 className="text-2xl font-black text-primary">Comunidade</h1>
      </header>

      {isLoading && <PageLoader />}

      <div className="flex flex-col">
        {feedData?.map((post) => {
          const isLiked = likedPosts[post.id] ?? post.isLiked;
          
          return (
            <Card key={post.id} className="rounded-none border-x-0 border-t-0 mb-2 last:mb-0 shadow-none bg-background">
              {/* Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
                    {post.vendorLogoUrl ? (
                      <img src={post.vendorLogoUrl} alt={post.vendorName} className="w-full h-full object-cover" />
                    ) : (
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${post.vendorName}`} alt="avatar" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm leading-tight">{post.vendorName}</span>
                    <span className="text-xs text-muted-foreground">Produto ativo no catálogo</span>
                  </div>
                </div>
                <button onClick={()=>setLocation(`/listing?vendorId=${encodeURIComponent(post.vendorId)}`)} className="rounded-lg px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5">Ver loja</button>
              </div>

              {/* Content */}
              <div className="px-4 pb-3">
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{post.content}</p>
              </div>

              {/* Media */}
              {post.imageUrl && (
                <div className="w-full aspect-square bg-muted">
                  <img src={post.imageUrl} alt="Post" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Embedded Product Card if any */}
              {post.productId && (
                <div className="mx-4 mb-4 p-3 border rounded-xl flex gap-3 bg-muted/30">
                  <div className="w-16 h-16 rounded-lg bg-muted shrink-0 overflow-hidden">
                     {post.imageUrl ? <img src={post.imageUrl} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="m-auto h-full w-7 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col justify-center flex-1">
                    <span className="font-bold text-sm line-clamp-1">{post.productName}</span>
                    {post.productPrice && <span className="font-black text-terracota">{formatMoney(post.productPrice)}</span>}
                  </div>
                  <button onClick={()=>setLocation(`/product/${post.productId}`)} className="px-3 py-1 bg-primary text-white font-bold text-xs rounded-lg self-center shrink-0">
                    Ver
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="px-4 py-3 flex items-center gap-6 border-t">
                <button 
                  onClick={() => handleLike(post.id)}
                  className="flex items-center gap-1.5 group active:scale-95 transition-transform"
                >
                  <AnimatePresence>
                    <motion.div
                      key={isLiked ? 'liked' : 'unliked'}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      <Heart className={`w-6 h-6 ${isLiked ? 'fill-terracota text-terracota' : 'text-foreground group-hover:text-muted-foreground'}`} />
                    </motion.div>
                  </AnimatePresence>
                  <span className={`text-sm font-bold ${isLiked ? 'text-terracota' : 'text-foreground'}`}>
                    {post.likeCount + (isLiked && !post.isLiked ? 1 : 0) - (!isLiked && post.isLiked ? 1 : 0)}
                  </span>
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
