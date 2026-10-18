import * as React from "react";

type OrderType = "quote" | "round";
type Dispute = { id: string; reason: string; description: string; status: string; vendorResponse?: string | null; resolutionText?: string | null; createdAt?: string; resolvedAt?: string | null };

const REASONS = [
  ["nao_recebido", "Pedido não recebido"],
  ["produto_danificado", "Produto danificado"],
  ["produto_incompleto", "Pedido incompleto"],
  ["produto_divergente", "Produto diferente da proposta"],
  ["atraso", "Atraso na entrega"],
  ["outro", "Outro problema"],
] as const;
const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta · aguardando análise da plataforma",
  em_analise: "Em análise pela plataforma",
  aguardando_comprador: "Aguardando informações do comprador",
  resolvida: "Concluída",
  rejeitada: "Concluída",
};

export default function MarketplaceDisputeForm({ orderType, orderId, orderStatus, dispute, onSaved }: {
  orderType: OrderType; orderId: string; orderStatus: string; dispute?: Dispute | null; onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("nao_recebido");
  const [description, setDescription] = React.useState("");
  const [evidenceUrl, setEvidenceUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  if (dispute) return <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
    <strong>Disputa: {STATUS_LABEL[dispute.status] ?? dispute.status}</strong>
    <p className="mt-1">{REASONS.find(([value]) => value === dispute.reason)?.[1] ?? dispute.reason}</p>
    {dispute.vendorResponse && <p className="mt-2 rounded-lg bg-white/70 p-3"><strong>Resposta da loja:</strong> {dispute.vendorResponse}</p>}
    {dispute.resolutionText && <p className="mt-1 whitespace-pre-wrap">{dispute.resolutionText}</p>}
    {dispute.status === "aberta" || dispute.status === "em_analise" || dispute.status === "aguardando_comprador"
      ? <p className="mt-2 text-xs">O pedido está em análise. A plataforma não deve processar repasse enquanto houver uma disputa aberta.</p>
      : null}
  </div>;

  if (!(orderStatus === "paid" || orderStatus === "delivered")) return null;
  return <div className="mt-3">
    {!open ? <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-amber-800 underline">Informar um problema com este pedido</button>
    : <form className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3" onSubmit={async (event) => {
      event.preventDefault(); setError(""); setBusy(true);
      try {
        const response = await fetch(`/api/marketplace-orders/${orderType}/${encodeURIComponent(orderId)}/disputa`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, description, evidenceUrl }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Não foi possível abrir a disputa.");
        setOpen(false); onSaved();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao abrir disputa."); }
      finally { setBusy(false); }
    }}>
      <div><strong className="block">Abrir uma disputa</strong><p className="text-xs text-amber-900">A plataforma registrará o caso e analisará a solicitação. Não informe dados de cartão ou senha.</p></div>
      <label className="block text-xs font-bold">Motivo<select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal">{REASONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-xs font-bold">Conte o que aconteceu<textarea required minLength={12} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-24 w-full rounded-lg border bg-white p-3 text-sm font-normal" placeholder="Descreva o problema e quando ocorreu." /></label>
      <label className="block text-xs font-bold">Link de evidência (opcional)<input type="url" inputMode="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal" placeholder="https://…" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Enviando…" : "Registrar disputa"}</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm font-bold">Cancelar</button></div>
    </form>}
  </div>;
}
