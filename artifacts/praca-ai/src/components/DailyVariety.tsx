import * as React from "react"
import { ArrowRight, CalendarDays, ChefHat, Clock3, MapPin, Sparkles } from "lucide-react"
import { Link } from "wouter"

export type Variety = {
  kind: string
  title: string
  summary: string
  time: string
  steps: string[]
  actionLabel: string
  actionHref: string
  offerTitle: string
  offerSummary: string
  offerHref: string
  colors: string
}

const VARIETIES: Variety[] = [
  { kind: "Receita do dia", title: "Massa cremosa com sabores da nossa região", summary: "Uma receita simples para reunir a família, feita com ingredientes que você encontra perto de casa.", time: "30 minutos", steps: ["Separe massa, creme, queijo e temperos", "Prepare o molho em fogo baixo", "Finalize com queijo e ervas frescas"], actionLabel: "Encontrar ingredientes", actionHref: "/listing?search=ingredientes", offerTitle: "Ingredientes da receita em oferta", offerSummary: "Encontre os itens apresentados ontem e monte a receita em casa.", offerHref: "/listing?search=ingredientes", colors: "from-amber-600 via-orange-500 to-rose-500" },
  { kind: "Lugar para conhecer", title: "Um fim de tarde especial em Chapecó", summary: "Descubra um roteiro leve para aproveitar a cidade, com parada para café e gastronomia local.", time: "Roteiro de 3 horas", steps: ["Comece por um passeio ao ar livre", "Conheça produtores e lojas locais", "Termine o dia em um restaurante da região"], actionLabel: "Explorar lugares", actionHref: "/restaurantes", offerTitle: "Experiências locais selecionadas", offerSummary: "As sugestões do passeio de ontem agora aparecem reunidas para você.", offerHref: "/restaurantes", colors: "from-emerald-700 via-teal-600 to-sky-500" },
  { kind: "Ideia para o dia a dia", title: "Café da manhã da semana sem complicação", summary: "Organize uma base prática e varie frutas, pães e acompanhamentos durante toda a semana.", time: "15 minutos de preparo", steps: ["Planeje cinco combinações", "Separe porções e recipientes", "Deixe frutas e bebidas prontas para servir"], actionLabel: "Ver itens sugeridos", actionHref: "/listing?search=cafe%20da%20manha", offerTitle: "Seleção para o café da manhã", offerSummary: "Os produtos da dica de ontem estão reunidos no card de ofertas.", offerHref: "/listing?search=cafe%20da%20manha", colors: "from-violet-700 via-fuchsia-600 to-rose-500" },
  { kind: "História local", title: "Feito aqui: criatividade que movimenta a cidade", summary: "Conheça quem transforma ideias em produtos únicos e fortalece o comércio da nossa região.", time: "Leitura de 4 minutos", steps: ["Conheça a história do produtor", "Veja como cada peça é criada", "Descubra a coleção disponível na Praça.ai"], actionLabel: "Conhecer produtores", actionHref: "/listing?category=arte-papelaria-e-armarinho", offerTitle: "Produtos locais em destaque", offerSummary: "A história de ontem virou uma seleção especial de produtos feitos na região.", offerHref: "/listing?category=arte-papelaria-e-armarinho", colors: "from-slate-800 via-indigo-700 to-blue-500" },
]

function brazilDayNumber(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return Math.floor(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)) / 86_400_000) + offset
}

export function getDailyVarieties() {
  const today = brazilDayNumber()
  const at = (day: number) => VARIETIES[((day % VARIETIES.length) + VARIETIES.length) % VARIETIES.length]
  return { today: at(today), yesterday: at(today - 1) }
}

export function DailyVarietyCard({ variety }: { variety: Variety }) {
  const [activeStep, setActiveStep] = React.useState(0)
  return (
    <section className="mx-auto mt-8 w-[calc(100%-2rem)] max-w-6xl overflow-hidden rounded-xl bg-white shadow-sm">
      <div className={`grid bg-gradient-to-br ${variety.colors} text-white lg:grid-cols-[1.15fr_.85fr]`}>
        <div className="flex min-h-[330px] flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/85">
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"><Sparkles className="h-4 w-4" /> Variedades do dia</span>
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Conteúdo novo todos os dias</span>
            </div>
            <p className="mb-2 text-sm font-bold text-white/80">{variety.kind}</p>
            <h2 className="max-w-2xl text-3xl font-black leading-tight sm:text-4xl">{variety.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">{variety.summary}</p>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={variety.actionHref} className="flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm">{variety.actionLabel} <ArrowRight className="h-4 w-4" /></Link>
            <span className="flex items-center gap-2 text-sm font-semibold text-white/90"><Clock3 className="h-4 w-4" /> {variety.time}</span>
          </div>
        </div>
        <div className="border-t border-white/20 bg-black/15 p-6 sm:p-8 lg:border-l lg:border-t-0">
          <div className="mb-5 flex items-center gap-2"><ChefHat className="h-6 w-6" /><h3 className="text-lg font-black">Descubra passo a passo</h3></div>
          <div className="space-y-3">
            {variety.steps.map((step, index) => (
              <button key={step} type="button" onClick={() => setActiveStep(index)} className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition ${activeStep === index ? "border-white bg-white text-slate-900 shadow" : "border-white/25 bg-white/10 text-white hover:bg-white/15"}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${activeStep === index ? "bg-primary text-white" : "bg-white/15"}`}>{index + 1}</span>
                <span className="text-sm font-semibold leading-snug">{step}</span>
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-white/75">Toque em cada etapa para acompanhar. Amanhã, os itens relacionados aparecem no card de Ofertas.</p>
        </div>
      </div>
    </section>
  )
}

export function YesterdayOfferCard({ variety }: { variety: Variety }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-4 overflow-hidden rounded-lg border border-primary/15 bg-primary/5 p-5 sm:flex-row sm:items-center">
      <div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white"><MapPin className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-wider text-primary">Inspirada na variedade de ontem</p><h4 className="mt-1 text-lg font-black">{variety.offerTitle}</h4><p className="mt-1 text-sm text-muted-foreground">{variety.offerSummary}</p></div></div>
      <Link href={variety.offerHref} className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white">Ver oferta <ArrowRight className="h-4 w-4" /></Link>
    </div>
  )
}
