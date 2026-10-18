import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2 } from "lucide-react";

function getAdminKey(): string | null {
  return localStorage.getItem("praca_admin_key");
}

function adminHeaders() {
  const key = getAdminKey();
  return { "Content-Type": "application/json", "x-admin-key": key ?? "" };
}

function fmt(v: number | string | null) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Portão de acesso (chave de admin) ────────────────────────────────────────

function AdminGate({ children }: { children: React.ReactNode }) {
  const [keyInput, setKeyInput] = useState("");
  const [unlocked, setUnlocked] = useState(!!getAdminKey());
  const { toast } = useToast();

  async function tryUnlock() {
    // Testa a chave contra um endpoint admin real antes de liberar — não
    // dá pra saber se a chave está certa só olhando ela.
    const res = await fetch("/api/admin/disputas", {
      headers: { "x-admin-key": keyInput },
    });
    if (res.status === 401 || res.status === 403) {
      toast({ title: "Chave inválida", variant: "destructive" });
      return;
    }
    localStorage.setItem("praca_admin_key", keyInput);
    setUnlocked(true);
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" /> Painel Admin — Praça.ai
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            placeholder="Chave de administrador"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
          />
          <Button className="w-full" onClick={tryUnlock} disabled={!keyInput}>
            Entrar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Embaixadores ──────────────────────────────────────────────────────────────

function EmbaixadoresTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: embaixadores = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-embaixadores"],
    queryFn: () => fetch("/api/admin/embaixadores", { headers: adminHeaders() }).then((r) => r.json()),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/admin/embaixadores/${id}/status`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-embaixadores"] });
      toast({ title: "Status atualizado" });
    },
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {embaixadores.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum embaixador ainda.</TableCell></TableRow>
            ) : (
              embaixadores.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{e.email}</TableCell>
                  <TableCell className="font-mono text-xs">{e.codigo}</TableCell>
                  <TableCell>{fmt(e.saldoComissao)}</TableCell>
                  <TableCell>
                    <Badge variant={e.status === "ativo" ? "default" : "destructive"}>{e.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleStatus.mutate({ id: e.id, status: e.status === "ativo" ? "bloqueado" : "ativo" })}
                    >
                      {e.status === "ativo" ? "Bloquear" : "Reativar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Disputas ───────────────────────────────────────────────────────────────

const DISPUTA_STATUS_COLOR: Record<string, "default" | "secondary" | "destructive"> = {
  aberta: "destructive",
  em_analise: "secondary",
  resolvida: "default",
};

function DisputasTab() {
  const [statusFilter, setStatusFilter] = useState("todos");

  const { data: disputas = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-disputas", statusFilter],
    queryFn: () =>
      fetch(`/api/admin/disputas${statusFilter !== "todos" ? `?status=${statusFilter}` : ""}`, { headers: adminHeaders() })
        .then((r) => r.json()),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          <SelectItem value="aberta">Abertas</SelectItem>
          <SelectItem value="em_analise">Em análise</SelectItem>
          <SelectItem value="resolvida">Resolvidas</SelectItem>
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Frete devolução</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputas.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma disputa encontrada.</TableCell></TableRow>
              ) : (
                disputas.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">#{d.orderId}</TableCell>
                    <TableCell>{d.motivo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.freteDevolucaoResponsavel === "lojista" ? "100% lojista" : "Rateado vendedor/entregador"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={DISPUTA_STATUS_COLOR[d.status] ?? "secondary"}>{d.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{d.descricao}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Repasses ───────────────────────────────────────────────────────────────

function RepassesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [vendorAberto, setVendorAberto] = useState<string | null>(null);

  const { data: resumo = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-repasses-resumo"],
    queryFn: () => fetch("/api/admin/repasses/resumo", { headers: adminHeaders() }).then((r) => r.json()),
  });

  const { data: detalhes = [] } = useQuery<any[]>({
    queryKey: ["admin-repasses-detalhe", vendorAberto],
    queryFn: () => fetch(`/api/admin/repasses/${vendorAberto}?status=pendente`, { headers: adminHeaders() }).then((r) => r.json()),
    enabled: !!vendorAberto,
  });

  const marcarPago = useMutation({
    mutationFn: (vendorId: string) =>
      fetch(`/api/admin/repasses/${vendorId}/marcar-pago`, { method: "PATCH", headers: adminHeaders() }).then((r) => r.json()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-repasses-resumo"] });
      qc.invalidateQueries({ queryKey: ["admin-repasses-detalhe"] });
      toast({ title: `${data.marcados} repasse(s) marcado(s) como pago` });
      setVendorAberto(null);
    },
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cálculo do que cada lojista tem a receber — sem repasse automático ainda.
        Faça a transferência por fora (PIX/transferência) e marque como pago aqui.
      </p>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Pendente</TableHead>
                <TableHead>Pedidos pendentes</TableHead>
                <TableHead>Já pago</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum repasse registrado ainda.</TableCell></TableRow>
              ) : (
                resumo.map((v: any) => (
                  <Fragment key={v.vendorId}>
                    <TableRow>
                      <TableCell className="font-medium">{v.nomeEmpresa}</TableCell>
                      <TableCell className="font-bold">{fmt(v.pendente)}</TableCell>
                      <TableCell>{v.qtdPedidosPendentes}</TableCell>
                      <TableCell className="text-muted-foreground">{fmt(v.pago)}</TableCell>
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="outline" onClick={() => setVendorAberto(vendorAberto === v.vendorId ? null : v.vendorId)}>
                          {vendorAberto === v.vendorId ? "Fechar" : "Ver pedidos"}
                        </Button>
                        {v.pendente > 0 && (
                          <Button size="sm" onClick={() => marcarPago.mutate(v.vendorId)} disabled={marcarPago.isPending}>
                            Marcar tudo como pago
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {vendorAberto === v.vendorId && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30">
                          <div className="space-y-1 py-2">
                            {detalhes.map((d: any) => (
                              <div key={d.id} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Pedido #{d.orderId} — bruto {fmt(d.valorBruto)}, comissão {d.comissaoPercentual}%</span>
                                <span className="font-medium">{fmt(d.valorLiquido)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Comissões por loja ───────────────────────────────────────────────────────

function ComissoesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [edicoes, setEdicoes] = useState<Record<string, string>>({});

  const { data: lojas = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-lojas"],
    queryFn: () => fetch("/api/admin/lojas", { headers: adminHeaders() }).then((r) => r.json()),
  });

  const salvar = useMutation({
    mutationFn: ({ vendorId, comissaoPercentual }: { vendorId: string; comissaoPercentual: number }) =>
      fetch(`/api/admin/lojas/${vendorId}/comissao`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ comissaoPercentual }),
      }).then((r) => r.json()),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-lojas"] });
      setEdicoes((prev) => {
        const next = { ...prev };
        delete next[variables.vendorId];
        return next;
      });
      toast({ title: "Comissão atualizada" });
    },
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ajuste a comissão de cada loja conforme a demanda. Vale pras próximas vendas — não recalcula repasses já registrados.
      </p>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Comissão atual</TableHead>
                <TableHead>Nova comissão</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lojas.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma loja vendendo no Praça.ai ainda.</TableCell></TableRow>
              ) : (
                lojas.map((l: any) => {
                  const valorEditado = edicoes[l.vendorId] ?? String(l.comissaoPercentual);
                  const mudou = Number(valorEditado) !== l.comissaoPercentual && valorEditado !== "";
                  return (
                    <TableRow key={l.vendorId}>
                      <TableCell className="font-medium">{l.nomeEmpresa}</TableCell>
                      <TableCell className="text-muted-foreground">{l.comissaoPercentual}%</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          className="w-24"
                          value={valorEditado}
                          onChange={(e) => setEdicoes((prev) => ({ ...prev, [l.vendorId]: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={!mudou || salvar.isPending}
                          onClick={() => salvar.mutate({ vendorId: l.vendorId, comissaoPercentual: Number(valorEditado) })}
                        >
                          Salvar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


type InteligenciaData = {
  days: number;
  generatedAt: string;
  privacy: { aggregateOnly: boolean; categoryMinimum: number };
  quotes: {
    total: number; awaitingSuppliers: number; withOffers: number; accepted: number;
    unanswered: number; offers: number; averageFirstResponseHours: number | null;
  };
  rounds: {
    open: number; closed: number; noOffers: number; participants: number; bids: number;
    buyerAccepted: number; buyerDeclined: number;
  };
  orders: { total: number; delivered: number; inProgress: number; paymentPending: number; deliveredValue: number };
  coverage: { vendorsReceivingQuotes: number; vendorsSendingOffers: number; vendorsBiddingRounds: number };
  demandByCategory: Array<{ category: string; total: number }>;
};

function MetricCard({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground mt-1">{detail}</p></CardContent>
    </Card>
  );
}

function InteligenciaTab() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError, error } = useQuery<InteligenciaData>({
    queryKey: ["admin-inteligencia", days],
    queryFn: async () => {
      const response = await fetch(`/api/admin/inteligencia?days=${days}`, { headers: adminHeaders() });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Falha ao carregar os indicadores.");
      }
      return response.json();
    },
  });

  const periodButtons = [7, 30, 90, 365];
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;
  if (isError || !data) return <Card><CardContent className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : "Não foi possível carregar os indicadores."}</CardContent></Card>;

  const hours = data.quotes.averageFirstResponseHours;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Inteligência do negócio</h2>
          <p className="text-sm text-muted-foreground">Demanda, resposta dos lojistas e conversão das rodadas.</p>
        </div>
        <div className="flex gap-2" aria-label="Período dos indicadores">
          {periodButtons.map((value) => (
            <Button key={value} size="sm" variant={days === value ? "default" : "outline"} onClick={() => setDays(value)}>
              {value === 365 ? "12 meses" : `${value} dias`}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Cotações recebidas" value={data.quotes.total} detail={`${data.quotes.awaitingSuppliers} sem fornecedor identificado`} />
        <MetricCard title="Cotações com proposta" value={data.quotes.withOffers} detail={`${data.quotes.offers} propostas enviadas`} />
        <MetricCard title="Cotações aceitas" value={data.quotes.accepted} detail={`${data.quotes.unanswered} ainda sem proposta`} />
        <MetricCard title="1ª resposta média" value={hours == null ? "—" : `${hours.toLocaleString("pt-BR")} h`} detail="Tempo entre pedido e primeira proposta" />
        <MetricCard title="Rodadas abertas" value={data.rounds.open} detail={`${data.rounds.closed} encerradas no período`} />
        <MetricCard title="Participações em lotes" value={data.rounds.participants} detail={`${data.rounds.bids} ofertas de lojistas`} />
        <MetricCard title="Rodadas aceitas pelo comprador" value={data.rounds.buyerAccepted} detail="Pagamento é formalizado com a loja após o aceite" />
        <MetricCard title="Rodadas sem oferta" value={data.rounds.noOffers} detail="Sinal de cobertura ou prazo insuficiente" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marketplace e vendas concluídas</CardTitle>
          <p className="text-sm text-muted-foreground">Pedidos do checkout convencional; concluído = status “entregue”. O fluxo de retenção/liberação ainda não está integrado a esta métrica.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Pedidos recebidos" value={data.orders.total} detail="Todos os status no período" />
          <MetricCard title="Em andamento" value={data.orders.inProgress} detail="Confirmados ou em entrega" />
          <MetricCard title="Pagamento pendente" value={data.orders.paymentPending} detail="Requer acompanhamento" />
          <MetricCard title="Pedidos entregues" value={data.orders.delivered} detail="Status de entrega concluída" />
          <MetricCard title="Valor entregue" value={fmt(data.orders.deliveredValue)} detail="Soma do total de pedidos entregues; não confirma valor liberado" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Categorias de maior demanda no período</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.demandByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não há volume suficiente para mostrar categorias neste período.</p>
            ) : data.demandByCategory.map((item) => {
              const max = Math.max(...data.demandByCategory.map((entry) => entry.total), 1);
              return (
                <div key={item.category} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm"><span>{item.category}</span><span className="font-medium">{item.total}</span></div>
                  <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.max(4, (item.total / max) * 100)}%` }} /></div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">Exibimos uma categoria apenas quando ela tem pelo menos {data.privacy.categoryMinimum} solicitações.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Cobertura de fornecedores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span>Lojistas que receberam cotações</span><strong>{data.coverage.vendorsReceivingQuotes}</strong></div>
            <div className="flex justify-between text-sm"><span>Lojistas que enviaram proposta</span><strong>{data.coverage.vendorsSendingOffers}</strong></div>
            <div className="flex justify-between text-sm"><span>Lojistas que deram lance em rodadas</span><strong>{data.coverage.vendorsBiddingRounds}</strong></div>
            <p className="border-t pt-3 text-xs text-muted-foreground">Painel interno com contagens agregadas. Não exibe comprador, contato, nome ou desempenho individual de loja.</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Período selecionado: {data.days} dias. Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")}.
        Os indicadores descrevem o histórico observado; não são previsão de vendas.
      </p>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

function AdminContent() {
  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Painel Admin — Praça.ai
        </h1>
        <Tabs defaultValue="embaixadores">
          <TabsList>
            <TabsTrigger value="embaixadores">Embaixadores</TabsTrigger>
            <TabsTrigger value="disputas">Disputas</TabsTrigger>
            <TabsTrigger value="repasses">Repasses</TabsTrigger>
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
            <TabsTrigger value="inteligencia">Inteligência</TabsTrigger>
          </TabsList>
          <TabsContent value="embaixadores" className="mt-4">
            <EmbaixadoresTab />
          </TabsContent>
          <TabsContent value="disputas" className="mt-4">
            <DisputasTab />
          </TabsContent>
          <TabsContent value="repasses" className="mt-4">
            <RepassesTab />
          </TabsContent>
          <TabsContent value="comissoes" className="mt-4">
            <ComissoesTab />
          </TabsContent>
          <TabsContent value="inteligencia" className="mt-4">
            <InteligenciaTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  return (
    <AdminGate>
      <AdminContent />
    </AdminGate>
  );
}
