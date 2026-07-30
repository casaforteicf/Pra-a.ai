import * as React from "react"
import { useLocation, useRoute } from "wouter"
import { ChevronLeft, Pill, Minus, Plus } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

interface FarmaciaProduto {
  id: string
  nome: string
  descricao: string | null
  exigeReceita: boolean
  preco: number
  imageUrl: string | null
  vendorName: string
}

export default function FarmaciaProdutoDetail() {
  const [, setLocation] = useLocation()
  const [, params] = useRoute("/farmacia/:id")
  const id = params?.id
  const { toast } = useToast()
  const { user } = useAuth()

  const { data: produto, isLoading } = useQuery<FarmaciaProduto>({
    queryKey: ["farmacia-produto", id],
    queryFn: () => fetch(`/api/farmacia/produtos/${id}`).then((r) => r.json()),
    enabled: !!id,
  })

  const [quantidade, setQuantidade] = React.useState(1)
  const [enderecoEntrega, setEnderecoEntrega] = React.useState("")
  const [guestName, setGuestName] = React.useState("")
  const [guestPhone, setGuestPhone] = React.useState("")
  const isGuest = !user

  const pedir = useMutation({
    mutationFn: () =>
      fetch("/api/farmacia/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          produtoId: id,
          quantidade,
          enderecoEntrega,
          ...(isGuest ? { guestName, guestPhone } : {}),
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Falha ao fazer pedido")
        return r.json()
      }),
    onSuccess: (data) => {
      if (data.precisaReceita) {
        toast({ title: "Pedido recebido!", description: "A farmácia vai te chamar no WhatsApp pra pedir a foto da receita." })
      } else {
        toast({ title: "Pedido enviado!", description: "A farmácia vai confirmar em breve." })
      }
    },
    onError: (err: any) => {
      toast({ title: "Não foi possível pedir", description: err.message, variant: "destructive" })
    },
  })

  if (isLoading) return <PageLoader />
  if (!produto) return (
    <div className="flex flex-col items-center justify-center min-h-full gap-3 text-muted-foreground p-6">
      <Pill className="w-12 h-12" />
      <p>Produto não encontrado ou indisponível.</p>
    </div>
  )

  return (
    <div className="flex flex-col w-full min-h-full pb-24 bg-background">
      <header className="sticky top-0 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <button onClick={() => setLocation("/farmacia")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95">
          <ChevronLeft className="w-6 h-6" />
        </button>
      </header>

      <div className="aspect-square bg-muted flex items-center justify-center">
        {produto.imageUrl ? (
          <img src={produto.imageUrl} alt={produto.nome} className="w-full h-full object-cover" />
        ) : (
          <Pill className="w-16 h-16 text-muted-foreground" />
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          {produto.exigeReceita && <Badge variant="secondary" className="mb-2">Exige receita médica</Badge>}
          <h1 className="text-2xl font-black">{produto.nome}</h1>
          <p className="text-sm text-muted-foreground">{produto.vendorName}</p>
        </div>

        <p className="text-3xl font-black text-primary">{formatMoney(produto.preco)}</p>
        {produto.descricao && <p className="text-sm text-muted-foreground">{produto.descricao}</p>}

        {produto.exigeReceita && (
          <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
            Esse item precisa de receita. Depois do pedido, a farmácia vai te chamar no WhatsApp pra pedir a foto.
          </p>
        )}

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm">Quantidade</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantidade((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-bold w-6 text-center">{quantidade}</span>
              <button onClick={() => setQuantidade((q) => q + 1)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

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
            Fazer Pedido — {formatMoney(produto.preco * quantidade)}
          </Button>
        </Card>
      </div>
    </div>
  )
}
