import * as React from "react"
import { useLocation } from "wouter"
import { ChevronLeft, Truck } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

const TIPO_VEICULO_LABELS: Record<string, string> = {
  utilitario: "Utilitário", van: "Van", caminhao_toco: "Caminhão toco",
  caminhao_truck: "Caminhão truck", carreta: "Carreta",
}

export default function FretesPage() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { user } = useAuth()

  // Escolhe só o TIPO de veículo — nunca uma empresa específica; o sistema
  // escolhe automaticamente quem atende, igual ao fluxo de aceite do
  // transportador (estilo Uber).
  const { data: tiposVeiculo } = useQuery<string[]>({
    queryKey: ["fretes-tipos-veiculo"],
    queryFn: () => fetch("/api/fretes/tipos-veiculo").then((r) => r.json()),
  })

  const [tipoVeiculoDesejado, setTipoVeiculoDesejado] = React.useState("")
  const [enderecoColeta, setEnderecoColeta] = React.useState("")
  const [enderecoEntrega, setEnderecoEntrega] = React.useState("")
  const [tipoCarga, setTipoCarga] = React.useState("")
  const [pesoKg, setPesoKg] = React.useState("")
  const [guestName, setGuestName] = React.useState("")
  const [guestPhone, setGuestPhone] = React.useState("")
  const isGuest = !user

  const cotar = useMutation({
    mutationFn: () =>
      fetch("/api/fretes/cotacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tipoVeiculoDesejado,
          enderecoColeta,
          enderecoEntrega,
          tipoCarga: tipoCarga || undefined,
          pesoKg: pesoKg ? Number(pesoKg) : undefined,
          ...(isGuest ? { guestName, guestPhone } : {}),
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Falha ao pedir cotação")
        return r.json()
      }),
    onSuccess: (data) => {
      toast({ title: "Cotação solicitada!", description: `${data.vendorName} vai te responder com o valor em breve.` })
      setEnderecoColeta("")
      setEnderecoEntrega("")
      setTipoCarga("")
      setPesoKg("")
    },
    onError: (err: any) => {
      toast({ title: "Não foi possível pedir a cotação", description: err.message, variant: "destructive" })
    },
  })

  const podeEnviar = tipoVeiculoDesejado && enderecoColeta.trim() && enderecoEntrega.trim() && (!isGuest || (guestName.trim() && guestPhone.trim()))

  return (
    <div className="flex flex-col w-full min-h-full pb-8 bg-background">
      <header className="sticky top-0 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black">Fretes</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Truck className="w-5 h-5" />
            <p className="text-sm">Peça uma cotação — o transportador te responde com o valor.</p>
          </div>

          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={tipoVeiculoDesejado}
            onChange={(e) => setTipoVeiculoDesejado(e.target.value)}
          >
            <option value="">Que tipo de veículo você precisa?</option>
            {tiposVeiculo?.map((tipo) => (
              <option key={tipo} value={tipo}>{TIPO_VEICULO_LABELS[tipo] ?? tipo}</option>
            ))}
          </select>

          <Input placeholder="Endereço de coleta" value={enderecoColeta} onChange={(e) => setEnderecoColeta(e.target.value)} />
          <Input placeholder="Endereço de entrega" value={enderecoEntrega} onChange={(e) => setEnderecoEntrega(e.target.value)} />
          <Input placeholder="O que vai ser transportado (opcional)" value={tipoCarga} onChange={(e) => setTipoCarga(e.target.value)} />
          <Input type="number" placeholder="Peso aproximado em kg (opcional)" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />

          {isGuest && (
            <>
              <Input placeholder="Seu nome" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              <Input placeholder="Telefone (com DDD)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </>
          )}

          <Button className="w-full" disabled={!podeEnviar || cotar.isPending} onClick={() => cotar.mutate()}>
            Pedir Cotação
          </Button>
        </Card>
      </div>
    </div>
  )
}
