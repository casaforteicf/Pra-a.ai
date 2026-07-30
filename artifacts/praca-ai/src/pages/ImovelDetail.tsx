import * as React from "react"
import { useLocation, useRoute } from "wouter"
import { ChevronLeft, Home as HomeIcon, Calendar } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

interface Imovel {
  id: string
  titulo: string
  descricao: string | null
  tipo: string
  finalidade: string
  endereco: string | null
  bairro: string | null
  cidade: string | null
  areaM2: number | null
  quartos: number | null
  banheiros: number | null
  vagas: number | null
  valor: number
  valorCondominio: number | null
  valorIptu: number | null
  fotos: string[]
  vendorName: string
}

export default function ImovelDetail() {
  const [, setLocation] = useLocation()
  const [, params] = useRoute("/imoveis/:id")
  const id = params?.id
  const { toast } = useToast()
  const { user } = useAuth()

  const { data: imovel, isLoading } = useQuery<Imovel>({
    queryKey: ["imovel", id],
    queryFn: () => fetch(`/api/imoveis/${id}`).then((r) => r.json()),
    enabled: !!id,
  })

  const [dataHora, setDataHora] = React.useState("")
  const [guestName, setGuestName] = React.useState("")
  const [guestPhone, setGuestPhone] = React.useState("")
  const isGuest = !user

  const agendar = useMutation({
    mutationFn: () =>
      fetch(`/api/imoveis/${id}/agendar-visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dataHora,
          ...(isGuest ? { guestName, guestPhone } : {}),
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Falha ao agendar")
        return r.json()
      }),
    onSuccess: () => {
      toast({ title: "Visita agendada!", description: "A imobiliária vai confirmar o horário com você." })
    },
    onError: (err: any) => {
      toast({ title: "Não foi possível agendar", description: err.message, variant: "destructive" })
    },
  })

  if (isLoading) return <PageLoader />
  if (!imovel) return (
    <div className="flex flex-col items-center justify-center min-h-full gap-3 text-muted-foreground p-6">
      <HomeIcon className="w-12 h-12" />
      <p>Imóvel não encontrado ou não está mais disponível.</p>
    </div>
  )

  return (
    <div className="flex flex-col w-full min-h-full pb-24 bg-background">
      <header className="sticky top-0 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <button
          onClick={() => setLocation("/imoveis")}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </header>

      <div className="aspect-video bg-muted flex items-center justify-center">
        {imovel.fotos?.[0] ? (
          <img src={imovel.fotos[0]} alt={imovel.titulo} className="w-full h-full object-cover" />
        ) : (
          <HomeIcon className="w-16 h-16 text-muted-foreground" />
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <Badge variant="secondary" className="mb-2">{imovel.finalidade === "aluguel" ? "Aluguel" : "Venda"}</Badge>
          <h1 className="text-2xl font-black">{imovel.titulo}</h1>
          <p className="text-sm text-muted-foreground">{imovel.bairro ?? ""} {imovel.cidade ? `— ${imovel.cidade}` : ""}</p>
          <p className="text-sm text-muted-foreground">{imovel.vendorName}</p>
        </div>

        <div>
          <p className="text-3xl font-black text-primary">{formatMoney(imovel.valor)}</p>
          {(imovel.valorCondominio || imovel.valorIptu) && (
            <p className="text-xs text-muted-foreground">
              {imovel.valorCondominio ? `Condomínio ${formatMoney(imovel.valorCondominio)}` : ""}
              {imovel.valorCondominio && imovel.valorIptu ? " · " : ""}
              {imovel.valorIptu ? `IPTU ${formatMoney(imovel.valorIptu)}` : ""}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">Área</span><p className="font-bold">{imovel.areaM2 ? `${imovel.areaM2}m²` : "—"}</p></div>
          <div><span className="text-muted-foreground">Quartos</span><p className="font-bold">{imovel.quartos ?? "—"}</p></div>
          <div><span className="text-muted-foreground">Vagas</span><p className="font-bold">{imovel.vagas ?? "—"}</p></div>
        </div>

        {imovel.descricao && <p className="text-sm text-muted-foreground">{imovel.descricao}</p>}

        <Card className="p-4 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><Calendar className="w-4 h-4" /> Agendar Visita</h3>
          <Input
            type="datetime-local"
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
          />
          {isGuest && (
            <>
              <Input placeholder="Seu nome" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              <Input placeholder="Telefone (com DDD)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </>
          )}
          <Button
            className="w-full"
            disabled={!dataHora || (isGuest && (!guestName.trim() || !guestPhone.trim())) || agendar.isPending}
            onClick={() => agendar.mutate()}
          >
            Agendar Visita
          </Button>
        </Card>
      </div>
    </div>
  )
}
