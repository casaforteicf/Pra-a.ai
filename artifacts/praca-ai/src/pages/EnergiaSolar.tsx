import { ArrowLeft, ArrowRight, BadgeDollarSign, BarChart3, BatteryCharging, Check, Home, Leaf, LineChart, ShoppingBag, Sun, Zap } from "lucide-react"
import { Link } from "wouter"

const SYSTEM_BENEFITS = ["Projeto dimensionado para o imóvel", "Equipamentos e instalação", "Opções para residências e empresas"]
const FREE_MARKET_BENEFITS = ["Análise do perfil de consumo", "Comparação de propostas de energia", "Acompanhamento da possível economia"]

export default function EnergiaSolarPage() {
  return (
    <div className="min-h-full bg-slate-100 pb-28 text-slate-950 lg:pb-12">
      <header className="bg-[#0B1B2F] px-4 pb-12 pt-5 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" aria-label="Voltar ao início" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
            <Link href="/" className="flex items-center gap-2 font-serif text-xl font-bold"><Sun className="h-6 w-6 text-amber-500" /> Praça.ai Energia</Link>
            <span className="h-10 w-10" aria-hidden="true" />
          </div>
          <div className="mx-auto mt-10 max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-400"><Leaf className="h-4 w-4" /> Energia inteligente</span>
            <h1 className="mt-5 font-serif text-4xl font-extrabold leading-tight sm:text-5xl">Escolha como economizar com energia</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">Encontre sistemas de geração solar ou avalie a migração da sua empresa para o Mercado Livre de Energia.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-7 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_48px_rgba(11,27,47,.10)]">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-[#0B1B2F]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/75"><Sun className="h-8 w-8" /></div>
              <p className="mt-5 text-xs font-black uppercase tracking-[.18em]">Geração própria</p>
              <h2 className="mt-2 font-serif text-3xl font-bold">Comprar sistema solar</h2>
              <p className="mt-2 text-sm font-medium text-slate-800/75">Equipamentos para produzir energia no seu imóvel.</p>
            </div>
            <div className="p-6">
              <ul className="space-y-3">{SYSTEM_BENEFITS.map((benefit) => <li key={benefit} className="flex items-start gap-3 text-sm text-slate-600"><span className="mt-0.5 rounded-full bg-amber-100 p-1 text-amber-700"><Check className="h-3.5 w-3.5" /></span>{benefit}</li>)}</ul>
              <Link href="/listing?search=energia%20solar" className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-[#0B1B2F] px-5 py-3 font-bold text-white transition hover:bg-amber-500 hover:text-[#0B1B2F]"><ShoppingBag className="h-4 w-4" /> Ver sistemas solares <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </article>

          <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_48px_rgba(11,27,47,.10)]">
            <div className="bg-gradient-to-br from-[#12345A] to-[#0B1B2F] p-6 text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-[#0B1B2F]"><LineChart className="h-8 w-8" /></div>
              <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-amber-400">Empresas consumidoras</p>
              <h2 className="mt-2 font-serif text-3xl font-bold">Mercado Livre de Energia</h2>
              <p className="mt-2 text-sm text-white/65">Compare fornecedores e avalie uma contratação mais eficiente.</p>
            </div>
            <div className="p-6">
              <ul className="space-y-3">{FREE_MARKET_BENEFITS.map((benefit) => <li key={benefit} className="flex items-start gap-3 text-sm text-slate-600"><span className="mt-0.5 rounded-full bg-sky-100 p-1 text-sky-700"><Check className="h-3.5 w-3.5" /></span>{benefit}</li>)}</ul>
              <Link href="/servicos" className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 font-bold text-[#0B1B2F] transition hover:bg-amber-600"><BadgeDollarSign className="h-4 w-4" /> Solicitar análise <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </article>
        </div>

        <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[[Zap, "Energia", "Soluções conectadas"], [Home, "Residencial", "Projetos para sua casa"], [BatteryCharging, "Empresarial", "Eficiência para negócios"], [BarChart3, "Economia", "Avaliação personalizada"]].map(([Icon, title, text]) => <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-4"><Icon className="h-6 w-6 text-amber-500" /><p className="mt-3 text-sm font-bold">{title as string}</p><p className="mt-1 text-xs text-slate-500">{text as string}</p></div>)}
        </section>
      </main>
    </div>
  )
}
