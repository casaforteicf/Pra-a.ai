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
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [cancellationNotes, setCancellationNotes] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: disputas = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-disputas", statusFilter],
    queryFn: () =>
      fetch(`/api/admin/disputas${statusFilter !== "todos" ? `?status=${statusFilter}` : ""}`, { headers: adminHeaders() })
        .then((r) => r.json()),
  });

  const { data: marketplaceDisputas = [], isLoading: marketplaceLoading } = useQuery<any[]>({
    queryKey: ["admin-marketplace-disputas", statusFilter],
    queryFn: () => fetch(`/api/admin/marketplace-disputas${statusFilter !== "todos" ? `?status=${statusFilter}` : ""}`, { headers: adminHeaders() }).then((r) => r.json()),
  });
  const { data: marketplaceCancellations = [], isLoading: cancellationLoading } = useQuery<any[]>({
    queryKey: ["admin-marketplace-cancelamentos"],
    queryFn: () => fetch("/api/admin/marketplace-cancelamentos", { headers: adminHeaders() }).then((r) => r.json()),
  });
  const updateMarketplaceDispute = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const resolutionText = resolutionNotes[id] ?? "";
      const response = await fetch(`/api/admin/marketplace-disputas/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ status, resolutionText }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível atualizar a disputa.");
      return body;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-marketplace-disputas"] });
      toast({ title: "Disputa atualizada" });
    },
    onError: (error: Error) => toast({ title: "Não foi possível atualizar", description: error.message, variant: "destructive" }),
  });

  const updateMarketplaceCancellation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const resolutionNote = cancellationNotes[id] ?? "";
      const response = await fetch(`/api/admin/marketplace-cancelamentos/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ status, resolutionNote }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível atualizar a solicitação.");
      return body;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-marketplace-cancelamentos"] });
      toast({ title: "Solicitação de cancelamento atualizada" });
    },
    onError: (error: Error) => toast({ title: "Não foi possível atualizar", description: error.message, variant: "destructive" }),
  });
  const requestMarketplaceRefund = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const note = cancellationNotes[id] ?? "";
      const response = await fetch(`/api/admin/marketplace-cancelamentos/${encodeURIComponent(id)}/estorno`, {
        method: "POST", headers: adminHeaders(), body: JSON.stringify({ note }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível solicitar o estorno.");
      return body;
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["admin-marketplace-cancelamentos"] });
      toast({ title: "Estorno enviado ao Asaas", description: result.message });
    },
    onError: (error: Error) => {
      void qc.invalidateQueries({ queryKey: ["admin-marketplace-cancelamentos"] });
      toast({ title: "Estorno não confirmado", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading || marketplaceLoading || cancellationLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          <SelectItem value="aberta">Abertas</SelectItem>
          <SelectItem value="em_analise">Em análise</SelectItem>
          <SelectItem value="aguardando_comprador">Aguardando comprador</SelectItem>
          <SelectItem value="resolvida">Resolvidas</SelectItem>
          <SelectItem value="rejeitada">Rejeitadas</SelectItem>
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

      <Card>
        <CardHeader><CardTitle>Disputas de cotações e rodadas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Comprador</TableHead><TableHead>Motivo e relato</TableHead><TableHead>Status</TableHead><TableHead>Tratamento</TableHead></TableRow></TableHeader>
            <TableBody>
              {marketplaceDisputas.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma disputa de cotação ou rodada.</TableCell></TableRow> : marketplaceDisputas.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="min-w-36"><b>{d.order_code ?? d.order_id.slice(0, 8)}</b><p className="text-xs text-muted-foreground">{d.order_type === "quote" ? "Cotação" : "Rodada"} · {d.item_title}</p></TableCell>
                  <TableCell>{d.buyer_name}<p className="text-xs text-muted-foreground">{d.buyer_email}</p></TableCell>
                  <TableCell className="min-w-64"><b>{d.reason_code}</b><p className="whitespace-pre-wrap text-sm">{d.description}</p>{d.evidence_url && <a className="text-xs font-bold text-primary underline" href={d.evidence_url} target="_blank" rel="noreferrer">Abrir evidência</a>}</TableCell>
                  <TableCell><Badge variant={DISPUTA_STATUS_COLOR[d.status] ?? "secondary"}>{d.status}</Badge>{d.buyer_response && <p className="mt-1 max-w-48 whitespace-pre-wrap text-xs"><b>Retorno do comprador:</b> {d.buyer_response}</p>}{d.vendor_response && <p className="mt-1 max-w-48 whitespace-pre-wrap text-xs"><b>Resposta da loja:</b> {d.vendor_response}</p>}{d.resolution_text && <p className="mt-1 max-w-48 text-xs text-muted-foreground">{d.resolution_text}</p>}</TableCell>
                  <TableCell className="min-w-56 space-y-2">
                    {!['resolvida','rejeitada'].includes(d.status) ? <>
                      <Input value={resolutionNotes[d.id] ?? ""} onChange={(event) => setResolutionNotes((current) => ({ ...current, [d.id]: event.target.value }))} placeholder="Observação para o histórico" />
                      {d.status === "aberta" && <Button size="sm" variant="outline" disabled={updateMarketplaceDispute.isPending} onClick={() => updateMarketplaceDispute.mutate({ id: d.id, status: "em_analise" })}>Iniciar análise</Button>}
                      {d.status === "em_analise" && <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={updateMarketplaceDispute.isPending} onClick={() => updateMarketplaceDispute.mutate({ id: d.id, status: "aguardando_comprador" })}>Pedir retorno</Button><Button size="sm" disabled={updateMarketplaceDispute.isPending} onClick={() => updateMarketplaceDispute.mutate({ id: d.id, status: "resolvida" })}>Resolver</Button><Button size="sm" variant="destructive" disabled={updateMarketplaceDispute.isPending} onClick={() => updateMarketplaceDispute.mutate({ id: d.id, status: "rejeitada" })}>Rejeitar</Button></div>}
                      {d.status === "aguardando_comprador" && <div className="flex gap-1"><Button size="sm" variant="outline" disabled={updateMarketplaceDispute.isPending} onClick={() => updateMarketplaceDispute.mutate({ id: d.id, status: "em_analise" })}>Retomar análise</Button><Button size="sm" disabled={updateMarketplaceDispute.isPending} onClick={() => updateMarketplaceDispute.mutate({ id: d.id, status: "resolvida" })}>Resolver</Button></div>}
                    </> : <span className="text-xs text-muted-foreground">Concluída · {d.resolved_at ? new Date(d.resolved_at).toLocaleString("pt-BR") : ""}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Solicitações de cancelamento</CardTitle><p className="text-sm text-muted-foreground">O estorno integral é solicitado ao Asaas e só aparece como concluído após confirmação por webhook. Respostas inconclusivas ficam bloqueadas para conciliação manual.</p></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Comprador</TableHead><TableHead>Motivo</TableHead><TableHead>Status</TableHead><TableHead>Atendimento</TableHead></TableRow></TableHeader>
            <TableBody>
              {marketplaceCancellations.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma solicitação de cancelamento.</TableCell></TableRow> : marketplaceCancellations.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="min-w-36"><b>{item.order_code ?? item.order_id.slice(0, 8)}</b><p className="text-xs text-muted-foreground">{item.order_type === "quote" ? "Cotação" : "Rodada"} · {item.item_title}</p></TableCell>
                  <TableCell>{item.buyer_name}<p className="text-xs text-muted-foreground">{item.buyer_email}</p></TableCell>
                  <TableCell className="min-w-52"><b>{item.reason}</b><p className="whitespace-pre-wrap text-sm">{item.description}</p></TableCell>
                  <TableCell><Badge variant={item.status === "solicitada" ? "destructive" : item.status === "atendida" ? "default" : "secondary"}>{item.status}</Badge><p className="mt-1 text-xs">Estorno: {item.refund_status ?? "nao_solicitado"}</p>{item.refund_error && <p className="mt-1 max-w-48 whitespace-pre-wrap text-xs text-destructive">{item.refund_error}</p>}{item.asaas_refunded_at && <p className="mt-1 text-xs text-muted-foreground">Confirmado em {new Date(item.asaas_refunded_at).toLocaleString("pt-BR")}</p>}{item.resolution_note && <p className="mt-1 max-w-48 whitespace-pre-wrap text-xs">{item.resolution_note}</p>}</TableCell>
                  <TableCell className="min-w-56 space-y-2">
                    {!['atendida','recusada'].includes(item.status) ? <>
                      <Input value={cancellationNotes[item.id] ?? ""} onChange={(event) => setCancellationNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Resultado / nota para o histórico" />
                      {item.status === "solicitada" && <Button size="sm" variant="outline" disabled={updateMarketplaceCancellation.isPending} onClick={() => updateMarketplaceCancellation.mutate({ id: item.id, status: "em_analise" })}>Iniciar análise</Button>}
                      {item.status === "em_analise" && <div className="flex flex-wrap gap-1">
                        {["nao_solicitado", "negado"].includes(item.refund_status ?? "nao_solicitado") && <Button size="sm" disabled={requestMarketplaceRefund.isPending || (cancellationNotes[item.id] ?? "").trim().length < 8} onClick={() => { if (window.confirm("Solicitar estorno integral desta cobrança no Asaas? O pedido será concluído somente após confirmação do webhook.")) requestMarketplaceRefund.mutate({ id: item.id }); }}>Solicitar estorno integral</Button>}
                        {["solicitado", "em_processamento"].includes(item.refund_status) && <span className="text-xs text-muted-foreground">Aguardando confirmação do Asaas. Não solicite novamente.</span>}
                        {["parcial", "reconciliacao"].includes(item.refund_status) && <span className="text-xs font-semibold text-amber-700">Conciliação manual necessária antes de concluir.</span>}
                        {!(["solicitado", "em_processamento", "estornado", "parcial", "reconciliacao"].includes(item.refund_status)) && <Button size="sm" variant="destructive" disabled={updateMarketplaceCancellation.isPending} onClick={() => updateMarketplaceCancellation.mutate({ id: item.id, status: "recusada" })}>Recusar</Button>}
                      </div>}
                    </> : <span className="text-xs text-muted-foreground">Concluída · {item.resolved_at ? new Date(item.resolved_at).toLocaleString("pt-BR") : ""}</span>}
                  </TableCell>
                </TableRow>
              ))}
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

// ── Página ─────────────────────────────────────────────────────────────────


function NegotiationAuditTab(){
 const [nsu,setNsu]=useState(""),[data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [loadedNsu,setLoadedNsu]=useState("");
 async function search(more=false){setBusy(true);setError("");try{const key=more?loadedNsu:nsu.trim().toUpperCase();const r=await fetch("/api/admin/negociacoes/"+encodeURIComponent(key)+(more&&data?.nextCursor?"?after="+data.nextCursor:""),{headers:adminHeaders(),cache:"no-store"});const b=await r.json();if(!r.ok)throw Error(b.error??"Falha ao carregar NSU.");setLoadedNsu(key);setData((old:any)=>more&&old?{...b,events:[...old.events,...b.events]}:b)}catch(e){setError(e instanceof Error?e.message:"Falha ao carregar.")}finally{setBusy(false)}}
 return <section className="space-y-4"><h2 className="text-xl font-bold">Histórico por NSU mestre</h2><form onSubmit={e=>{e.preventDefault();void search()}} className="flex flex-wrap gap-2"><label className="flex-1 text-sm">NSU mestre<Input value={nsu} onChange={e=>setNsu(e.target.value)} placeholder="NSU-123"/></label><Button type="submit" disabled={busy}>Consultar</Button></form>
 {error&&<p role="alert" className="text-red-700">{error}</p>}
 {data&&<><p><strong>{data.negotiation.master_nsu}</strong> · {data.negotiation.source_type} · {data.negotiation.source_id}</p><ol className="space-y-3">{data.events.map((e:any)=><li key={e.sequence} className="rounded-xl border bg-white p-3"><p className="font-bold">{e.movement_nsu} · {e.entity_type} · {e.operation}</p><p className="text-xs">{new Date(e.recorded_at).toLocaleString("pt-BR")} · ator: {e.actor_type}{e.actor_id?" / "+e.actor_id:""} · evento {e.sequence}</p><details className="mt-2"><summary>Dados da movimentação</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({before:e.before_data,after:e.after_data},null,2)}</pre></details></li>)}</ol>{data.nextCursor&&<Button disabled={busy} onClick={()=>void search(true)}>Carregar mais</Button>}</>}
 <p className="text-xs text-muted-foreground">Fotografias de migração registram o estado disponível, sem reconstruir alterações antigas. Ator “system” indica que a fonte não identificou um usuário.</p>
 </section>;
}

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
            <TabsTrigger value="nsu">Histórico NSU</TabsTrigger>
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
          <TabsContent value="nsu" className="mt-4"><NegotiationAuditTab/></TabsContent>
          <TabsContent value="comissoes" className="mt-4">
            <ComissoesTab />
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
