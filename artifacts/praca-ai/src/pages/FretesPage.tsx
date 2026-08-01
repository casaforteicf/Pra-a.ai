import * as React from "react"
import { useLocation } from "wouter"
import { ChevronLeft, Truck, MapPin } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { LocationPickerMap } from "@/components/LocationPickerMap"

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
  // transportador (estilo Uber). Login obrigatório: sem fluxo de guest aqui
  // (diferente de outras telas do Praça.ai) — nome/telefone vêm da conta.
  const { data: tiposVeiculo } = useQuery<string[]>({
    queryKey: ["fretes-tipos-veiculo"],
    queryFn: () => fetch("/api/fretes/tipos-veiculo").then((r) => r.json()),
    enabled: !!user,
  })

  const [tipoVeiculoDesejado, setTipoVeiculoDesejado] = React.useState("")
  const [enderecoColeta, setEnderecoColeta] = React.useState("")
  const [enderecoEntrega, setEnderecoEntrega] = React.useState("")
  const [pontoColeta, setPontoColeta] = React.useState<{ lat: number; lng: number } | null>(null)
  const [pontoEntrega, setPontoEntrega] = React.useState<{ lat: number; lng: number } | null>(null)
  const [showPickerColeta, setShowPickerColeta] = React.useState(false)
  const [showPickerEntrega, setShowPickerEntrega] = React.useState(false)
  const [tipoCarga, setTipoCarga] = React.useState("")
  const [pesoKg, setPesoKg] = React.useState("")
  const [comprimentoCm, setComprimentoCm] = React.useState("")
  const [larguraCm, setLarguraCm] = React.useState("")
  const [alturaCm, setAlturaCm] = React.useState("")

  // Volume calculado automaticamente a partir das 3 dimensões (cm³ → m³) —
  // cliente nunca digita m³ direto.
  const volumeM3 = React.useMemo(() => {
    const c = Number(comprimentoCm), l = Number(larguraCm), a = Number(alturaCm)
    if (!c || !l || !a) return undefined
    return (c * l * a) / 1_000_000
  }, [comprimentoCm, larguraCm, alturaCm])

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
          enderecoColetaLat: pontoColeta?.lat,
          enderecoColetaLng: pontoColeta?.lng,
          enderecoEntregaLat: pontoEntrega?.lat,
          enderecoEntregaLng: pontoEntrega?.lng,
          tipoCarga: tipoCarga || undefined,
          pesoKg: pesoKg ? Number(pesoKg) : undefined,
          volumeM3,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Falha ao pedir cotação")
        return r.json()
      }),
    onSuccess: (data) => {
      toast({ title: "Cotação solicitada!", description: `${data.vendorName} vai te responder com o valor em breve.` })
      setEnderecoColeta("")
      setEnderecoEntrega("")
      setPontoColeta(null)
      setPontoEntrega(null)
      setShowPickerColeta(false)
      setShowPickerEntrega(false)
      setTipoCarga("")
      setPesoKg("")
      setComprimentoCm("")
      setLarguraCm("")
      setAlturaCm("")
    },
    onError: (err: any) => {
      toast({ title: "Não foi possível pedir a cotação", description: err.message, variant: "destructive" })
    },
  })

  const podeEnviar = tipoVeiculoDesejado && enderecoColeta.trim() && enderecoEntrega.trim()

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
        {!user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Truck className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-black mb-2">Entre para pedir um frete</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Faça login pra solicitar — seu nome e telefone já ficam vinculados à sua conta.
            </p>
            <Button onClick={() => setLocation("/login")}>Entrar</Button>
          </div>
        ) : (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="w-5 h-5" />
              <p className="text-sm">Escolha o tipo de veículo — a gente atribui automaticamente um transportador disponível, que te responde com o valor.</p>
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

            <div className="space-y-1.5">
              <Input placeholder="Endereço de coleta" value={enderecoColeta} onChange={(e) => setEnderecoColeta(e.target.value)} />
              <button
                type="button"
                onClick={() => setShowPickerColeta((v) => !v)}
                className="text-xs text-primary font-medium flex items-center gap-1"
              >
                <MapPin className="h-3 w-3" /> {pontoColeta ? "Ponto marcado no mapa ✓" : "Marcar ponto exato no mapa (opcional)"}
              </button>
              {showPickerColeta && <LocationPickerMap value={pontoColeta} onChange={setPontoColeta} />}
            </div>

            <div className="space-y-1.5">
              <Input placeholder="Endereço de entrega" value={enderecoEntrega} onChange={(e) => setEnderecoEntrega(e.target.value)} />
              <button
                type="button"
                onClick={() => setShowPickerEntrega((v) => !v)}
                className="text-xs text-primary font-medium flex items-center gap-1"
              >
                <MapPin className="h-3 w-3" /> {pontoEntrega ? "Ponto marcado no mapa ✓" : "Marcar ponto exato no mapa (opcional)"}
              </button>
              {showPickerEntrega && <LocationPickerMap value={pontoEntrega} onChange={setPontoEntrega} />}
            </div>

            <Input placeholder="O que vai ser transportado (opcional)" value={tipoCarga} onChange={(e) => setTipoCarga(e.target.value)} />
            <Input type="number" placeholder="Peso aproximado em kg (opcional)" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Dimensões da carga em cm (opcional)</p>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" placeholder="Compr." value={comprimentoCm} onChange={(e) => setComprimentoCm(e.target.value)} />
                <Input type="number" placeholder="Larg." value={larguraCm} onChange={(e) => setLarguraCm(e.target.value)} />
                <Input type="number" placeholder="Alt." value={alturaCm} onChange={(e) => setAlturaCm(e.target.value)} />
              </div>
              {volumeM3 !== undefined && (
                <p className="text-xs text-muted-foreground">≈ {volumeM3.toFixed(3)} m³</p>
              )}
            </div>

            <Button className="w-full" disabled={!podeEnviar || cotar.isPending} onClick={() => cotar.mutate()}>
              Solicitar Frete
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}
