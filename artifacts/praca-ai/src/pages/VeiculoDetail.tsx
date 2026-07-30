import * as React from "react"
import { useLocation, useRoute } from "wouter"
import { ChevronLeft, Car, Calendar } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

interface Veiculo {
  id: string
  marca: string
  modelo: string
  anoFabricacao: number | null
  anoModelo: number | null
  km: number | null
  cor: string | null
  combustivel: string | null
  cambio: string | null
  preco: number
  precoOriginal: number | null
  descricao: string | null
  fotos: string[]
  vendorName: string
}

export default function VeiculoDetail() {
  const [, setLocation] = useLocation()
  const [, params] = useRoute("/veiculos/:id")
  const id = params?.id
  const { toast } = useToast()
  const { user } = useAuth()

  const { data: veiculo, isLoading } = useQuery<Veiculo>({
    queryKey: ["veiculo", id],
    queryFn: () => fetch(`/api/veiculos/${id}`).then((r) => r.json()),
    enabled: !!id,
  })

  const [dataHora, setDataHora] = React.useState("")
  const [guestName, setGuestName] = React.useState("")
  const [guestPhone, setGuestPhone] = React.useState("")
  const isGuest = !user

  const agendar = useMutation({
    mutationFn: () =>
      fetch(`/api/veiculos/${id}/agendar-test-drive`, {
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
      toast({ title: "Test-drive agendado!", description: "O lojista vai confirmar o horário com você." })
    },
    onError: (err: any) => {
      toast({ title: "Não foi possível agendar", description: err.message, variant: "destructive" })
    },
  })

  if (isLoading) return <PageLoader />
  if (!veiculo) return (
    <div className="flex flex-col items-center justify-center min-h-full gap-3 text-muted-foreground p-6">
      <Car className="w-12 h-12" />
      <p>Veículo não encontrado ou não está mais disponível.</p>
    </div>
  )

  return (
    <div className="flex flex-col w-full min-h-full pb-24 bg-background">
      <header className="sticky top-0 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <button
          onClick={() => setLocation("/veiculos")}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </header>

      <div className="aspect-video bg-muted flex items-center justify-center">
        {veiculo.fotos?.[0] ? (
          <img src={veiculo.fotos[0]} alt={`${veiculo.marca} ${veiculo.modelo}`} className="w-full h-full object-cover" />
        ) : (
          <Car className="w-16 h-16 text-muted-foreground" />
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-black">{veiculo.marca} {veiculo.modelo}</h1>
          <p className="text-sm text-muted-foreground">{veiculo.vendorName}</p>
        </div>

        <p className="text-3xl font-black text-primary">{formatMoney(veiculo.preco)}</p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Ano</span><p className="font-bold">{veiculo.anoFabricacao ?? "—"}/{veiculo.anoModelo ?? "—"}</p></div>
          <div><span className="text-muted-foreground">KM</span><p className="font-bold">{veiculo.km != null ? veiculo.km.toLocaleString("pt-BR") : "—"}</p></div>
          <div><span className="text-muted-foreground">Câmbio</span><p className="font-bold capitalize">{veiculo.cambio ?? "—"}</p></div>
          <div><span className="text-muted-foreground">Combustível</span><p className="font-bold capitalize">{veiculo.combustivel ?? "—"}</p></div>
        </div>

        {veiculo.descricao && <p className="text-sm text-muted-foreground">{veiculo.descricao}</p>}

        <Card className="p-4 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><Calendar className="w-4 h-4" /> Agendar Test-Drive</h3>
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
            Agendar Test-Drive
          </Button>
        </Card>
      </div>
    </div>
  )
}
