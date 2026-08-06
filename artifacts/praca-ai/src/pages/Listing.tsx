import * as React from "react"
import { Link, useLocation } from "wouter"
import {
  ArrowRight,
  Armchair,
  Baby,
  BatteryCharging,
  CalendarDays,
  Bath,
  BedDouble,
  Bike,
  Blocks,
  BookOpen,
  BriefcaseBusiness,
  Car,
  ChevronLeft,
  Camera,
  CircleDot,
  GraduationCap,
  Gift,
  Gamepad2,
  Heart,
  HeartPulse,
  Headphones,
  Home,
  Hotel,
  Lightbulb,
  Footprints,
  Glasses,
  Gem,
  Menu,
  MapPin,
  Milk,
  PackageCheck,
  Palette,
  PenLine,
  Plane,
  Radio,
  Scissors,
  Search,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Truck,
  Users,
  Watch,
  Wifi,
  Wrench,
  Puzzle,
  Rocket,
  Bus,
  ArrowLeftRight,
  Clock,
} from "lucide-react"
import { getListProductsQueryKey, useListProducts } from "@workspace/api-client-react"
import type { ListProductsSort } from "@workspace/api-client-react"
import { ProductCard } from "@/components/ProductCard"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const STATIONERY_SLUG = "arte-papelaria-e-armarinho"
const BABY_SLUG = "bebes"
const BEAUTY_SLUG = "beleza-e-cuidado-pessoal"
const TOYS_SLUG = "brinquedos-e-hobbies"
const FASHION_SLUG = "calcados-roupas-e-bolsas"
const PHONES_SLUG = "celulares-e-telefones"
const TRAVEL_SLUG = "viagens-e-hoteis"
const AUTO_ACCESSORIES_SLUG = "acessorios-para-veiculos"

const autoDepartments = [
  { label: "Exterior", icon: Car, search: "friso calha exterior" },
  { label: "Interior", icon: Armchair, search: "tapete capa interior" },
  { label: "Som e multimídia", icon: Radio, search: "som multimídia" },
  { label: "Iluminação", icon: Lightbulb, search: "lâmpada farol led" },
  { label: "Segurança", icon: ShieldCheck, search: "segurança automotiva" },
  { label: "Rodas e pneus", icon: CircleDot, search: "roda pneu" },
  { label: "Manutenção", icon: Wrench, search: "manutenção automotiva" },
  { label: "Limpeza", icon: Sparkles, search: "limpeza automotiva" },
]

const stationeryDepartments = [
  { label: "Escolar", icon: GraduationCap, search: "escolar" },
  { label: "Cadernos", icon: BookOpen, search: "caderno" },
  { label: "Escrita", icon: PenLine, search: "caneta" },
  { label: "Arte", icon: Palette, search: "arte" },
  { label: "Escritório", icon: BriefcaseBusiness, search: "escritório" },
  { label: "Armarinho", icon: Scissors, search: "armarinho" },
]

const babyDepartments = [
  { label: "Passeio", icon: Bike, search: "carrinho" },
  { label: "Móveis", icon: BedDouble, search: "móvel" },
  { label: "Kit berço", icon: Baby, search: "berço" },
  { label: "Roupas", icon: Shirt, search: "roupa bebê" },
  { label: "Alimentação", icon: Milk, search: "alimentação" },
  { label: "Banho e higiene", icon: Bath, search: "higiene" },
  { label: "Saúde", icon: HeartPulse, search: "saúde bebê" },
  { label: "Brinquedos", icon: Sparkles, search: "brinquedo bebê" },
]

const beautyDepartments = [
  { label: "Cabelos", icon: Scissors, search: "cabelo" },
  { label: "Perfumaria", icon: Sparkles, search: "perfume" },
  { label: "Maquiagem", icon: Palette, search: "maquiagem" },
  { label: "Skincare", icon: Heart, search: "skincare" },
  { label: "Cuidados pessoais", icon: Bath, search: "cuidados pessoais" },
  { label: "Bem-estar", icon: HeartPulse, search: "bem-estar" },
]

const toyDepartments = [
  { label: "Primeira infância", icon: Baby, search: "bebê brinquedo" },
  { label: "Bonecas", icon: Heart, search: "boneca" },
  { label: "Carrinhos", icon: Bike, search: "carrinho brinquedo" },
  { label: "Jogos", icon: Gamepad2, search: "jogo" },
  { label: "Montar", icon: Blocks, search: "blocos" },
  { label: "Educativos", icon: GraduationCap, search: "educativo" },
  { label: "Ar livre", icon: Rocket, search: "brinquedo ar livre" },
  { label: "Hobbies", icon: Puzzle, search: "hobby" },
]

const fashionDepartments = [
  { label: "Feminino", icon: Sparkles, search: "moda feminina" },
  { label: "Masculino", icon: Shirt, search: "moda masculina" },
  { label: "Infantil", icon: Baby, search: "moda infantil" },
  { label: "Calçados", icon: Footprints, search: "calçados" },
  { label: "Bolsas", icon: BriefcaseBusiness, search: "bolsa" },
  { label: "Acessórios", icon: Glasses, search: "acessórios" },
  { label: "Joias", icon: Gem, search: "joias" },
  { label: "Relógios", icon: Watch, search: "relógio" },
]

const phoneBrands = ["Apple", "Samsung", "Motorola", "Xiaomi", "Realme", "Multilaser"]

const sortOptions: Array<{ label: string; value: ListProductsSort }> = [
  { label: "Relevância", value: "relevance" },
  { label: "Menor preço", value: "price_asc" },
  { label: "Maior preço", value: "price_desc" },
  { label: "Mais vendidos", value: "best_sellers" },
  { label: "Avaliação", value: "rating" },
  { label: "Ofertas", value: "offers" },
]

