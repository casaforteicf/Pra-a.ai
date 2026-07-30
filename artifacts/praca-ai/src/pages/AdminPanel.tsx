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
