import * as React from "react"
import { useLocation, useRoute } from "wouter"
import { ChevronLeft, UtensilsCrossed, Minus, Plus } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

interface CardapioItem {
  id: string
  nome: string
  descricao: string | null
  categoria: string | null
  preco: number
  imageUrl: string | null
  vendorName: string
}

export default function RestauranteCardapio() {
  const [, setLocation] = useLocation()
  const [, params] = useRoute("/restaurantes/:vendorId")
  const vendorId = params?.vendorId
  const { toast } = useToast()
  const { user } = useAuth()

  const { data: cardapio, isLoading } = useQuery<CardapioItem[]>({
    queryKey: ["cardapio", vendorId],
    queryFn: () => fetch(`/api/restaurantes/${vendorId}/cardapio`).then((r) => r.json()),
    enabled: !!vendorId,
  })

  const [carrinho, setCarrinho] = React.useState<Record<string, number>>({})
  const [enderecoEntrega, setEnderecoEntrega] = React.useState("")
  const [guestName, setGuestName] = React.useState("")
  const [guestPhone, setGuestPhone] = React.useState("")
  const [mostrarCheckout, setMostrarCheckout] = React.useState(false)
  const isGuest = !user

  const addItem = (id: string) => setCarrinho((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
  const removeItem = (id: string) => setCarrinho((c) => {
    const next = { ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) }
    if (next[id] === 0) delete next[id]
    return next
  })

  const itensCarrinho = Object.entries(carrinho)
  const total = itensCarrinho.reduce((sum, [id, qty]) => sum + (cardapio?.find((c) => c.id === id)?.preco ?? 0) * qty, 0)

  const pedir = useMutation({
    mutationFn: () =>
      fetch("/api/restaurante/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          itens: itensCarrinho.map(([cardapioItemId, quantidade]) => ({ cardapioItemId, quantidade })),
          enderecoEntrega,
          ...(isGuest ? { guestName, guestPhone } : {}),
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Falha ao fazer pedido")
        return r.json()
      }),
    onSuccess: () => {
      toast({ title: "Pedido enviado!", description: "O restaurante vai confirmar em breve." })
      setCarrinho({})
      setMostrarCheckout(false)
    },
    onError: (err: any) => {
      toast({ title: "Não foi possível pedir", description: err.message, variant: "destructive" })
    },
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="flex flex-col w-full min-h-full pb-28 bg-background">
      <header className="sticky top-0 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <button
          onClick={() => (mostrarCheckout ? setMostrarCheckout(false) : setLocation("/restaurantes"))}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        {cardapio?.[0] && <h1 className="text-lg font-black mt-2">{cardapio[0].vendorName}</h1>}
      </header>

      {mostrarCheckout ? (
        <div className="p-4 space-y-4">
          <Card className="p-4 space-y-1">
            {itensCarrinho.map(([id, qty]) => {
              const item = cardapio?.find((c) => c.id === id)
              if (!item) return null
              return (
                <div key={id} className="flex justify-between text-sm">
                  <span>{qty}x {item.nome}</span>
                  <span className="font-bold">{formatMoney(item.preco * qty)}</span>
                </div>
              )
            })}
            <div className="flex justify-between font-black pt-2 border-t mt-2">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </Card>

          <Input placeholder="Endereço de entrega" value={enderecoEntrega} onChange={(e) => setEnderecoEntrega(e.target.value)} />

          {isGuest && (
            <>
              <Input placeholder="Seu nome" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              <Input placeholder="Telefone (com DDD)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </>
          )}

          <Button
            className="w-full"
            disabled={!enderecoEntrega.trim() || (isGuest && (!guestName.trim() || !guestPhone.trim())) || pedir.isPending}
            onClick={() => pedir.mutate()}
          >
            Confirmar Pedido — {formatMoney(total)}
          </Button>
        </div>
      ) : (
        <>
          <div className="p-4 space-y-3">
            {cardapio?.map((item) => (
              <Card key={item.id} className="p-3 flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.nome} className="w-full h-full object-cover" />
                  ) : (
                    <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{item.nome}</p>
                  {item.descricao && <p className="text-xs text-muted-foreground truncate">{item.descricao}</p>}
                  <p className="font-black text-primary text-sm">{formatMoney(item.preco)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {carrinho[item.id] ? (
                    <>
                      <button onClick={() => removeItem(item.id)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold w-4 text-center text-sm">{carrinho[item.id]}</span>
                    </>
                  ) : null}
                  <button onClick={() => addItem(item.id)} className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {itensCarrinho.length > 0 && (
            <div className="fixed bottom-0 inset-x-0 p-4 bg-background border-t">
              <Button className="w-full" onClick={() => setMostrarCheckout(true)}>
                Ver Carrinho — {formatMoney(total)}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
