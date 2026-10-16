import * as React from "react"
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, ClipboardList, MapPin, Package, UserRound } from "lucide-react"
import { Link, useLocation } from "wouter"
import { useAuth } from "@/contexts/AuthContext"

const DRAFT_KEY = "praca-ai-quote-draft"

export default function QuoteRequest() {
  const [, navigate] = useLocation()
  const { user } = useAuth()
  const [saved, setSaved] = React.useState(false)
  const [form, setForm] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<string, string> } catch { return {} }
  })
  const update = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    if (!user) { navigate("/login?returnTo=/cotacao&intent=cotacao"); return }
    setSaved(true)
  }

  return <div className="min-h-full bg-[#f4f7fa] text-[#0b2742]">
    <header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"><Link href="/" className="flex items-center gap-2 font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#ffc400]"><Building2 className="h-5 w-5" /></span>Praça.ai</Link><Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft className="h-4 w-4" />Voltar</Link></div></header>
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[.72fr_1.28fr] lg:py-12">
      <aside className="rounded-3xl bg-[#092943] p-7 text-white lg:sticky lg:top-8 lg:h-fit"><span className="inline-flex rounded-full bg-[#ffc400] px-3 py-1 text-xs font-extrabold text-[#092943]">Aberto para todos</span><h1 className="mt-5 text-3xl font-extrabold leading-tight">Peça uma cotação na sua região.</h1><p className="mt-3 text-sm leading-relaxed text-white/75">Você não precisa ser cliente do AppVendor.ai. Descreva o que precisa e crie sua conta somente para salvar, acompanhar respostas e conversar com fornecedores.</p><ol className="mt-7 space-y-5 text-sm">{[[Package,"Conte o que precisa"],[MapPin,"Informe onde será entregue ou executado"],[UserRound,"Identifique-se para acompanhar"]].map(([Icon,text],index)=><li key={text as string} className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10"><Icon className="h-4 w-4" /></span><span><strong className="mr-2 text-[#ffc400]">{index+1}.</strong>{text as string}</span></li>)}</ol></aside>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(11,39,66,.08)] sm:p-8">
        {saved ? <div className="flex min-h-[440px] flex-col items-center justify-center text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-8 w-8" /></span><h2 className="mt-5 text-2xl font-extrabold">Solicitação preparada</h2><p className="mt-2 max-w-md text-sm text-slate-600">Seu rascunho está salvo. A distribuição automática para fornecedores será habilitada na próxima etapa da central de cotações.</p><Link href="/" className="mt-6 rounded-xl bg-[#ffc400] px-5 py-3 text-sm font-extrabold">Voltar ao início</Link></div> : <form onSubmit={submit} className="space-y-6">
          <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#0870c9]">Nova solicitação</p><h2 className="mt-1 text-2xl font-extrabold">O que você precisa cotar?</h2><p className="mt-1 text-sm text-slate-500">Preencha o essencial agora. Você poderá complementar depois.</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Categoria<select required value={form.category ?? ""} onChange={(event)=>update("category",event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal"><option value="">Selecione</option><option>Produtos e materiais</option><option>Imóveis</option><option>Construção e reforma</option><option>Serviços</option><option>Veículos</option><option>Agro</option><option>Outro</option></select></label><label className="text-sm font-bold">Título da necessidade<input required value={form.title ?? ""} onChange={(event)=>update("title",event.target.value)} placeholder="Ex.: materiais para reforma" className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 font-normal" /></label></div>
          <label className="block text-sm font-bold">Descrição<textarea required value={form.description ?? ""} onChange={(event)=>update("description",event.target.value)} placeholder="Itens, quantidades, medidas ou detalhes importantes" className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold"><MapPin className="mr-1 inline h-4 w-4" />Cidade ou região<input required value={form.location ?? "Chapecó, SC"} onChange={(event)=>update("location",event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 font-normal" /></label><label className="text-sm font-bold"><CalendarDays className="mr-1 inline h-4 w-4" />Quando precisa?<input type="date" value={form.date ?? ""} onChange={(event)=>update("date",event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 font-normal" /></label></div>
          <div className="rounded-2xl bg-[#f4f7fa] p-4 text-sm text-slate-600"><ClipboardList className="mr-2 inline h-4 w-4 text-[#0870c9]" />Seu rascunho fica neste dispositivo. Criar uma conta permite continuar e acompanhar as respostas.</div>
          <button type="submit" className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#ffc400] px-5 py-3.5 font-extrabold shadow-[0_8px_22px_rgba(255,196,0,.28)]">{user ? "Salvar solicitação" : "Continuar e identificar-me"}<ArrowRight className="h-4 w-4" /></button>
        </form>}
      </section>
    </main>
  </div>
}
