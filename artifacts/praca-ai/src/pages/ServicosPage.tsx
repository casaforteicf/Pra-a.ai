import * as React from "react"
import { useLocation } from "wouter"
import { ChevronLeft, Wrench } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

interface ServicoTipo {
  id: string
  nome: string
  descricao: string | null
  especialidade: string
  precoBase: number | null
  requerVisitaTecnica: boolean
  vendorName: string
}

const ESPECIALIDADE_LABEL: Record<string, string> = {
  pedreiro: "Pedreiro",
  eletricista: "Eletricista",
  encanador: "Encanador",
  geral: "Geral",
}

export default function ServicosPage() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { user } = useAuth()

  const { data: tipos, isLoading } = useQuery<ServicoTipo[]>({
    queryKey: ["servicos-tipos"],
    queryFn: () => fetch("/api/servicos/tipos").then((r) => r.json()),
  })

  const [selecionado, setSelecionado] = React.useState<ServicoTipo | null>(null)
  const [enderecoAtendimento, setEnderecoAtendimento] = React.useState("")
  const [observacoes, setObservacoes] = React.useState("")
  const [guestName, setGuestName] = React.useState("")
  const [guestPhone, setGuestPhone] = React.useState("")
  const isGuest = !user

  const solicitar = useMutation({
    mutationFn: () =>
      fetch("/api/servicos/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tipoServicoId: selecionado?.id,
          enderecoAtendimento,
          observacoes,
          ...(isGuest ? { guestName, guestPhone } : {}),
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Falha ao solicitar")
        return r.json()
      }),
    onSuccess: () => {
      toast({ title: "Solicitação enviada!", description: "O prestador vai entrar em contato pra combinar o orçamento." })
      setSelecionado(null)
      setEnderecoAtendimento("")
      setObservacoes("")
    },
    onError: (err: any) => {
      toast({ title: "Não foi possível solicitar", description: err.message, variant: "destructive" })
    },
  })

  return (
    <div className="flex flex-col w-full min-h-full pb-8 bg-background">
      <header className="sticky top-0 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (selecionado ? setSelecionado(null) : setLocation("/"))}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black">Serviços</h1>
        </div>
      </header>

      {isLoading ? (
        <PageLoader />
      ) : selecionado ? (
        <div className="p-4 space-y-4">
          <Card className="p-4 space-y-1">
            <p className="font-bold">{selecionado.nome}</p>
            <p className="text-sm text-muted-foreground">{selecionado.vendorName}</p>
            {selecionado.precoBase && <p className="text-sm text-muted-foreground">A partir de {formatMoney(selecionado.precoBase)}</p>}
            {selecionado.requerVisitaTecnica && <p className="text-xs text-muted-foreground">Esse serviço geralmente precisa de visita técnica pra fechar o valor.</p>}
          </Card>

          <Input placeholder="Endereço de atendimento" value={enderecoAtendimento} onChange={(e) => setEnderecoAtendimento(e.target.value)} />
          <Textarea placeholder="Conte um pouco do que você precisa (opcional)" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />

          {isGuest && (
            <>
              <Input placeholder="Seu nome" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              <Input placeholder="Telefone (com DDD)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </>
          )}

          <Button
            className="w-full"
            disabled={!enderecoAtendimento.trim() || (isGuest && (!guestName.trim() || !guestPhone.trim())) || solicitar.isPending}
            onClick={() => solicitar.mutate()}
          >
            Solicitar Orçamento
          </Button>
        </div>
      ) : !tipos || tipos.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 text-muted-foreground">
          <Wrench className="w-12 h-12" />
          <p className="font-medium">Nenhum prestador disponível ainda.</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {tipos.map((t) => (
            <Card key={t.id} className="p-4 flex items-center justify-between active:scale-[0.98] transition-transform" onClick={() => setSelecionado(t)}>
              <div>
                <p className="font-bold text-sm">{t.nome}</p>
                <p className="text-xs text-muted-foreground">{ESPECIALIDADE_LABEL[t.especialidade] ?? t.especialidade} · {t.vendorName}</p>
                {t.precoBase && <p className="text-sm font-black text-primary mt-1">A partir de {formatMoney(t.precoBase)}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
