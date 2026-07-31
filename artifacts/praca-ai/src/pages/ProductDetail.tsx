import * as React from "react"
import { useRoute, useLocation } from "wouter"
import { ChevronLeft, Heart, Share2, Star, ShieldCheck, MapPin, Store, CheckCircle2, Truck, MessageCircle, Send } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useGetProduct, getGetProductQueryKey, useAddToCart, useListProductReviews, getListProductReviewsQueryKey } from "@workspace/api-client-react"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { motion } from "framer-motion"

interface ProductQuestion {
  id: number
  pergunta: string
  resposta: string | null
  respondidoEm: string | null
  createdAt: string
}

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id")
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  
  const productId = params?.id || ""
  
  const { data: product, isLoading } = useGetProduct(productId, {
    query: { queryKey: getGetProductQueryKey(productId), enabled: !!productId }
  })

  const { data: reviews } = useListProductReviews(productId, {
    query: { queryKey: getListProductReviewsQueryKey(productId), enabled: !!productId }
  })

  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: questions } = useQuery<ProductQuestion[]>({
    queryKey: ["product-questions", productId],
    queryFn: () => fetch(`/api/products/${productId}/perguntas`).then(r => r.json()),
    enabled: !!productId
  })

  const [questionText, setQuestionText] = React.useState("")

  const askQuestion = useMutation({
    mutationFn: () =>
      fetch(`/api/products/${productId}/perguntas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pergunta: questionText.trim() })
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || "Não foi possível enviar sua pergunta.")
        return r.json()
      }),
    onSuccess: () => {
      setQuestionText("")
      queryClient.invalidateQueries({ queryKey: ["product-questions", productId] })
      toast({ title: "Pergunta enviada!", description: "Assim que for respondida, ela aparece aqui." })
    },
    onError: (err: Error) => {
      toast({ title: "Não foi possível enviar", description: err.message, variant: "destructive" })
    }
  })

  const handleAskQuestion = () => {
    if (!user) {
      toast({ title: "Faça login para perguntar", description: "Entre na sua conta pra perguntar sobre o produto.", variant: "destructive" })
      return
    }
    if (!questionText.trim()) return
    askQuestion.mutate()
  }

  const addToCartMutation = useAddToCart()

  const [selectedSize, setSelectedSize] = React.useState<string | null>(null)
  const [quantity, setQuantity] = React.useState(1)
  const [isLiked, setIsLiked] = React.useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0)

  React.useEffect(() => {
    if (product?.isFavorited) setIsLiked(true)
    setSelectedImageIndex(0)
  }, [product])

  const handleAddToCart = (buyNow = false) => {
    if (product?.sizes && product.sizes.length > 0 && !selectedSize) {
      toast({
        title: "Selecione um tamanho",
        description: "Por favor, escolha um tamanho antes de adicionar.",
        variant: "destructive"
      })
      return
    }

    addToCartMutation.mutate({
      data: {
        productId,
        quantity,
        selectedSize
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Adicionado ao carrinho!",
          description: "O produto foi adicionado com sucesso."
        })
        if (buyNow) {
          setLocation("/checkout")
        }
      }
    })
  }

  if (isLoading) return <PageLoader />
  if (!product) return <div className="p-8 text-center text-muted-foreground font-bold">Produto não encontrado.</div>

  return (
    <div className="flex flex-col w-full min-h-full pb-32 bg-white">
      {/* Absolute Header overlay */}
      <header className="absolute top-0 sm:top-7 inset-x-0 z-30 px-4 pt-4 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center shadow-sm pointer-events-auto active:scale-95"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </button>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center shadow-sm active:scale-95">
            <Share2 className="w-5 h-5 text-foreground" />
          </button>
          <button 
            onClick={() => setIsLiked(!isLiked)}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center shadow-sm active:scale-95"
          >
            <motion.div animate={isLiked ? { scale: [1, 1.2, 1] } : {}}>
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-terracota text-terracota' : 'text-foreground'}`} />
            </motion.div>
          </button>
        </div>
      </header>

      {/* Image Gallery */}
      <div className="w-full aspect-[4/5] bg-muted relative">
        <img src={product.images?.[selectedImageIndex] ?? product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
      </div>

      {product.images && product.images.length > 1 && (
        <div className="flex gap-2 px-5 py-3 overflow-x-auto hide-scrollbar">
          {product.images.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedImageIndex(i)}
              className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-colors ${
                i === selectedImageIndex ? 'border-primary' : 'border-transparent opacity-70'
              }`}
            >
              <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="p-5 flex flex-col gap-6">
        
        {/* Title & Price */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-muted border-none text-[10px]">{product.category}</Badge>
            {product.discountPct && (
              <Badge variant="terracota" className="text-[10px]">-{product.discountPct}% OFF</Badge>
            )}
          </div>
          <h1 className="text-2xl font-black leading-tight mb-3 text-foreground">{product.name}</h1>

          {product.reviewCount > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(product.rating) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'}`} />
                ))}
              </div>
              <span className="text-xs font-bold text-foreground">{product.rating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({product.reviewCount} avaliações)</span>
            </div>
          )}

          <div className="flex items-end gap-3">
            <span className="text-3xl font-black text-terracota leading-none">{formatMoney(product.price)}</span>
            {product.originalPrice && (
              <span className="text-sm text-muted-foreground line-through pb-1">{formatMoney(product.originalPrice)}</span>
            )}
          </div>

          {product.freeShipping && (
            <div className="flex items-center gap-1.5 mt-2 text-sm font-bold text-primary">
              <Truck className="w-4 h-4" />
              <span>Frete grátis pra sua região</span>
            </div>
          )}
        </div>

        {/* Vendor Chip */}
        <div className="flex items-center justify-between p-4 bg-background border rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
              {product.vendorLogoUrl ? (
                <img src={product.vendorLogoUrl} alt={product.vendorName} className="w-full h-full object-cover" />
              ) : (
                <Store className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">{product.vendorName}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {product.vendorSalesCount > 0 ? (
                  <>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-foreground">{product.vendorRating.toFixed(1)}</span>
                    <span>({product.vendorSalesCount} vendas)</span>
                  </>
                ) : (
                  <span>Novo na Praça.ai</span>
                )}
              </div>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 rotate-180 text-muted-foreground" />
        </div>

        {/* Variations (Sizes) */}
        {product.sizes && product.sizes.length > 0 && (
          <div>
            <h3 className="font-bold text-sm mb-3">Tamanho</h3>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`w-12 h-12 rounded-xl font-bold transition-all border-2 ${
                    selectedSize === size 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-muted bg-white text-foreground hover:border-primary/30'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trust Seal */}
        <div className="bg-primary/5 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div className="flex flex-col text-sm">
            <span className="font-bold text-primary">Compra Protegida Praça.ai</span>
            <span className="text-muted-foreground text-xs mt-0.5">Receba o produto que está esperando ou devolvemos o seu dinheiro.</span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="desc" className="w-full mt-2">
          <TabsList className="bg-transparent border-b rounded-none p-0 h-auto justify-start gap-6 w-full overflow-x-auto hide-scrollbar">
            <TabsTrigger value="desc" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent px-0 py-3 text-base">
              Descrição
            </TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent px-0 py-3 text-base">
              Avaliações ({product.reviewCount})
            </TabsTrigger>
            <TabsTrigger value="questions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent px-0 py-3 text-base">
              Perguntas ({questions?.length ?? 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="desc" className="pt-4">
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {product.description}
            </p>
          </TabsContent>
          
          <TabsContent value="reviews" className="pt-4">
            <div className="flex flex-col gap-6">
              {reviews?.map(review => (
                <div key={review.id} className="flex flex-col gap-2 border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground">
                        {review.authorName.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold flex items-center gap-1">
                          {review.authorName}
                          {review.verified && <CheckCircle2 className="w-3 h-3 text-primary" />}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{new Date(review.date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80">{review.comment}</p>
                  {review.midiaUrls && review.midiaUrls.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pt-1">
                      {review.midiaUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Foto da avaliação de ${review.authorName}`}
                          className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="questions" className="pt-4">
            <div className="flex flex-col gap-5">
              <div className="flex gap-2">
                <input
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                  placeholder="Escreva sua pergunta sobre o produto..."
                  className="flex-1 rounded-xl border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  onKeyDown={e => e.key === "Enter" && handleAskQuestion()}
                />
                <Button
                  size="icon"
                  className="shrink-0"
                  onClick={handleAskQuestion}
                  disabled={askQuestion.isPending || !questionText.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {questions && questions.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {questions.map(q => (
                    <div key={q.id} className="flex flex-col gap-2 border-b pb-4 last:border-0">
                      <div className="flex items-start gap-2">
                        <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-foreground">{q.pergunta}</p>
                      </div>
                      {q.resposta && (
                        <div className="flex items-start gap-2 pl-6">
                          <span className="text-xs font-bold text-primary shrink-0">Loja:</span>
                          <p className="text-sm text-foreground/80">{q.resposta}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma pergunta ainda. Seja o primeiro a perguntar!
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-[88px] sm:bottom-0 sm:absolute inset-x-0 bg-white border-t p-4 flex gap-3 z-40">
        <Button 
          variant="outline" 
          size="lg" 
          className="flex-1 text-sm bg-white"
          onClick={() => handleAddToCart(false)}
          disabled={addToCartMutation.isPending}
        >
          Adicionar
        </Button>
        <Button 
          size="lg" 
          className="flex-[2] text-sm"
          onClick={() => handleAddToCart(true)}
          disabled={addToCartMutation.isPending}
        >
          Comprar agora
        </Button>
      </div>
    </div>
  )
}
