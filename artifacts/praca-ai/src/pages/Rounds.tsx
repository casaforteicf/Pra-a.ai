import * as React from "react"
import { ArrowRight, Building2, ChevronDown, CircleDollarSign, Clock3, Package, Search, ShieldCheck, Store, Users } from "lucide-react"
import { Link } from "wouter"

const SEGMENTS = [
  "Todos os segmentos",
  "Cimento e agregados",
  "Alvenaria",
  "Elétrica e iluminação",
  "Hidráulica e conexões",
  "Cobertura e telhado",
  "Acabamentos",
  "Ferragens e EPI",
  "Agro e indústria",
  "Máquinas e equipamentos",
  "Casa e decoração",
  "Informática e eletrônicos",
  "Alimentos e suprimentos",
]

export default function RoundsPage() {
  const [segment, setSegment] = React.useState(SEGMENTS[0])
  const [filterOpen, setFilterOpen] = React.useState(false)

  return <main className="min-h-full bg-[#F7F9FC] px-4 py-6 pb-24 text-[#0B2240] md:px-8 md:py-10">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#008878]">Praça.ai · compras coletivas</p>
          <h1 className="mt-2 font-[Manrope] text-3xl font-extrabold sm:text-4xl">Rodadas de negócios</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#64748B] sm:text-base">Encontre lotes abertos, escolha uma oportunidade e informe a quantidade de que precisa.</p>
        </div>
        <Link href="/cotacao" className="inline-flex items-center gap-2 rounded-xl bg-[#10D3B8] px-4 py-3 text-sm font-extrabold text-[#0B2240]">Pedir cotação direta <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl bg-[#0B2240] p-5 text-white md:col-span-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-[#8BF1E4]"><Users className="h-4 w-4" /> Participe de uma compra em lote</span>
          <h2 className="mt-4 max-w-xl font-[Manrope] text-2xl font-extrabold">Mais volume reunido. Propostas melhores para comparar.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Cada rodada reúne uma demanda ou uma oferta por produto e região. Você escolhe o lote e informa sua quantidade antes do encerramento.</p>
        </article>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
          <div className="flex items-center gap-3 rounded-2xl border border-[#E5EAF0] bg-white p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-sm font-extrabold">Identidade protegida</h2><p className="text-xs text-[#64748B]">Dados de comprador e vendedor ficam privados durante a rodada.</p></div></div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#E5EAF0] bg-white p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><CircleDollarSign className="h-5 w-5" /></span><div><h2 className="text-sm font-extrabold">Você decide no fechamento</h2><p className="text-xs text-[#64748B]">A proposta final é confirmada antes do pagamento.</p></div></div>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-[#E5EAF0] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-[Manrope] text-xl font-extrabold">Lotes abertos para participar</h2><p className="mt-1 text-sm text-[#64748B]">Selecione um segmento para encontrar uma rodada.</p></div>
          <div className="relative">
            <button type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)} className="inline-flex min-w-52 items-center justify-between gap-3 rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-sm font-bold"><span className="flex items-center gap-2"><Search className="h-4 w-4 text-[#008878]" />{segment}</span><ChevronDown className="h-4 w-4" /></button>
            {filterOpen && <div className="absolute right-0 z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-[#E5EAF0] bg-white p-1 shadow-xl">{SEGMENTS.map((item) => <button key={item} type="button" onClick={() => { setSegment(item); setFilterOpen(false) }} className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm ${segment === item ? "bg-[#E8F2FF] font-bold text-[#0077FF]" : "hover:bg-[#F8FAFC]"}`}>{item}</button>)}</div>}
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-5 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#64748B] shadow-sm"><Package className="h-6 w-6" /></span>
          <h3 className="mt-4 font-[Manrope] text-lg font-extrabold">Nenhum lote aberto{segment !== SEGMENTS[0] ? ` em ${segment.toLowerCase()}` : ""}</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#64748B]">Quando houver uma rodada disponível, ela aparecerá aqui para você escolher o lote e cadastrar a sua demanda.</p>
          <Link href="/cotacao" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#0B2240] bg-white px-4 py-2.5 text-sm font-bold">Solicitar cotação direta <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/listing?category=materiais-de-construcao" className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5EAF0] bg-white p-4 hover:border-[#10D3B8]"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><Building2 className="h-5 w-5" /></span><span><strong className="block text-sm">Comprar no marketplace</strong><span className="text-xs text-[#64748B]">Veja produtos disponíveis agora</span></span></span><ArrowRight className="h-4 w-4 shrink-0" /></Link>
        <Link href="/marketplace" className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5EAF0] bg-white p-4 hover:border-[#10D3B8]"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><Store className="h-5 w-5" /></span><span><strong className="block text-sm">É lojista?</strong><span className="text-xs text-[#64748B]">Acesse os canais para vender no Praça.ai</span></span></span><ArrowRight className="h-4 w-4 shrink-0" /></Link>
      </section>
      <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-[#64748B]"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" /> As rodadas e seus prazos serão exibidos quando houver lotes ativos disponíveis na sua região.</p>
    </div>
  </main>
}
