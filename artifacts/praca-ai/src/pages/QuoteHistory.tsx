import * as React from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Clock3, MapPin, PackageCheck } from "lucide-react";

type QuoteSummary = { id: string; protocol: string; category: string; title: string; location: string; neededAt?: string | null; status: string; createdAt: string };

export default function QuoteHistory() {
  const [items, setItems] = React.useState<QuoteSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let active=true;
    fetch("/api/quotes",{credentials:"include",cache:"no-store"})
      .then(async response=>{ const body=await response.json(); if(!response.ok) throw new Error(body.error??"Não foi possível carregar as cotações."); return body; })
      .then(body=>{if(active)setItems(body);})
      .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Falha ao carregar cotações.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  const status=(value:string)=>value==="aceita"?"Proposta aceita":value==="distribuida"?"Aguardando propostas":"Aguardando fornecedores";
  const date=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(new Date(value));
  return <div className="min-h-full bg-[#F8FAFC] text-[#0B2240]">
    <header className="border-b border-[#E5EAF0] bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Link href="/" className="font-[Manrope] text-xl font-extrabold">Praça<span className="text-[#10BFA9]">.ai</span></Link><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft className="h-4 w-4"/>Início</Link></div></header>
    <main className="mx-auto max-w-5xl px-4 py-8 pb-16">
      <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#087E8B]">Sua conta</p><h1 className="mt-2 font-[Manrope] text-3xl font-extrabold">Minhas cotações</h1><p className="mt-2 text-sm text-slate-600">Acompanhe propostas e reveja suas solicitações.</p>
      {loading?<div className="mt-6 rounded-2xl border bg-white p-8">Carregando…</div>
      :error?<div role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} · <Link className="underline" href={"/login?returnTo="+encodeURIComponent("/minhas-cotacoes")}>Acesse sua conta</Link></div>
      :items.length===0?<div className="mt-6 rounded-2xl border bg-white p-10 text-center"><PackageCheck className="mx-auto h-8 w-8 text-[#087E8B]"/><h2 className="mt-3 font-bold">Você ainda não pediu uma cotação</h2><Link href="/cotacao" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#10BFA9] px-4 py-3 font-extrabold">Pedir cotação<ArrowRight className="h-4 w-4"/></Link></div>
      :<div className="mt-6 grid gap-3">{items.map(item=><Link key={item.id} href={"/cotacao/"+item.id} className="rounded-2xl border border-[#E5EAF0] bg-white p-5 transition hover:border-[#10BFA9]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wide text-[#087E8B]">{item.category} · {item.protocol}</p><h2 className="mt-2 text-lg font-extrabold">{item.title}</h2><p className="mt-2 text-sm text-slate-600"><MapPin className="mr-1 inline h-4 w-4"/>{item.location}<span className="mx-2">·</span><Clock3 className="mr-1 inline h-4 w-4"/>{date(item.createdAt)}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{status(item.status)}</span></div><span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#087E8B]">Ver propostas<ArrowRight className="h-4 w-4"/></span></Link>)}</div>}
    </main>
  </div>;
}