export default function ListingPage() {
  const [, setLocation] = useLocation()
  const searchParams = new URLSearchParams(window.location.search)
  const categorySlug = searchParams.get("category") || undefined
  const isStationery = categorySlug === STATIONERY_SLUG
  const isBaby = categorySlug === BABY_SLUG
  const isBeauty = categorySlug === BEAUTY_SLUG
  const isToys = categorySlug === TOYS_SLUG
  const isFashion = categorySlug === FASHION_SLUG
  const isPhones = categorySlug === PHONES_SLUG
  const isTravel = categorySlug === TRAVEL_SLUG
  const isAutoAccessories = categorySlug === AUTO_ACCESSORIES_SLUG
  const [search, setSearch] = React.useState("")
  const [submittedSearch, setSubmittedSearch] = React.useState("")
  const [sort, setSort] = React.useState<ListProductsSort>("relevance")
  const [destination, setDestination] = React.useState("")
  const [viagensHoje, setViagensHoje] = React.useState<any[]>([])
  React.useEffect(() => {
    let active = true
    fetch("/api/variedades-dia/hoje?categoria=viagens")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (active) setViagensHoje(Array.isArray(data) ? data : []) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])
  const [checkIn, setCheckIn] = React.useState("")
  const [checkOut, setCheckOut] = React.useState("")
  const [guests, setGuests] = React.useState("2 hóspedes")
  const [travelMode, setTravelMode] = React.useState<"hospedagem" | "aereo" | "rodoviario">("hospedagem")
  const [origin, setOrigin] = React.useState("")
  const [departureDate, setDepartureDate] = React.useState("")
  const [returnDate, setReturnDate] = React.useState("")
  const [passengers, setPassengers] = React.useState("1 passageiro")

  const requestParams = { category: categorySlug, search: submittedSearch || undefined, sort, limit: 40 }
  const { data: listData, isLoading, isError } = useListProducts(requestParams, {
    query: { queryKey: getListProductsQueryKey(requestParams) },
  })

  const submitSearch = (event?: React.FormEvent) => {
    event?.preventDefault()
    setSubmittedSearch(search.trim())
  }

  const selectDepartment = (departmentSearch: string) => {
    setSearch(departmentSearch)
    setSubmittedSearch(departmentSearch)
  }

  if (isAutoAccessories) {
    return (
      <div className="min-h-full w-full bg-[#f3f4f3] pb-12 text-[#202723]">
        <header className="bg-[#17211c] text-white">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setLocation("/")} className="flex h-10 w-10 items-center justify-center rounded-full bg-card/10" aria-label="Voltar"><ChevronLeft className="h-6 w-6" /></button>
              <Link href="/" className="flex items-center gap-2 text-xl font-black"><Car className="h-7 w-7 text-[#72d98f]" /> Praça.ai <span className="hidden text-sm font-semibold text-white/65 sm:inline">Auto</span></Link>
              <Link href="/cart" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-card/10" aria-label="Carrinho"><ShoppingCart className="h-5 w-5" /></Link>
            </div>
            <form onSubmit={submitSearch} className="relative mt-4">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque acessórios, marca ou modelo" className="h-12 border-0 bg-card pl-12 pr-14 text-base text-slate-950" />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#1f7a45] p-2 text-white" aria-label="Buscar"><Search className="h-4 w-4" /></button>
            </form>
          </div>
          <div className="border-t border-white/10 bg-[#1f7a45]"><div className="mx-auto flex max-w-7xl justify-center gap-5 overflow-x-auto px-4 py-2.5 text-[11px] font-bold sm:gap-10 sm:text-xs"><span className="flex shrink-0 items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Compra segura</span><span className="flex shrink-0 items-center gap-1.5"><PackageCheck className="h-4 w-4" />Compatibilidade verificada</span><span className="flex shrink-0 items-center gap-1.5"><Truck className="h-4 w-4" />Entrega local</span></div></div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#26332c] to-[#101713] p-5 text-white shadow-sm sm:p-8">
            <div className="grid items-center gap-5 md:grid-cols-[1fr_auto]">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#72d98f]">Acessórios para veículos</p><h1 className="mt-2 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">Deixe seu carro do seu jeito</h1><p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">Encontre itens para proteger, equipar e cuidar do veículo nas lojas da sua região.</p><Button onClick={() => document.getElementById("produtos-auto")?.scrollIntoView({ behavior: "smooth" })} className="mt-5 bg-[#72d98f] font-black text-[#132019] hover:bg-[#8be7a4]">Ver acessórios</Button></div>
              <div className="hidden h-36 w-60 items-center justify-center rounded-2xl border border-white/10 bg-card/5 md:flex"><Car className="h-24 w-24 text-[#72d98f]" strokeWidth={1.2} /></div>
            </div>
          </section>

          <section className="mt-5 rounded-2xl bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#1f7a45]">Encontre mais rápido</p><h2 className="mt-1 text-xl font-black">O que você procura?</h2></div><button onClick={() => { setSearch(""); setSubmittedSearch("") }} className="text-xs font-bold text-[#1f7a45]">Ver tudo</button></div>
            <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-8">{autoDepartments.map(({ label, icon: Icon, search: departmentSearch }) => <button key={label} onClick={() => selectDepartment(departmentSearch)} className="group flex min-w-0 flex-col items-center gap-2 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f3ec] text-[#1f7a45] transition group-hover:bg-[#1f7a45] group-hover:text-white sm:h-14 sm:w-14"><Icon className="h-6 w-6" /></span><span className="text-[10px] font-bold leading-tight sm:text-xs">{label}</span></button>)}</div>
          </section>

          <section id="produtos-auto" className="mt-5 rounded-2xl bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#1f7a45]">Vitrine automotiva</p><h2 className="mt-1 text-2xl font-black">Acessórios para seu veículo</h2>{listData && <p className="mt-1 text-sm text-muted-foreground">{listData.total} {listData.total === 1 ? "produto encontrado" : "produtos encontrados"}{submittedSearch ? ` para “${submittedSearch}”` : ""}</p>}</div></div>
            <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">{sortOptions.slice(0, 5).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold", sort === option.value ? "border-[#1f7a45] bg-[#1f7a45] text-white" : "bg-card")}>{option.label}</button>)}</div>
            {isLoading ? <div className="py-14"><PageLoader /></div> : isError ? <EmptyCatalog title="Não foi possível carregar os acessórios" text="Tente novamente em alguns instantes." clear={() => setSubmittedSearch("")} /> : listData && listData.products.length > 0 ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{listData.products.map((product) => <ProductCard key={product.id} product={product} compact />)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-[#bdd8c6] bg-[#f4faf6] px-5 py-10 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-card text-[#1f7a45] shadow-sm"><Car className="h-8 w-8" /></span><h3 className="mt-4 text-lg font-black">{submittedSearch ? "Nenhum acessório encontrado" : "Novos acessórios chegando"}</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{submittedSearch ? "Tente buscar por outro nome, marca ou escolha uma das categorias acima." : "As lojas parceiras ainda estão publicando o catálogo automotivo. Enquanto isso, explore os demais produtos disponíveis na Praça.ai."}</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button onClick={() => { setSearch(""); setSubmittedSearch("") }} className="bg-[#1f7a45] hover:bg-[#19663a]">Limpar busca</Button><Button variant="outline" onClick={() => setLocation("/listing")}>Explorar a Praça.ai</Button></div></div>}
          </section>
        </main>
      </div>
    )
  }

  if (!isStationery && !isBaby && !isBeauty && !isToys && !isFashion && !isPhones && !isTravel) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col bg-background pb-8">
        <header className="sticky inset-x-0 top-0 z-30 border-b bg-background/95 px-4 pb-3 pt-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3"><button onClick={() => setLocation("/")} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><ChevronLeft className="h-6 w-6" /></button><div className="flex-1"><h1 className="text-xl font-black capitalize">{categorySlug ? categorySlug.replaceAll("-", " ") : "Explorar"}</h1>{listData && <p className="text-xs font-bold text-muted-foreground">{listData.total} resultados</p>}</div></div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{sortOptions.map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-bold", sort === option.value ? "border-primary bg-primary text-white" : "bg-card")}>{option.label}</button>)}</div>
        </header>
        {isLoading && <PageLoader />}
        {listData && <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">{listData.products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      </div>
    )
  }

  if (isTravel) {
    const travelResults = [
      { city: "Florianópolis, SC", name: "Hotel Beira-Mar", type: "Hotel", rating: "9,1", price: "R$ 389", color: "from-cyan-500 to-blue-700" },
      { city: "Gramado, RS", name: "Pousada Serra Gaúcha", type: "Pousada", rating: "9,4", price: "R$ 462", color: "from-emerald-500 to-green-800" },
      { city: "Balneário Camboriú, SC", name: "Apartamento Vista Mar", type: "Apartamento", rating: "8,9", price: "R$ 315", color: "from-sky-400 to-indigo-700" },
      { city: "Foz do Iguaçu, PR", name: "Resort das Cataratas", type: "Resort", rating: "9,2", price: "R$ 580", color: "from-amber-400 to-orange-700" },
    ]
    const flightResults = [
      { company: "Azul", route: "Chapecó → Guarulhos", duration: "1h 45min", stops: "Voo direto", price: "R$ 412", color: "from-blue-500 to-blue-800" },
      { company: "Gol", route: "Chapecó → Congonhas", duration: "2h 10min", stops: "1 conexão", price: "R$ 358", color: "from-orange-500 to-red-700" },
      { company: "Latam", route: "Chapecó → Brasília", duration: "2h 30min", stops: "1 conexão", price: "R$ 499", color: "from-rose-500 to-pink-800" },
      { company: "Azul", route: "Chapecó → Florianópolis", duration: "55min", stops: "Voo direto", price: "R$ 289", color: "from-indigo-500 to-blue-900" },
    ]
    const busResults = [
      { company: "Catarinense", route: "Chapecó → Florianópolis", duration: "6h 30min", stops: "Leito", price: "R$ 149", color: "from-teal-500 to-emerald-800" },
      { company: "Reunidas", route: "Chapecó → Curitiba", duration: "8h 00min", stops: "Semi-leito", price: "R$ 179", color: "from-lime-500 to-green-800" },
      { company: "Eucatur", route: "Chapecó → Porto Alegre", duration: "9h 15min", stops: "Leito", price: "R$ 199", color: "from-cyan-500 to-teal-800" },
      { company: "Catarinense", route: "Chapecó → Curitiba", duration: "7h 45min", stops: "Convencional", price: "R$ 119", color: "from-sky-500 to-blue-800" },
    ]

    const visibleTrips = destination
      ? travelResults.filter((item) => `${item.city} ${item.name}`.toLowerCase().includes(destination.toLowerCase()))
      : travelResults
    const visibleFlights = origin || destination
      ? flightResults.filter((item) => item.route.toLowerCase().includes(origin.toLowerCase()) && item.route.toLowerCase().includes(destination.toLowerCase()))
      : flightResults
    const visibleBuses = origin || destination
      ? busResults.filter((item) => item.route.toLowerCase().includes(origin.toLowerCase()) && item.route.toLowerCase().includes(destination.toLowerCase()))
      : busResults

    const TABS: { key: typeof travelMode; label: string; icon: typeof Hotel }[] = [
      { key: "hospedagem", label: "Hospedagem", icon: Hotel },
      { key: "aereo", label: "Passagens Aéreas", icon: Plane },
      { key: "rodoviario", label: "Passagens Rodoviárias", icon: Bus },
    ]

    return (
      <div className="min-h-full w-full bg-[#f4f6f8] pb-12 text-[#183b63]">
        <header className="bg-[#075aaa] text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 text-2xl font-black">
              <Plane className="h-7 w-7" /> Praça.ai <span className="text-sm font-semibold text-white/75">Viagens</span>
            </Link>
            <div className="flex items-center gap-4 text-sm font-bold">
              <button>Cadastre sua hospedagem</button>
              <Link href="/profile" className="rounded-md border border-white px-4 py-2">Entrar</Link>
            </div>
          </div>
        </header>

        <main>
          <section className="bg-[#075aaa] pb-20 text-white">
            <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
              <h1 className="text-4xl font-black sm:text-5xl">
                {travelMode === "hospedagem" ? "Encontre sua próxima estadia" : travelMode === "aereo" ? "Encontre sua próxima passagem aérea" : "Encontre sua próxima passagem rodoviária"}
              </h1>
              <p className="mt-2 text-lg text-white/85">
                {travelMode === "hospedagem" ? "Busque hotéis, pousadas, resorts e apartamentos para sua viagem." : travelMode === "aereo" ? "Compare voos de várias companhias pra sua próxima viagem." : "Compare passagens de ônibus de várias viações."}
              </p>

              {/* Abas de modo */}
              <div className="mt-6 flex gap-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTravelMode(tab.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition",
                      travelMode === tab.key ? "bg-card text-[#075aaa]" : "bg-card/15 text-white hover:bg-card/25",
                    )}
                  >
                    <tab.icon className="h-4 w-4" /> {tab.label}
                  </button>
                ))}
              </div>

              {travelMode === "hospedagem" && (
                <form
                  onSubmit={(event) => { event.preventDefault(); document.getElementById("resultados-viagem")?.scrollIntoView({ behavior: "smooth" }) }}
                  className="mt-4 grid gap-1 rounded-xl bg-[#f6b900] p-1.5 text-slate-900 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"
                >
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <MapPin className="h-5 w-5 shrink-0" />
                    <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Para onde você vai?" className="min-w-0 flex-1 bg-transparent outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <CalendarDays className="h-5 w-5 shrink-0" />
                    <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <CalendarDays className="h-5 w-5 shrink-0" />
                    <input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <Users className="h-5 w-5 shrink-0" />
                    <select value={guests} onChange={(event) => setGuests(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none">
                      <option>1 hóspede</option><option>2 hóspedes</option><option>3 hóspedes</option><option>4 hóspedes</option><option>Família</option>
                    </select>
                  </label>
                  <Button type="submit" className="h-full bg-[#073b75] px-8 text-white hover:bg-[#052d59]">Pesquisar</Button>
                </form>
              )}

              {travelMode === "aereo" && (
                <form
                  onSubmit={(event) => { event.preventDefault(); document.getElementById("resultados-viagem")?.scrollIntoView({ behavior: "smooth" }) }}
                  className="mt-4 grid gap-1 rounded-xl bg-[#f6b900] p-1.5 text-slate-900 lg:grid-cols-[1fr_auto_1fr_1fr_1fr_1fr_auto]"
                >
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <Plane className="h-5 w-5 shrink-0 -rotate-45" />
                    <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="De onde você sai?" className="min-w-0 flex-1 bg-transparent outline-none" />
                  </label>
                  <button
                    type="button"
                    onClick={() => { const o = origin; setOrigin(destination); setDestination(o) }}
                    className="hidden items-center justify-center rounded-lg bg-card px-2 text-[#075aaa] lg:flex"
                    aria-label="Trocar origem e destino"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <MapPin className="h-5 w-5 shrink-0" />
                    <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Pra onde você vai?" className="min-w-0 flex-1 bg-transparent outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <CalendarDays className="h-5 w-5 shrink-0" />
                    <input type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <CalendarDays className="h-5 w-5 shrink-0" />
                    <input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} placeholder="Volta (opcional)" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <Users className="h-5 w-5 shrink-0" />
                    <select value={passengers} onChange={(event) => setPassengers(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none">
                      <option>1 passageiro</option><option>2 passageiros</option><option>3 passageiros</option><option>4 passageiros</option>
                    </select>
                  </label>
                  <Button type="submit" className="h-full bg-[#073b75] px-8 text-white hover:bg-[#052d59]">Buscar voos</Button>
                </form>
              )}

              {travelMode === "rodoviario" && (
                <form
                  onSubmit={(event) => { event.preventDefault(); document.getElementById("resultados-viagem")?.scrollIntoView({ behavior: "smooth" }) }}
                  className="mt-4 grid gap-1 rounded-xl bg-[#f6b900] p-1.5 text-slate-900 lg:grid-cols-[1fr_auto_1fr_1fr_1fr_auto]"
                >
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <Bus className="h-5 w-5 shrink-0" />
                    <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="De onde você sai?" className="min-w-0 flex-1 bg-transparent outline-none" />
                  </label>
                  <button
                    type="button"
                    onClick={() => { const o = origin; setOrigin(destination); setDestination(o) }}
                    className="hidden items-center justify-center rounded-lg bg-card px-2 text-[#075aaa] lg:flex"
                    aria-label="Trocar origem e destino"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <MapPin className="h-5 w-5 shrink-0" />
                    <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Pra onde você vai?" className="min-w-0 flex-1 bg-transparent outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <CalendarDays className="h-5 w-5 shrink-0" />
                    <input type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
                    <Users className="h-5 w-5 shrink-0" />
                    <select value={passengers} onChange={(event) => setPassengers(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none">
                      <option>1 passageiro</option><option>2 passageiros</option><option>3 passageiros</option><option>4 passageiros</option>
                    </select>
                  </label>
                  <Button type="submit" className="h-full bg-[#073b75] px-8 text-white hover:bg-[#052d59]">Buscar ônibus</Button>
                </form>
              )}
            </div>
          </section>

          {viagensHoje.length > 0 && (
            <section className="mx-auto -mt-6 max-w-6xl px-4 sm:px-6 lg:px-8">
              {viagensHoje.map((item) => (
                <div key={item.id} className="rounded-xl bg-card p-5 shadow-lg">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#075aaa]/10 px-3 py-1 text-xs font-bold text-[#075aaa]">
                    Publicado hoje por {item.tenantName}
                  </span>
                  <h3 className="mt-2 text-xl font-black text-slate-900">{item.titulo}</h3>
                  {item.conteudoTexto && <p className="mt-1 text-sm text-slate-600">{item.conteudoTexto}</p>}
                  {item.videoUrl && <video src={item.videoUrl} className="mt-3 w-full max-w-md rounded-lg" controls />}
                  {item.promocaoTipo && (
                    <p className="mt-3 text-sm font-bold text-emerald-700">
                      {item.promocaoTipo === "produto"
                        ? `Promoção: ${item.promocaoProdutoNome ?? "produto"} com ${item.promocaoDescontoPercentual}% off`
                        : `Promoção: ${item.promocaoTexto}`}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}

          {travelMode === "hospedagem" && (
            <section className="mx-auto -mt-10 max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="rounded-xl bg-card p-5 shadow-lg">
                <h2 className="text-xl font-black">Explore por tipo de hospedagem</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[[Hotel, "Hotéis"], [Home, "Casas e apartamentos"], [Store, "Pousadas"], [Sparkles, "Resorts"]].map(([Icon, label]) => {
                    const TravelIcon = Icon as typeof Hotel
                    return (
                      <button key={label as string} onClick={() => setDestination("")} className="flex items-center gap-3 rounded-lg border p-4 text-left font-bold transition hover:border-[#075aaa] hover:bg-blue-50">
                        <TravelIcon className="h-6 w-6 text-[#075aaa]" />{label as string}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {travelMode === "hospedagem" && (
            <section id="resultados-viagem" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#075aaa]">Hospedagens parceiras</p>
                  <h2 className="mt-1 text-3xl font-black">Ofertas para sua próxima viagem</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{visibleTrips.length} opções encontradas{destination ? ` para "${destination}"` : ""}</p>
                </div>
                <select className="rounded-lg border bg-card px-4 py-2 text-sm font-bold">
                  <option>Mais recomendados</option><option>Menor preço</option><option>Melhor avaliação</option>
                </select>
              </div>
              {visibleTrips.length > 0 ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {visibleTrips.map((item) => (
                    <article key={item.name} className="overflow-hidden rounded-xl bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                      <div className={cn("flex h-44 items-center justify-center bg-gradient-to-br", item.color)}><Hotel className="h-20 w-20 text-white/85" strokeWidth={1.2} /></div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div><p className="text-xs font-bold text-[#075aaa]">{item.type}</p><h3 className="mt-1 font-black text-slate-900">{item.name}</h3></div>
                          <span className="rounded-md bg-[#075aaa] px-2 py-1 text-xs font-black text-white">{item.rating}</span>
                        </div>
                        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{item.city}</p>
                        <div className="mt-4 border-t pt-4 text-right">
                          <p className="text-xs text-slate-500">1 diária para {guests}</p>
                          <p className="text-xl font-black text-slate-900">{item.price}</p>
                          <Button className="mt-3 w-full bg-[#075aaa] hover:bg-[#064c90]">Ver disponibilidade</Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed bg-card p-12 text-center">
                  <MapPin className="mx-auto h-10 w-10 text-[#075aaa]" />
                  <h3 className="mt-3 text-lg font-black">Nenhuma hospedagem encontrada</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Tente buscar outro destino.</p>
                  <Button variant="outline" onClick={() => setDestination("")} className="mt-4">Ver todos os destinos</Button>
                </div>
              )}
            </section>
          )}

          {(travelMode === "aereo" || travelMode === "rodoviario") && (
            <section id="resultados-viagem" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#075aaa]">{travelMode === "aereo" ? "Voos disponíveis" : "Ônibus disponíveis"}</p>
                  <h2 className="mt-1 text-3xl font-black">{travelMode === "aereo" ? "Passagens aéreas" : "Passagens rodoviárias"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {(travelMode === "aereo" ? visibleFlights.length : visibleBuses.length)} opções encontradas
                    {origin || destination ? ` para "${origin || "?"} → ${destination || "?"}"` : ""}
                  </p>
                </div>
                <select className="rounded-lg border bg-card px-4 py-2 text-sm font-bold">
                  <option>Mais recomendados</option><option>Menor preço</option><option>Mais rápido</option>
                </select>
              </div>

              {(travelMode === "aereo" ? visibleFlights : visibleBuses).length > 0 ? (
                <div className="mt-6 flex flex-col gap-4">
                  {(travelMode === "aereo" ? visibleFlights : visibleBuses).map((item) => (
                    <article key={`${item.company}-${item.route}`} className="flex flex-col items-stretch gap-4 rounded-xl bg-card p-4 shadow-sm transition hover:shadow-lg sm:flex-row sm:items-center">
                      <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white", item.color)}>
                        {travelMode === "aereo" ? <Plane className="h-8 w-8" /> : <Bus className="h-8 w-8" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-[#075aaa]">{item.company}</p>
                        <h3 className="mt-0.5 font-black text-slate-900">{item.route}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{item.duration}</span>
                          <span>{item.stops}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">a partir de</p>
                        <p className="text-xl font-black text-slate-900">{item.price}</p>
                        <Button className="mt-2 bg-[#075aaa] hover:bg-[#064c90]">{travelMode === "aereo" ? "Ver assentos" : "Ver poltronas"}</Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed bg-card p-12 text-center">
                  {travelMode === "aereo" ? <Plane className="mx-auto h-10 w-10 text-[#075aaa]" /> : <Bus className="mx-auto h-10 w-10 text-[#075aaa]" />}
                  <h3 className="mt-3 text-lg font-black">Nenhuma {travelMode === "aereo" ? "passagem aérea" : "passagem rodoviária"} encontrada</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Tente buscar outra origem ou destino.</p>
                  <Button variant="outline" onClick={() => { setOrigin(""); setDestination("") }} className="mt-4">Ver todas as opções</Button>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    )
  }

  if (isPhones) {
    return (
      <div className="min-h-full w-full bg-[#f5f7fa] pb-12 text-[#173f72]">
        <header className="bg-[#174b87] text-white">
          <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-5 sm:px-6 lg:gap-8 lg:px-8">
            <Link href="/" className="flex items-center gap-2 text-xl font-black"><Smartphone className="h-8 w-8 text-[#ffd128]" /> Praça.ai <span className="hidden text-sm font-semibold text-white/70 sm:inline">Celulares</span></Link>
            <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque celulares, marcas e acessórios" className="h-12 border-0 bg-card pl-12 pr-12 text-slate-950" /><button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#ffd128] p-2 text-[#174b87]"><Search className="h-4 w-4" /></button></form>
            <div className="flex items-center gap-3 justify-self-end"><Heart className="hidden h-5 w-5 sm:block" /><Link href="/profile" className="hidden text-sm font-bold sm:block">Minha conta</Link><ShoppingCart className="h-6 w-6" /></div>
          </div>
          <nav className="bg-card text-[#174b87]"><div className="mx-auto flex max-w-6xl items-center justify-between gap-8 overflow-x-auto px-4 py-4 text-sm font-black sm:px-6 lg:px-8">{phoneBrands.map((brand) => <button key={brand} onClick={() => selectDepartment(brand)} className="shrink-0 hover:text-[#e0a800]">{brand}</button>)}</div></nav>
        </header>

        <main>
          <section className="bg-gradient-to-r from-[#dcebf8] to-[#eef6fb]"><div className="mx-auto grid min-h-[320px] max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1fr_0.75fr] lg:px-8"><div><span className="rounded-full bg-[#ffd128] px-3 py-1.5 text-xs font-black uppercase text-[#174b87]">Tecnologia perto de você</span><h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight sm:text-6xl">Celulares e smartphones</h1><p className="mt-3 max-w-xl text-[#365f8d]">Encontre aparelhos, acessórios e ofertas das lojas da sua região, com compra segura e entrega local.</p><Button onClick={() => document.getElementById("produtos-celulares")?.scrollIntoView({ behavior: "smooth" })} className="mt-6 bg-[#174b87] hover:bg-[#123c6d]">Ver aparelhos</Button></div><div className="relative hidden min-h-64 lg:block"><div className="absolute left-1/2 top-1/2 flex h-64 w-44 -translate-x-1/2 -translate-y-1/2 rotate-6 items-center justify-center rounded-[2.25rem] border-[10px] border-[#173f72] bg-gradient-to-br from-[#43b5c8] to-[#735eea] shadow-2xl"><Smartphone className="h-24 w-24 -rotate-6 text-white" strokeWidth={1.2} /></div><Wifi className="absolute right-12 top-7 h-12 w-12 text-[#e0a800]" /></div></div></section>

          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><PhoneBenefit icon={Truck} title="Pronta entrega" text="Receba com rapidez" /><PhoneBenefit icon={ShieldCheck} title="Compra segura" text="Pagamento protegido" /><PhoneBenefit icon={BatteryCharging} title="Novos e seminovos" text="Escolha o ideal" /><PhoneBenefit icon={Headphones} title="Acessórios" text="Complete seu aparelho" /></div></section>

          <section id="produtos-celulares" className="mx-auto grid max-w-6xl gap-5 px-4 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
            <aside className="h-fit rounded-xl border bg-card p-5 shadow-sm"><h2 className="text-lg font-black">Filtros rápidos</h2><PhoneFilter title="Marca" values={["Apple","Samsung","Motorola","Xiaomi"]} select={selectDepartment} /><PhoneFilter title="Memória" values={["64 GB","128 GB","256 GB","512 GB"]} select={selectDepartment} /><PhoneFilter title="Condição" values={["Novo","Seminovo"]} select={selectDepartment} /><button onClick={() => { setSearch(""); setSubmittedSearch("") }} className="mt-5 w-full rounded-md border py-2 text-sm font-bold">Limpar filtros</button></aside>
            <div className="rounded-xl bg-card p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#e0a800]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Celulares e smartphones</h2>{listData && <p className="mt-1 text-sm text-muted-foreground">{listData.total} produtos encontrados{submittedSearch ? ` para “${submittedSearch}”` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold",sort===option.value?"border-[#174b87] bg-[#174b87] text-white":"bg-card")}>{option.label}</button>)}</div></div>{isLoading?<div className="py-16"><PageLoader /></div>:isError?<EmptyCatalog title="Não foi possível carregar os celulares" text="Tente novamente em alguns instantes." clear={()=>setSubmittedSearch("")} />:listData&&listData.products.length>0?<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{listData.products.map((product)=><ProductCard key={product.id} product={product} />)}</div>:<EmptyCatalog title={submittedSearch?"Nenhum aparelho encontrado":"A loja de celulares está recebendo produtos"} text={submittedSearch?"Tente outra marca, memória ou modelo.":"As lojas parceiras ainda estão publicando seus aparelhos. Volte em breve para conferir as novidades."} clear={()=>{setSearch("");setSubmittedSearch("")}} />}</div>
          </section>
        </main>
      </div>
    )
  }

  if (isFashion) {
    return (
      <div className="min-h-full w-full bg-[#f5f5f5] pb-12 text-[#161616]">
        <div className="bg-black py-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-white">10% de desconto na primeira compra com o cupom <strong>PRIMEIRAPRAÇA</strong></div>
        <header className="bg-card">
          <div className="bg-background text-foreground">
            <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6 lg:gap-8 lg:px-8">
              <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-[0.18em]"><span className="flex h-9 w-9 items-center justify-center bg-primary text-2xl text-primary-foreground">P</span> PRAÇA</Link>
              <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que você procura hoje?" className="h-12 rounded-none border-0 bg-card pl-12 pr-12 text-foreground" /><button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-foreground"><ArrowRight className="h-5 w-5" /></button></form>
              <div className="flex items-center gap-3 justify-self-end"><Link href="/profile" className="hidden text-sm font-bold sm:block">Entrar</Link><Heart className="hidden h-5 w-5 sm:block" /><span className="rounded-full border border-white/30 p-2"><ShoppingCart className="h-5 w-5" /></span></div>
            </div>
          </div>
          <nav className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center justify-start gap-8 overflow-x-auto px-4 py-3 text-sm font-semibold sm:px-6 lg:px-8">{fashionDepartments.slice(0, 6).map((item) => <button key={item.label} onClick={() => selectDepartment(item.search)} className="shrink-0 hover:text-[#8d214a]">{item.label}</button>)}<button onClick={() => setSort("offers")} className="shrink-0 font-black text-[#8d214a]">Ofertas</button></div></nav>
        </header>

        <main>
          <section className="relative overflow-hidden bg-[#e9d8d3]">
            <div className="absolute -right-12 top-0 h-full w-1/3 bg-[#8d214a]/10" /><div className="absolute right-[12%] top-1/2 h-80 w-56 -translate-y-1/2 rotate-6 rounded-full bg-[#8d214a]/80 blur-[1px]" />
            <div className="relative mx-auto grid min-h-[420px] max-w-6xl items-center gap-8 px-6 py-12 lg:grid-cols-[1fr_0.85fr] lg:px-8">
              <div><span className="text-sm font-bold uppercase tracking-[0.28em] text-[#8d214a]">Moda para todos os estilos</span><h1 className="mt-4 max-w-2xl text-5xl font-black leading-[0.95] sm:text-7xl">Vista o que combina com você</h1><p className="mt-5 max-w-xl text-base text-black/65 sm:text-lg">Roupas, calçados, bolsas e acessórios das melhores lojas da sua região.</p><Button onClick={() => document.getElementById("produtos-moda")?.scrollIntoView({ behavior: "smooth" })} className="mt-7 rounded-none bg-black px-8 text-white hover:bg-[#8d214a]">Comprar agora</Button></div>
              <div className="relative hidden min-h-72 lg:block"><div className="absolute left-1/2 top-1/2 flex h-72 w-72 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[28px] border-white/50"><Shirt className="h-40 w-40 text-white" strokeWidth={1} /></div><Sparkles className="absolute right-7 top-5 h-14 w-14 text-white" /></div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#8d214a]">Encontre seu estilo</p><h2 className="mt-1 text-2xl font-black">Compre por departamento</h2></div></div><div className="grid grid-cols-4 gap-3 lg:grid-cols-8">{fashionDepartments.map(({ label, icon: Icon, search: term }, index) => <button key={label} onClick={() => selectDepartment(term)} className="group flex flex-col items-center bg-card p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className={cn("flex h-14 w-14 items-center justify-center rounded-full", index % 2 === 0 ? "bg-[#f2e3e7] text-[#8d214a]" : "bg-[#eee9e2] text-[#4e4038]")}><Icon className="h-7 w-7" /></span><span className="mt-2 text-[11px] font-black leading-tight">{label}</span></button>)}</div></section>

          <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Até R$ 49","49"],["Até R$ 99","99"],["Até R$ 149","149"],["Ofertas especiais","oferta"]].map(([label,term], index) => <button key={label} onClick={() => index === 3 ? setSort("offers") : selectDepartment(term)} className="border-2 border-primary bg-primary px-4 py-4 text-center text-sm font-black uppercase text-primary-foreground shadow-neon-sm transition hover:opacity-90">{label}</button>)}</div></section>

          <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8"><div className="grid gap-3 sm:grid-cols-3"><FashionPromo title="Moda feminina" text="Novidades para todos os momentos" search="moda feminina" select={selectDepartment} color="bg-[#d9c0b7]" /><FashionPromo title="Moda masculina" text="Essenciais que combinam com você" search="moda masculina" select={selectDepartment} color="bg-[#c8ced0]" /><FashionPromo title="Calçados e acessórios" text="Complete seu visual" search="calçados acessórios" select={selectDepartment} color="bg-[#d8cfbf]" /></div></section>

          <section id="produtos-moda" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="bg-card p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#8d214a]">Vitrine local</p><h2 className="mt-1 text-2xl font-black">Roupas, calçados e acessórios</h2>{listData && <p className="mt-1 text-sm text-muted-foreground">{listData.total} produtos encontrados{submittedSearch ? ` para “${submittedSearch}”` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold",sort===option.value?"border-primary bg-primary text-primary-foreground shadow-neon-sm":"bg-card")}>{option.label}</button>)}</div></div>{isLoading?<div className="py-16"><PageLoader /></div>:isError?<EmptyCatalog title="Não foi possível carregar os produtos" text="Tente novamente em alguns instantes." clear={()=>setSubmittedSearch("")} />:listData&&listData.products.length>0?<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{listData.products.map((product)=><ProductCard key={product.id} product={product} />)}</div>:<EmptyCatalog title={submittedSearch?"Nenhum produto encontrado":"A vitrine de moda está recebendo produtos"} text={submittedSearch?"Tente outra busca ou confira o catálogo completo.":"As lojas parceiras ainda estão publicando seus itens. Volte em breve para conferir as novidades."} clear={()=>{setSearch("");setSubmittedSearch("")}} />}</div></section>
        </main>
      </div>
    )
  }

  if (isToys) {
    return (
      <div className="min-h-full w-full bg-[#f8f5f5] pb-12 text-[#251745]">
        <header className="bg-[#ffe915] text-[#251745]">
          <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6 lg:gap-8 lg:px-8">
            <Link href="/" className="flex items-center gap-2 text-xl font-black"><Gift className="h-8 w-8 text-[#e43286]" /> Praça.ai <span className="hidden text-sm text-[#604f1c] sm:inline">Brinquedos</span></Link>
            <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Encontre aqui um mundo de diversão..." className="h-12 rounded-full border-0 bg-card pl-12 pr-12 text-[#251745]" /><button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#6a31a8] p-2 text-white"><ArrowRight className="h-4 w-4" /></button></form>
            <div className="flex items-center gap-3 justify-self-end"><Link href="/profile" className="hidden text-sm font-bold sm:block">Acesse sua conta</Link><span className="rounded-full bg-black/10 p-2.5"><ShoppingCart className="h-5 w-5" /></span></div>
          </div>
          <nav className="border-t border-black/10"><div className="mx-auto flex max-w-6xl items-center gap-7 overflow-x-auto px-4 py-3 text-xs font-black sm:px-6 lg:px-8"><span className="flex shrink-0 items-center gap-2"><Menu className="h-4 w-4" /> Departamentos</span><button onClick={() => setSubmittedSearch("")} className="shrink-0">Novidades</button><button onClick={() => setSort("offers")} className="shrink-0 text-[#a60070]">Ofertas</button>{toyDepartments.slice(0, 5).map((item) => <button key={item.label} onClick={() => selectDepartment(item.search)} className="shrink-0">{item.label}</button>)}</div></nav>
        </header>

        <main>
          <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5a2a91] via-[#7337aa] to-[#8d40ba] p-7 text-white sm:p-10 lg:min-h-[390px]">
              <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#19bfe8]/60" /><div className="absolute -bottom-28 right-1/4 h-64 w-64 rounded-full bg-[#ffdf18]/40" />
              <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_0.8fr]"><div><span className="inline-flex items-center gap-2 rounded-full bg-[#21c1e6] px-3 py-1.5 text-xs font-black text-[#251745]">Diversão para todas as idades</span><h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] sm:text-6xl">Um mundo de brincadeiras</h1><p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">Brinquedos, jogos e hobbies das lojas da sua região para aprender, imaginar e se divertir.</p><Button onClick={() => document.getElementById("produtos-brinquedos")?.scrollIntoView({ behavior: "smooth" })} className="mt-7 bg-[#ffe915] text-[#251745] hover:bg-[#f5dc00]">Ver brinquedos</Button></div><div className="relative hidden min-h-64 lg:block"><div className="absolute left-1/2 top-1/2 flex h-60 w-60 -translate-x-1/2 -translate-y-1/2 rotate-6 items-center justify-center rounded-[35%_65%_55%_45%] bg-[#ef3c8f] shadow-2xl"><Rocket className="h-32 w-32 -rotate-6 text-white" strokeWidth={1.2} /></div><Blocks className="absolute bottom-3 left-3 h-16 w-16 text-[#ffe915]" /></div></div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#6a31a8]">Escolha a diversão</p><h2 className="mt-1 text-2xl font-black">Todos os departamentos</h2></div></div><div className="grid grid-cols-4 gap-3 lg:grid-cols-8">{toyDepartments.map(({ label, icon: Icon, search: term }, index) => <button key={label} onClick={() => selectDepartment(term)} className="group flex flex-col items-center rounded-2xl bg-card p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className={cn("flex h-14 w-14 items-center justify-center rounded-full", index % 4 === 0 ? "bg-yellow-100 text-yellow-700" : index % 4 === 1 ? "bg-pink-100 text-pink-600" : index % 4 === 2 ? "bg-cyan-100 text-cyan-700" : "bg-violet-100 text-violet-700")}><Icon className="h-7 w-7" /></span><span className="mt-2 text-[11px] font-black leading-tight">{label}</span></button>)}</div></section>

          <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8"><div className="mb-5 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#e43286]">Presente por idade</p><h2 className="mt-1 text-2xl font-black">A escolha certa para cada fase</h2></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["0 a 2 anos","bebê brinquedo","bg-[#c7f0f7]"],["3 a 5 anos","brinquedo infantil","bg-[#ffe4ef]"],["6 a 8 anos","jogo educativo","bg-[#fff4a8]"],["9 anos ou mais","hobby jogo","bg-[#e8dafa]"]].map(([label,term,color]) => <button key={label} onClick={() => selectDepartment(term)} className={cn("rounded-2xl p-5 text-center font-black transition hover:-translate-y-1",color)}><Gift className="mx-auto mb-2 h-7 w-7" />{label}</button>)}</div></section>

          <section id="produtos-brinquedos" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#6a31a8]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Brinquedos e hobbies</h2>{listData && <p className="mt-1 text-sm text-muted-foreground">{listData.total} produtos encontrados{submittedSearch ? ` para “${submittedSearch}”` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold",sort===option.value?"border-[#6a31a8] bg-[#6a31a8] text-white":"bg-card")}>{option.label}</button>)}</div></div>{isLoading?<div className="py-16"><PageLoader /></div>:isError?<EmptyCatalog title="Não foi possível carregar os brinquedos" text="Tente novamente em alguns instantes." clear={()=>setSubmittedSearch("")} />:listData&&listData.products.length>0?<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{listData.products.map((product)=><ProductCard key={product.id} product={product} />)}</div>:<EmptyCatalog title={submittedSearch?"Nenhum brinquedo encontrado":"A loja de brinquedos está recebendo produtos"} text={submittedSearch?"Tente outra busca ou veja o catálogo completo.":"As lojas parceiras ainda estão publicando seus brinquedos. Volte em breve para conferir as novidades."} clear={()=>{setSearch("");setSubmittedSearch("")}} />}</div></section>
        </main>
      </div>
    )
  }

  if (isBeauty) {
    return (
      <div className="min-h-full w-full bg-[#f6f3f8] pb-12 text-[#241f2d]">
        <div className="bg-[#241f2d] py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-white">Beleza local, entrega perto de você</div>
        <header className="bg-[#aaa4b1] text-white">
          <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6 lg:gap-8 lg:px-8">
            <Link href="/" className="flex items-center gap-2 text-xl font-black"><Sparkles className="h-7 w-7" /> Praça.ai <span className="hidden text-xs font-semibold text-white/70 sm:inline">Beleza</span></Link>
            <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que você procura hoje?" className="h-12 border-0 bg-card pl-12 pr-12 text-[#241f2d]" />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#5e287d] p-2"><ArrowRight className="h-4 w-4" /></button>
            </form>
            <div className="flex items-center gap-3 justify-self-end"><Link href="/profile" className="hidden text-sm font-bold sm:block">Entrar</Link><span className="rounded-full bg-card/15 p-2.5"><ShoppingCart className="h-5 w-5" /></span></div>
          </div>
          <nav className="border-t border-white/15 bg-[#77717e]">
            <div className="mx-auto flex max-w-6xl items-center gap-7 overflow-x-auto px-4 py-3 text-xs font-black sm:px-6 lg:px-8">
              <button onClick={() => setSort("offers")} className="shrink-0 text-[#f1d4ff]">Promoções</button>
              {beautyDepartments.map((item) => <button key={item.label} onClick={() => selectDepartment(item.search)} className="shrink-0 hover:text-[#f1d4ff]">{item.label}</button>)}
            </div>
          </nav>
        </header>

        <main>
          <section className="relative overflow-hidden bg-gradient-to-r from-[#e9def4] via-[#f2e9fb] to-[#ddd0ee]">
            <div className="absolute -right-16 -top-24 h-96 w-96 rounded-full border-[60px] border-white/25" />
            <div className="absolute bottom-0 left-[45%] h-28 w-28 rounded-full bg-[#b783cc]/25 blur-2xl" />
            <div className="relative mx-auto grid min-h-[390px] max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1fr_0.75fr] lg:px-8">
              <div><span className="inline-flex rounded-full bg-card/70 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#5e287d]">Seu momento de cuidado</span><h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.05] sm:text-6xl">Beleza que combina com você</h1><p className="mt-4 max-w-xl text-base text-[#4d4655] sm:text-lg">Cabelos, perfumaria, maquiagem, skincare e bem-estar das melhores lojas da sua região.</p><Button onClick={() => document.getElementById("produtos-beleza")?.scrollIntoView({ behavior: "smooth" })} className="mt-7 bg-[#5e287d] hover:bg-[#4a1f63]">Descobrir produtos</Button></div>
              <div className="relative hidden min-h-64 lg:block"><div className="absolute left-1/2 top-1/2 flex h-60 w-60 -translate-x-1/2 -translate-y-1/2 rotate-6 items-center justify-center rounded-[38%_62%_45%_55%] bg-gradient-to-br from-[#7e4b9b] to-[#bf86d2] shadow-2xl"><Sparkles className="h-28 w-28 -rotate-6 text-white" strokeWidth={1.2} /></div><Heart className="absolute bottom-5 left-8 h-12 w-12 fill-white/70 text-white/70" /></div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-5 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#7e4b9b]">Seu ritual, suas escolhas</p><h2 className="mt-1 text-2xl font-black">Explore por categoria</h2></div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{beautyDepartments.map(({ label, icon: Icon, search: term }, index) => <button key={label} onClick={() => selectDepartment(term)} className="group flex flex-col items-center rounded-2xl bg-card p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className={cn("flex h-14 w-14 items-center justify-center rounded-full", index % 2 === 0 ? "bg-[#efe3f5] text-[#7e4b9b]" : "bg-[#f8e6ee] text-[#a34c72]")}><Icon className="h-7 w-7" /></span><span className="mt-2 text-[11px] font-black leading-tight">{label}</span></button>)}</div>
          </section>

          <section className="mx-auto grid max-w-6xl gap-3 px-4 pb-8 sm:grid-cols-3 sm:px-6 lg:px-8">
            <BeautyPromo icon={Scissors} title="Cabelos incríveis" text="Tratamento, finalização e cor" color="bg-[#eee4f5] text-[#653a80]" search="cabelo" select={selectDepartment} />
            <BeautyPromo icon={Palette} title="Realce sua beleza" text="Maquiagem para todos os estilos" color="bg-[#fae5ec] text-[#9c4568]" search="maquiagem" select={selectDepartment} />
            <BeautyPromo icon={Heart} title="Rotina de skincare" text="Limpeza, hidratação e proteção" color="bg-[#e5f1ef] text-[#39796f]" search="skincare" select={selectDepartment} />
          </section>

          <section id="produtos-beleza" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#7e4b9b]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Beleza e cuidados pessoais</h2>{listData && <p className="mt-1 text-sm text-muted-foreground">{listData.total} produtos encontrados{submittedSearch ? ` para “${submittedSearch}”` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold", sort === option.value ? "border-[#5e287d] bg-[#5e287d] text-white" : "bg-card")}>{option.label}</button>)}</div></div>
            {isLoading ? <div className="py-16"><PageLoader /></div> : isError ? <EmptyCatalog title="Não foi possível carregar os produtos" text="Tente novamente em alguns instantes." clear={() => setSubmittedSearch("")} /> : listData && listData.products.length > 0 ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{listData.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyCatalog title={submittedSearch ? "Nenhum produto encontrado" : "A vitrine de beleza está recebendo produtos"} text={submittedSearch ? "Tente outra busca ou confira o catálogo completo." : "As lojas parceiras ainda estão publicando seus itens. Volte em breve para conferir as novidades."} clear={() => { setSearch(""); setSubmittedSearch("") }} />}
          </div></section>
        </main>
      </div>
    )
  }

  if (isBaby) {
    return (
      <div className="min-h-full w-full bg-[#fffaf5] pb-12 text-slate-950">
        <header className="bg-card">
          <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6 lg:gap-8 lg:px-8 lg:py-5">
            <Link href="/" className="flex items-center gap-2 text-xl font-black text-[#f28a22]"><Baby className="h-8 w-8" /> Praça.ai <span className="hidden text-sm text-slate-500 sm:inline">Bebê</span></Link>
            <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que você está procurando?" className="h-12 rounded-full bg-card pl-12 pr-12 shadow-sm" />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#f28a22] p-2 text-white"><ArrowRight className="h-4 w-4" /></button>
            </form>
            <div className="flex items-center gap-3 justify-self-end"><Link href="/profile" className="hidden text-sm font-bold text-slate-600 sm:block">Entre ou cadastre-se</Link><span className="rounded-full bg-orange-50 p-2.5 text-[#f28a22]"><ShoppingCart className="h-5 w-5" /></span></div>
          </div>
          <nav className="bg-[#49aaa8] text-white">
            <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 py-3 text-xs font-black sm:px-6 lg:px-8">
              {babyDepartments.map((item) => <button key={item.label} onClick={() => selectDepartment(item.search)} className="shrink-0 hover:text-orange-100">{item.label}</button>)}
              <button onClick={() => setSort("offers")} className="shrink-0 rounded-full bg-card px-3 text-[#318d8b]">Ofertas</button>
            </div>
          </nav>
        </header>

        <main>
          <section className="relative overflow-hidden bg-gradient-to-br from-[#a9dcf6] via-[#c5e9fa] to-[#e9f6fd]">
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full border-[45px] border-white/20" />
            <div className="absolute bottom-0 right-[18%] h-52 w-52 rounded-full bg-[#8ecf79]/40 blur-2xl" />
            <div className="relative mx-auto grid min-h-[390px] max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1fr_0.8fr] lg:px-8">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-1.5 text-xs font-black text-[#318d8b]"><Heart className="h-4 w-4 fill-[#f28a22] text-[#f28a22]" /> Cuidado em cada fase</span>
                <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.05] text-[#155d70] sm:text-6xl">Tudo para grandes aventuras</h1>
                <p className="mt-4 max-w-xl text-base text-[#155d70]/80 sm:text-lg">Produtos para passeio, quarto, alimentação, higiene e diversão do seu bebê, vendidos por lojas da sua região.</p>
                <Button onClick={() => document.getElementById("produtos-bebes")?.scrollIntoView({ behavior: "smooth" })} className="mt-7 bg-[#f28a22] hover:bg-[#dc7817]">Ver produtos</Button>
              </div>
              <div className="relative hidden min-h-64 lg:block">
                <div className="absolute left-1/2 top-1/2 flex h-60 w-60 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[40%_60%_55%_45%] bg-card/65 shadow-xl"><Baby className="h-32 w-32 text-[#f28a22]" strokeWidth={1.2} /></div>
                <Sparkles className="absolute right-5 top-5 h-14 w-14 text-white" /><Heart className="absolute bottom-5 left-6 h-12 w-12 fill-[#f7b6ba] text-[#f7b6ba]" />
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-5 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#49aaa8]">Tudo para o bebê</p><h2 className="mt-1 text-2xl font-black">Compre por departamento</h2></div>
            <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">{babyDepartments.map(({ label, icon: Icon, search: term }, index) => <button key={label} onClick={() => selectDepartment(term)} className="group flex flex-col items-center rounded-2xl bg-card p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className={cn("flex h-14 w-14 items-center justify-center rounded-full", index % 3 === 0 ? "bg-orange-100 text-[#f28a22]" : index % 3 === 1 ? "bg-cyan-100 text-[#318d8b]" : "bg-rose-100 text-rose-500")}><Icon className="h-7 w-7" /></span><span className="mt-2 text-[11px] font-black leading-tight">{label}</span></button>)}</div>
          </section>

          <section className="mx-auto grid max-w-6xl gap-3 px-4 pb-8 sm:grid-cols-3 sm:px-6 lg:px-8">
            <BabyPromo icon={Bike} title="Hora do passeio" text="Carrinhos, cadeirinhas e acessórios" color="bg-[#dff3f2] text-[#267c7a]" search="carrinho" select={selectDepartment} />
            <BabyPromo icon={BedDouble} title="Quarto aconchegante" text="Berços, móveis e enxoval" color="bg-[#fff0dd] text-[#b96818]" search="berço" select={selectDepartment} />
            <BabyPromo icon={Sparkles} title="Brincar e descobrir" text="Brinquedos para cada fase" color="bg-[#f9e6ee] text-[#b84e76]" search="brinquedo bebê" select={selectDepartment} />
          </section>

          <section id="produtos-bebes" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#49aaa8]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Artigos para bebês</h2>{listData && <p className="mt-1 text-sm text-muted-foreground">{listData.total} produtos encontrados{submittedSearch ? ` para “${submittedSearch}”` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold", sort === option.value ? "border-[#49aaa8] bg-[#49aaa8] text-white" : "bg-card")}>{option.label}</button>)}</div></div>
              {isLoading ? <div className="py-16"><PageLoader /></div> : isError ? <EmptyCatalog title="Não foi possível carregar os artigos" text="Tente novamente em alguns instantes." clear={() => setSubmittedSearch("")} /> : listData && listData.products.length > 0 ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{listData.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyCatalog title={submittedSearch ? "Nenhum produto encontrado" : "A loja do bebê está recebendo produtos"} text={submittedSearch ? "Tente outra busca ou confira todo o catálogo." : "As lojas parceiras ainda estão publicando seus artigos. Volte em breve para conferir as novidades."} clear={() => { setSearch(""); setSubmittedSearch("") }} />}
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-full w-full bg-[#f4f6f8] pb-12 text-slate-950">
      <header className="bg-[#174667] text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6 lg:gap-8 lg:px-8 lg:py-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-black"><Store className="h-7 w-7 fill-white" /> Praça.ai <span className="hidden text-sm font-semibold text-white/70 sm:inline">Papelaria</span></Link>
          <form onSubmit={submitSearch} className="relative col-span-3 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="O que vamos buscar hoje?" className="h-12 border-0 bg-card pl-12 pr-12 text-slate-950" />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary p-2"><ArrowRight className="h-4 w-4" /></button>
          </form>
          <div className="flex items-center gap-3 justify-self-end"><Link href="/profile" className="hidden text-sm font-bold sm:block">Entre ou cadastre-se</Link><span className="rounded-full bg-card/15 p-2.5"><ShoppingCart className="h-5 w-5" /></span></div>
        </div>
        <nav className="border-t border-white/10 bg-[#2f78a7]">
          <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4 py-3 text-xs font-black uppercase sm:px-6 lg:px-8">
            <span className="flex shrink-0 items-center gap-2"><Menu className="h-4 w-4" /> Departamentos</span>
            {stationeryDepartments.map((item) => <button key={item.label} onClick={() => selectDepartment(item.search)} className="shrink-0 hover:text-cyan-100">{item.label}</button>)}
            <button onClick={() => setSort("offers")} className="shrink-0 text-amber-200">Ofertas</button>
          </div>
        </nav>
      </header>

      <main>
        <section className="bg-card">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {[
              [Truck, "Entrega local", "Receba com rapidez"],
              [ShieldCheck, "Compra segura", "Pagamento protegido"],
              [PackageCheck, "Retirada na loja", "Compre de parceiros locais"],
              [Star, "Lojas avaliadas", "Escolha com confiança"],
            ].map(([Icon, title, subtitle]) => <div key={title as string} className="flex items-center gap-3 bg-card px-4 py-4"><Icon className="h-6 w-6 shrink-0 text-[#2f78a7]" /><div><p className="text-sm font-black">{title as string}</p><p className="text-xs text-muted-foreground">{subtitle as string}</p></div></div>)}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#d8ecf8] via-[#b9e0f4] to-[#80bddd] p-7 sm:p-10">
              <Sparkles className="absolute -right-4 -top-5 h-40 w-40 text-white/30" />
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#174667]">Tudo para criar e aprender</p>
              <h1 className="mt-3 max-w-xl text-3xl font-black leading-tight text-[#123951] sm:text-5xl">Papelaria completa perto de você</h1>
              <p className="mt-3 max-w-lg text-sm text-[#174667]/80 sm:text-base">Materiais escolares, escrita, arte, escritório e armarinho das lojas da sua região.</p>
              <Button onClick={() => document.getElementById("produtos-papelaria")?.scrollIntoView({ behavior: "smooth" })} className="mt-6 bg-[#174667] hover:bg-[#174667]/90">Ver produtos</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PromoTile icon={PenLine} title="Escrita" subtitle="Canetas, lápis e marcadores" color="bg-rose-100 text-rose-800" onClick={() => selectDepartment("caneta")} />
              <PromoTile icon={BookOpen} title="Cadernos" subtitle="Para escola e organização" color="bg-amber-100 text-amber-800" onClick={() => selectDepartment("caderno")} />
              <PromoTile icon={Palette} title="Criatividade" subtitle="Pintura, desenho e artes" color="bg-violet-100 text-violet-800" onClick={() => selectDepartment("arte")} />
              <PromoTile icon={Scissors} title="Armarinho" subtitle="Materiais para seus projetos" color="bg-emerald-100 text-emerald-800" onClick={() => selectDepartment("armarinho")} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#2f78a7]">Explore por departamento</p><h2 className="mt-1 text-2xl font-black">Encontre tudo o que precisa</h2></div></div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{stationeryDepartments.map(({ label, icon: Icon, search: term }) => <button key={label} onClick={() => selectDepartment(term)} className="group flex flex-col items-center rounded-2xl bg-card p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f2f8] text-[#2f78a7]"><Icon className="h-7 w-7" /></span><span className="mt-2 text-xs font-black">{label}</span></button>)}</div>
        </section>

        <section id="produtos-papelaria" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#2f78a7]">Catálogo local</p><h2 className="mt-1 text-2xl font-black">Produtos de papelaria</h2>{listData && <p className="mt-1 text-sm text-muted-foreground">{listData.total} produtos encontrados{submittedSearch ? ` para “${submittedSearch}”` : ""}</p>}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{sortOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => setSort(option.value)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-bold", sort === option.value ? "border-[#2f78a7] bg-[#2f78a7] text-white" : "bg-card")}>{option.label}</button>)}</div></div>

            {isLoading ? <div className="py-16"><PageLoader /></div> : isError ? <EmptyCatalog title="Não foi possível carregar a papelaria" text="Tente novamente em alguns instantes." clear={() => setSubmittedSearch("")} /> : listData && listData.products.length > 0 ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{listData.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyCatalog title={submittedSearch ? "Nenhum produto encontrado" : "A papelaria está recebendo produtos"} text={submittedSearch ? "Tente outro termo ou veja o catálogo completo." : "As lojas parceiras ainda estão publicando seus materiais. Volte em breve para conferir as novidades."} clear={() => { setSearch(""); setSubmittedSearch("") }} />}
          </div>
        </section>
      </main>
    </div>
  )
}

function PromoTile({ icon: Icon, title, subtitle, color, onClick }: { icon: typeof PenLine; title: string; subtitle: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={cn("flex min-h-36 flex-col items-start justify-between rounded-2xl p-5 text-left transition hover:-translate-y-1", color)}><Icon className="h-8 w-8" /><div><p className="font-black">{title}</p><p className="mt-1 text-xs opacity-75">{subtitle}</p></div></button>
}

function BabyPromo({ icon: Icon, title, text, color, search, select }: { icon: typeof Baby; title: string; text: string; color: string; search: string; select: (search: string) => void }) {
  return <button onClick={() => select(search)} className={cn("flex min-h-36 items-center gap-5 rounded-2xl p-6 text-left transition hover:-translate-y-1", color)}><span className="rounded-full bg-card/70 p-4"><Icon className="h-8 w-8" /></span><div><h3 className="text-lg font-black">{title}</h3><p className="mt-1 text-sm opacity-75">{text}</p></div></button>
}

function BeautyPromo({ icon: Icon, title, text, color, search, select }: { icon: typeof Sparkles; title: string; text: string; color: string; search: string; select: (search: string) => void }) {
  return <button onClick={() => select(search)} className={cn("flex min-h-36 items-center gap-5 rounded-2xl p-6 text-left transition hover:-translate-y-1", color)}><span className="rounded-full bg-card/70 p-4"><Icon className="h-8 w-8" /></span><div><h3 className="text-lg font-black">{title}</h3><p className="mt-1 text-sm opacity-75">{text}</p></div></button>
}

function FashionPromo({ title, text, color, search, select }: { title: string; text: string; color: string; search: string; select: (search: string) => void }) {
  return <button onClick={() => select(search)} className={cn("group relative min-h-48 overflow-hidden p-6 text-left transition hover:-translate-y-1", color)}><div className="absolute -bottom-14 -right-10 flex h-52 w-52 items-center justify-center rounded-full bg-card/35 transition group-hover:scale-105"><Shirt className="h-24 w-24 text-black/45" strokeWidth={1.1} /></div><div className="relative"><p className="text-xs font-black uppercase tracking-[0.18em] text-black/55">Coleção local</p><h3 className="mt-2 max-w-[12rem] text-2xl font-black">{title}</h3><p className="mt-2 max-w-[12rem] text-sm text-black/65">{text}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-black">Ver produtos <ArrowRight className="h-4 w-4" /></span></div></button>
}

function PhoneBenefit({ icon: Icon, title, text }: { icon: typeof Smartphone; title: string; text: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm"><span className="rounded-full bg-[#e4eef8] p-3 text-[#174b87]"><Icon className="h-6 w-6" /></span><div><p className="text-sm font-black">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div></div>
}

function PhoneFilter({ title, values, select }: { title: string; values: string[]; select: (search: string) => void }) {
  return <div className="mt-5 border-t pt-4"><h3 className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</h3><div className="mt-2 flex flex-wrap gap-2">{values.map((value) => <button key={value} onClick={() => select(value)} className="rounded-full border px-3 py-1.5 text-xs font-bold transition hover:border-[#174b87] hover:bg-[#e4eef8]">{value}</button>)}</div></div>
}

function EmptyCatalog({ title, text, clear }: { title: string; text: string; clear: () => void }) {
  return <Card className="mt-6 flex flex-col items-center rounded-2xl border-dashed p-10 text-center"><Heart className="h-10 w-10 text-[#2f78a7]" /><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p><Button variant="outline" onClick={clear} className="mt-5">Ver catálogo completo</Button></Card>
}
