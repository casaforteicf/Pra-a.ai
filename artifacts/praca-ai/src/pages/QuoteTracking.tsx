import * as React from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Check, Clock3, MapPin, Package, ShieldCheck, Truck } from "lucide-react";

type Offer = {
  id: string; subtotal: number; freight: number; total: number; deliveryDays: number;
  terms?: string | null; status: string; vendor?: { id: string; name: string } | null;
  items: { itemId: string; unitPrice: number; quantity: number; unit: string; description: string }[];
};
type Quote = {
  id: string; protocol: string; category: string; title: string; description?: string | null;
  location: string; neededAt?: string | null; status: string;
  items: { id: string; quantity: number; unit: string; description: string; brand?: string | null }[];
  offers: Offer[];
};

export default function QuoteTracking() {
  const [match, params] = useRoute("/cotacao/:id");
  const id = match ? params.id : "";
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    if (!id) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/quotes/" + encodeURIComponent(id), { credentials: "include", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar a cotação.");
      setQuote(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar a cotação."); }
    finally { setLoading(false); }
  }, [id]);
  React.useEffect(() => { void load(); }, [load]);

  const accept = async (offerId: string) => {
    setBusy(offerId); setError("");
    try {
      const response = await fetch("/api/quotes/" + encodeURIComponent(id) + "/accept", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível aceitar a proposta.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao aceitar proposta."); }
    finally { setBusy(""); }
  };

  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const deadline = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value + "T12:00:00"));

  return <div className="min-h-full bg-[#F8FAFC] text-[#0B2240]">
    <header className="border-b border-[#E5EAF0] bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Link href="/"><span className="font-[Manrope] text-xl font-extrabold">Praça<span className="text-[#10BFA9]">.ai</span></span></Link><div className="flex items-center gap-4"><Link href="/minhas-cotacoes" className="text-sm font-bold text-[#087E8B]">Minhas cotações</Link><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft className="h-4 w-4"/>Início</Link></div></div></header>
    <main className="mx-auto max-w-5xl px-4 py-8 pb-16">
      {loading ? <div className="rounded-2xl border bg-white p-8">Carregando cotação…</div>
      : error && !quote ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p className="font-bold">{error}</p><p className="mt-2 text-sm">Se você ainda não entrou, <Link className="underline" href={"/login?returnTo=" + encodeURIComponent("/cotacao/" + id)}>acesse sua conta</Link>.</p></div>
      : quote ? <>
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#087E8B]">Acompanhar cotação · {quote.protocol}</p>
        <h1 className="mt-2 font-[Manrope] text-3xl font-extrabold">{quote.title}</h1>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600"><span>{quote.category}</span><span><MapPin className="mr-1 inline h-4 w-4"/>{quote.location}</span>{quote.neededAt && <span><Truck className="mr-1 inline h-4 w-4"/>Precisa até {deadline(quote.neededAt)}</span>}<span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-700">{quote.status === "aceita" ? "Proposta aceita" : quote.offers.length ? `${quote.offers.length} propostas recebidas` : "Aguardando propostas"}</span></div>
        <section className="mt-6 rounded-2xl border border-[#DDE5ED] bg-white p-5"><h2 className="flex items-center gap-2 font-extrabold"><Package className="h-5 w-5 text-[#087E8B]"/>Itens solicitados</h2><div className="mt-3 divide-y">{quote.items.map(item=><div key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-semibold">{item.description}{item.brand ? " · " + item.brand : ""}</span><span className="text-slate-600">{item.quantity.toLocaleString("pt-BR")} {item.unit}</span></div>)}</div></section>
        {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {quote.offers.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed bg-white p-8 text-center text-slate-600"><Clock3 className="mx-auto h-8 w-8 text-[#087E8B]"/><p className="mt-3 font-bold text-[#0B2240]">Estamos aguardando os lojistas</p><p className="mt-1 text-sm">Você pode voltar a esta página para comparar as propostas recebidas.</p></div>
        : <section className="mt-7"><div className="mb-4"><h2 className="font-[Manrope] text-2xl font-extrabold">Propostas recebidas</h2><p className="mt-1 text-sm text-slate-600">Compare o total, o prazo e as condições. As lojas ficam anônimas até você aceitar.</p></div><div className="grid gap-4 lg:grid-cols-2">{quote.offers.map((offer,index)=><article key={offer.id} className={"rounded-2xl border bg-white p-5 shadow-sm "+(offer.status==="aceita"?"border-[#10BFA9] ring-2 ring-[#10BFA9]/20":"border-[#DDE5ED]")}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wide text-[#087E8B]">{offer.vendor?.name ?? `Fornecedor ${index+1}`}</p><p className="mt-2 text-3xl font-extrabold">{money(offer.total)}</p></div>{offer.status==="aceita"&&<span className="rounded-full bg-[#DDF9F4] px-3 py-1 text-xs font-extrabold text-[#087E8B]"><Check className="mr-1 inline h-3 w-3"/>Selecionada</span>}</div>
          <div className="mt-3 flex gap-4 text-sm text-slate-600"><span>Produtos: {money(offer.subtotal)}</span><span>Frete: {money(offer.freight)}</span></div>
          <p className="mt-2 text-sm"><Truck className="mr-1 inline h-4 w-4"/>Entrega em {offer.deliveryDays} {offer.deliveryDays===1?"dia":"dias"}</p>
          {offer.items.length>0&&<div className="mt-4 divide-y rounded-xl bg-[#F7F9FC] px-3">{offer.items.map(item=><div key={item.itemId} className="flex justify-between gap-3 py-2 text-xs"><span>{item.description} · {item.quantity} {item.unit}</span><strong>{money(item.unitPrice)}/{item.unit}</strong></div>)}</div>}
          {offer.terms&&<p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{offer.terms}</p>}
          {quote.status!=="aceita"&&<button onClick={()=>void accept(offer.id)} disabled={Boolean(busy)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#10BFA9] px-4 py-3 font-extrabold text-[#0B2240] disabled:opacity-50">{busy===offer.id?"Confirmando…":<><ShieldCheck className="h-4 w-4"/>Aceitar proposta</>}</button>}
          {offer.vendor&&<div className="mt-4 rounded-xl bg-[#F0FCFA] p-3 text-sm"><p className="font-extrabold">{offer.vendor.name}</p><a className="mt-1 inline-block font-bold text-[#087E8B] underline" href={"/listing?vendorId="+encodeURIComponent(offer.vendor.id)}>Ver loja</a></div>}
        </article>)}</div></section>}
        {quote.status==="aceita"&&<div className="mt-6 rounded-2xl border border-[#B9EDE4] bg-[#F0FCFA] p-5 text-sm leading-6 text-[#175C57]"><strong>Próximo passo:</strong> a loja escolhida já foi identificada. Combine pagamento e entrega diretamente com ela; a finalização desta cotação ainda não passa pelo checkout do Praça.ai.</div>}
      </> : null}
    </main>
  </div>;
}
