import * as React from "react"
import { Heart, MessageCircle, MoreHorizontal } from "lucide-react"
import { useListFeed, getListFeedQueryKey, useToggleFeedLike } from "@workspace/api-client-react"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"

export default function Feed() {
  const { data: feedData, isLoading } = useListFeed({ page: 1 }, {
    query: { queryKey: getListFeedQueryKey({ page: 1 }) }
  })
  
  const toggleLikeMutation = useToggleFeedLike()
  const [likedPosts, setLikedPosts] = React.useState<Record<string, boolean>>({})

  const handleLike = (postId: string) => {
    const isLiked = likedPosts[postId]
    setLikedPosts(prev => ({ ...prev, [postId]: !isLiked }))
    
    toggleLikeMutation.mutate({ id: postId }, {
      onError: () => {
        // revert on error
        setLikedPosts(prev => ({ ...prev, [postId]: isLiked }))
      }
    })
  }

  return (
    <div className="flex flex-col w-full min-h-full bg-muted/30">
      <header className="sticky top-0 sm:top-7 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <h1 className="text-2xl font-black text-primary">Comunidade</h1>
      </header>

      {/* Stories/Vendors Strip */}
      <div className="bg-background pt-4 pb-2 border-b">
        <div className="flex overflow-x-auto gap-4 px-4 hide-scrollbar">
          {['Moda', 'Café', 'Tech', 'Livros', 'Plantas', 'Móveis'].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-terracota to-primary">
                <div className="w-full h-full rounded-full bg-white border-2 border-white overflow-hidden p-2">
                  <img src={`https://api.dicebear.com/7.x/icons/svg?seed=${item}`} alt={item} className="w-full h-full" />
                </div>
              </div>
              <span className="text-[10px] font-bold">{item}</span>
            </div>
          ))}
        </div>
      </div>

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
                    <span className="text-xs text-muted-foreground">Há 2 horas</span>
                  </div>
                </div>
                <button className="w-8 h-8 flex items-center justify-center text-muted-foreground">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
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
              {post.productId && !post.imageUrl && (
                <div className="mx-4 mb-4 p-3 border rounded-xl flex gap-3 bg-muted/30">
                  <div className="w-16 h-16 rounded-lg bg-muted shrink-0 overflow-hidden">
                     {/* Dummy fallback image if not provided */}
                     <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${post.productId}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center flex-1">
                    <span className="font-bold text-sm line-clamp-1">{post.productName}</span>
                    {post.productPrice && <span className="font-black text-terracota">{formatMoney(post.productPrice)}</span>}
                  </div>
                  <button className="px-3 py-1 bg-primary text-white font-bold text-xs rounded-lg self-center shrink-0">
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
                <button className="flex items-center gap-1.5 text-foreground hover:text-muted-foreground transition-colors active:scale-95">
                  <MessageCircle className="w-6 h-6" />
                  <span className="text-sm font-bold">{post.commentCount}</span>
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
