import * as React from "react"
import { Clock3, Pause, Play, Sparkles } from "lucide-react"

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
  mediaUrl?: string
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
  const slides = React.useMemo(() => [variety.summary, ...variety.steps].filter(Boolean), [variety])
  const [activeSlide, setActiveSlide] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const isVideo = !!variety.mediaUrl && /\.(mp4|webm|mov)(\?|$)/i.test(variety.mediaUrl)

  React.useEffect(() => {
    setActiveSlide(0)
  }, [variety.title])

  React.useEffect(() => {
    if (paused || slides.length < 2) return
    const timer = window.setTimeout(() => setActiveSlide((current) => (current + 1) % slides.length), 6500)
    return () => window.clearTimeout(timer)
  }, [activeSlide, paused, slides.length])

  const previous = () => setActiveSlide((current) => (current - 1 + slides.length) % slides.length)
  const next = () => setActiveSlide((current) => (current + 1) % slides.length)

  return (
    <section className="mx-auto mt-10 w-[calc(100%-2rem)] max-w-6xl">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-lg font-black"><Sparkles className="h-5 w-5 text-primary" /> Para descobrir hoje</h2>
        <span className="text-xs font-semibold text-muted-foreground">Uma história nova por dia</span>
      </div>
      <div className={`relative isolate min-h-[500px] overflow-hidden rounded-2xl bg-gradient-to-br ${variety.colors} text-white shadow-sm sm:min-h-[440px] lg:min-h-[500px]`}>
        {variety.mediaUrl && (isVideo
          ? <video src={variety.mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
          : <img src={variety.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />)}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/20" />
        {!variety.mediaUrl && <><div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-white/15 blur-2xl" /><div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/15 blur-3xl" /></>}

        <button type="button" aria-label="Voltar história" onClick={previous} className="absolute inset-y-12 left-0 z-10 w-1/3 cursor-w-resize" />
        <button type="button" aria-label="Avançar história" onClick={next} className="absolute inset-y-12 right-0 z-10 w-1/3 cursor-e-resize" />

        <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 p-4 sm:p-5">
          {slides.map((_, index) => <button key={index} type="button" aria-label={`Ir para parte ${index + 1}`} onClick={() => setActiveSlide(index)} className="h-1 flex-1 overflow-hidden rounded-full bg-white/35"><span className={`block h-full bg-white transition-all duration-500 ${index <= activeSlide ? "w-full" : "w-0"}`} /></button>)}
        </div>

        <div className="relative z-20 flex min-h-[500px] flex-col justify-between p-6 pt-12 sm:min-h-[440px] sm:p-9 sm:pt-14 lg:min-h-[500px] lg:p-12 lg:pt-16">
          <div className="flex items-start justify-between gap-4">
            <span className="rounded-full bg-black/25 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] backdrop-blur-sm">{variety.kind}</span>
            <button type="button" aria-label={paused ? "Continuar" : "Pausar"} onClick={() => setPaused((value) => !value)} className="rounded-full bg-black/25 p-2.5 backdrop-blur-sm">{paused ? <Play className="h-4 w-4 fill-white" /> : <Pause className="h-4 w-4 fill-white" />}</button>
          </div>

          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold text-white/80"><Clock3 className="h-4 w-4" /> {variety.time}</div>
            <h3 className="text-3xl font-black leading-[1.05] sm:text-5xl lg:text-6xl">{variety.title}</h3>
            <p key={activeSlide} className="mt-5 max-w-2xl animate-in fade-in slide-in-from-bottom-2 text-lg font-medium leading-relaxed text-white/95 sm:text-xl">{slides[activeSlide]}</p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Toque nas laterais para continuar</p>
          </div>
        </div>
      </div>
    </section>
  )
}
