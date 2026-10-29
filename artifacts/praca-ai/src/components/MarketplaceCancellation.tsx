import * as React from "react";

type Cancellation = {
  id: string; reason: string; description: string; status: string;
  refund_status?: string; asaas_refunded_at?: string | null; refund_error?: string | null;
  resolution_note?: string | null;
  events?: Array<{ id: string; actorType: string; note: string; createdAt: string }>;
};
const REASONS = [
  ["mudanca_de_ideia", "Mudei de ideia"], ["prazo", "Prazo de entrega"],
  ["preco", "Condição ou preço"], ["erro_no_pedido", "Erro no pedido"], ["outro", "Outro motivo"],
] as const;
const LABELS: Record<string, string> = {
  solicitada: "Solicitação enviada", em_analise: "Em análise pela Praça.ai",
  atendida: "Atendimento concluído", recusada: "Solicitação não atendida",
};
const REFUND_LABELS: Record<string, string> = {
  nao_solicitado: "Estorno ainda não solicitado", solicitado: "Estorno solicitado",
  em_processamento: "Estorno em processamento", estornado: "Estorno confirmado",
  parcial: "Estorno parcial — em análise", negado: "Estorno não autorizado pelo pagamento",
  reconciliacao: "Estorno precisa de conciliação pela Praça.ai",
};

export default function MarketplaceCancellation({ orderType, orderId, orderStatus, onSaved }: {
  orderType: "quote" | "round"; orderId: string; orderStatus: string; onSaved: () => void;
}) {
  const [request, setRequest] = React.useState<Cancellation | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("mudanca_de_ideia");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/marketplace-orders/${orderType}/${encodeURIComponent(orderId)}/cancelamento`, {
      credentials: "include", cache: "no-store", signal,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar o cancelamento.");
    if (!signal?.aborted) setRequest(body);
  }, [orderType, orderId]);

  React.useEffect(() => {
    if (!["paid", "cancelled"].includes(orderStatus)) { setRequest(null); setLoaded(true); return; }
    const controller = new AbortController();
    void load(controller.signal).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha ao consultar."); })
      .finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, [load, orderStatus]);

  if (!["paid", "cancelled"].includes(orderStatus) || !loaded) return null;
  if (request) return <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
    <strong>Cancelamento: {LABELS[request.status] ?? request.status}</strong>
    {request.refund_status && <p className="mt-1 font-semibold">{REFUND_LABELS[request.refund_status] ?? request.refund_status}{request.asaas_refunded_at ? ` · ${new Date(request.asaas_refunded_at).toLocaleString("pt-BR")}` : ""}</p>}
    <p className="mt-1">{REASONS.find(([value]) => value === request.reason)?.[1] ?? request.reason}</p>
    {request.refund_error && <p role="status" className="mt-2">{request.refund_error}</p>}
    {request.resolution_note && <p className="mt-2 whitespace-pre-wrap">{request.resolution_note}</p>}
    {request.events && request.events.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-bold">Histórico do atendimento</summary><ol className="mt-2 space-y-2">{request.events.map((event) => <li key={event.id} className="border-l-2 border-amber-300 pl-2"><p className="text-xs font-bold">{event.actorType === "admin" ? "Praça.ai" : "Você"} · {new Date(event.createdAt).toLocaleString("pt-BR")}</p><p className="whitespace-pre-wrap">{event.note}</p></li>)}</ol></details>}
    {request.status === "solicitada" || request.status === "em_analise" ? <p className="mt-2 text-xs">A solicitação não cancela o pedido. O estorno só estará concluído quando a Praça.ai confirmar a resposta do pagamento.</p> : null}
  </div>;

  if (orderStatus === "cancelled") return null;
  return <div className="mt-3">
    {!open ? <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-amber-800 underline">Solicitar cancelamento</button>
      : <form className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError("");
        try {
          const response = await fetch(`/api/marketplace-orders/${orderType}/${encodeURIComponent(orderId)}/cancelamento`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason, description }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? "Não foi possível enviar a solicitação.");
          setRequest(body); setOpen(false); onSaved();
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao enviar a solicitação."); }
        finally { setBusy(false); }
      }}>
        <div><strong className="block">Solicitar cancelamento</strong><p className="text-xs">A Praça.ai analisará o pedido. Enviar a solicitação não cancela o pedido nem efetua automaticamente um estorno.</p></div>
        <label className="block text-xs font-bold">Motivo<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal">{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-xs font-bold">Conte o motivo<textarea required minLength={12} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border bg-white p-3 text-sm font-normal" placeholder="Descreva por que deseja cancelar." /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2"><button disabled={busy || description.trim().length < 12} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Enviando…" : "Enviar solicitação"}</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm font-bold">Voltar</button></div>
      </form>}
  </div>;
}
