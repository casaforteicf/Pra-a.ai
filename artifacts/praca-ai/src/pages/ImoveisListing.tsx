import * as React from "react"
import { Link } from "wouter"
import {
  ArrowDownUp,
  Bath,
  BedDouble,
  Bell,
  Building2,
  Car,
  ChevronDown,
  Heart,
  Home as HomeIcon,
  Map,
  MapPin,
  Maximize2,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Imovel {
  id: string
  titulo: string
  tipo: string
  finalidade: string
  endereco: string | null
  bairro: string | null
  cidade: string | null
  areaM2: number | null
  quartos: number | null
  banheiros: number | null
  vagas: number | null
  valor: number
  valorCondominio: number | null
  valorIptu: number | null
  imageUrl: string | null
  vendorName: string
  destaque?: boolean
}

const PROPERTY_TYPES = [
  ["casa", "Casa"],
  ["apartamento", "Apartamento"],
  ["terreno", "Terreno"],
  ["comercial", "Comercial"],
  ["rural", "Rural"],
  ["sala_comercial", "Sala comercial"],
] as const

const numberOptions = [1, 2, 3, 4]

export default function ImoveisListing() {
  const [purpose, setPurpose] = React.useState<"venda" | "aluguel">("venda")
  const [location, setLocation] = React.useState("")
  const [types, setTypes] = React.useState<string[]>([])
  const [bedrooms, setBedrooms] = React.useState(0)
  const [bathrooms, setBathrooms] = React.useState(0)
  const [parking, setParking] = React.useState(0)
  const [minPrice, setMinPrice] = React.useState("")
  const [maxPrice, setMaxPrice] = React.useState("")
  const [sort, setSort] = React.useState("relevancia")
  const [showMobileFilters, setShowMobileFilters] = React.useState(false)

  const { data: properties = [], isLoading, isError } = useQuery<Imovel[]>({
    queryKey: ["imoveis"],
    queryFn: async () => {
      const response = await fetch("/api/imoveis")
      if (!response.ok) throw new Error("Falha ao carregar imóveis")
      return response.json()
    },
  })

  const toggleType = (type: string) => setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])

  const filteredProperties = React.useMemo(() => {
    const normalizedLocation = location.trim().toLocaleLowerCase("pt-BR")
    const minimum = minPrice ? Number(minPrice) : null
    const maximum = maxPrice ? Number(maxPrice) : null

    const result = properties.filter((property) => {
      const address = `${property.endereco ?? ""} ${property.bairro ?? ""} ${property.cidade ?? ""}`.toLocaleLowerCase("pt-BR")
      return property.finalidade === purpose
        && (!normalizedLocation || address.includes(normalizedLocation))
        && (types.length === 0 || types.includes(property.tipo))
        && (!bedrooms || (property.quartos ?? 0) >= bedrooms)
        && (!bathrooms || (property.banheiros ?? 0) >= bathrooms)
        && (!parking || (property.vagas ?? 0) >= parking)
        && (minimum == null || property.valor >= minimum)
        && (maximum == null || property.valor <= maximum)
    })

    return [...result].sort((a, b) => {
      if (sort === "menor-preco") return a.valor - b.valor
      if (sort === "maior-preco") return b.valor - a.valor
      return Number(Boolean(b.destaque)) - Number(Boolean(a.destaque))
    })
  }, [bathrooms, bedrooms, location, maxPrice, minPrice, parking, properties, purpose, sort, types])

  const clearFilters = () => {
    setLocation("")
    setTypes([])
    setBedrooms(0)
    setBathrooms(0)
    setParking(0)
    setMinPrice("")
    setMaxPrice("")
  }

  const activeFilterCount = types.length + Number(Boolean(bedrooms)) + Number(Boolean(bathrooms)) + Number(Boolean(parking)) + Number(Boolean(minPrice)) + Number(Boolean(maxPrice))

  const filters = (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-black">Tipo de imóvel</p>
        <div className="space-y-3">
          {PROPERTY_TYPES.map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" checked={types.includes(value)} onChange={() => toggleType(value)} className="h-4 w-4 rounded border-slate-300 accent-primary" />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="border-t pt-5">
        <FilterNumbers title="Quartos" value={bedrooms} onChange={setBedrooms} />
        <FilterNumbers title="Banheiros" value={bathrooms} onChange={setBathrooms} />
        <FilterNumbers title="Vagas" value={parking} onChange={setParking} />
      </div>
      <div className="border-t pt-5">
        <p className="mb-3 text-sm font-black">Faixa de preço</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Mínimo<Input inputMode="numeric" value={minPrice} onChange={(event) => setMinPrice(event.target.value.replace(/\D/g, ""))} placeholder="R$ 0" className="mt-1" /></label>
          <label className="text-xs text-muted-foreground">Máximo<Input inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/\D/g, ""))} placeholder="R$ 0" className="mt-1" /></label>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-full w-full bg-white text-slate-950">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 lg:px-7">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-black text-primary"><Store className="h-6 w-6 fill-primary" /> <span>Praça.ai Imóveis</span></Link>
          <label className="relative ml-auto hidden w-full max-w-2xl lg:block">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
            <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Busque rua, bairro ou cidade" className="h-11 rounded-full pl-12" />
          </label>
          <button className="hidden shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold md:flex"><Bell className="h-4 w-4" /> Criar alerta</button>
          <button className="hidden shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold md:flex"><Map className="h-4 w-4" /> Mapa</button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[290px_1fr]">
        <aside className="hidden border-r lg:block">
          <div className="sticky top-[69px] flex h-[calc(100dvh-141px)] flex-col">
            <div className="grid grid-cols-2 border-b p-2">
              {(["venda", "aluguel"] as const).map((item) => <button key={item} onClick={() => setPurpose(item)} className={cn("border-b-2 px-3 py-3 text-sm font-black capitalize", purpose === item ? "border-primary text-primary" : "border-transparent")}>{item === "venda" ? "Comprar" : "Alugar"}</button>)}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{filters}</div>
            <div className="grid grid-cols-2 gap-3 border-t bg-white p-4"><Button variant="ghost" onClick={clearFilters}>Limpar</Button><Button>Buscar imóveis</Button></div>
          </div>
        </aside>

        <main className="min-w-0 bg-[#f7f7f5] px-4 pb-12 pt-4 sm:px-6 lg:px-7">
          <div className="lg:hidden">
            <div className="grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm">
              {(["venda", "aluguel"] as const).map((item) => <button key={item} onClick={() => setPurpose(item)} className={cn("rounded-lg py-2.5 text-sm font-black", purpose === item ? "bg-primary text-white" : "text-muted-foreground")}>{item === "venda" ? "Comprar" : "Alugar"}</button>)}
            </div>
            <label className="relative mt-3 block">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Rua, bairro ou cidade" className="h-12 rounded-xl bg-white pl-12" />
            </label>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => setShowMobileFilters(true)} className="flex-1 gap-2 bg-white"><SlidersHorizontal className="h-4 w-4" /> Filtros {activeFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-white">{activeFilterCount}</span>}</Button>
              <Button variant="outline" className="gap-2 bg-white"><Map className="h-4 w-4" /> Mapa</Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4 lg:mt-0">
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Link href="/">Início</Link><span>›</span><span>{purpose === "venda" ? "Comprar" : "Alugar"}</span></div>
              <h1 className="mt-2 text-xl font-black sm:text-2xl">{filteredProperties.length} imóveis para {purpose === "venda" ? "comprar" : "alugar"} na sua região</h1>
            </div>
            <label className="relative">
              <ArrowDownUp className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 appearance-none rounded-full border bg-white pl-9 pr-9 text-sm font-bold">
                <option value="relevancia">Mais relevantes</option><option value="menor-preco">Menor preço</option><option value="maior-preco">Maior preço</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            </label>
          </div>

          {isLoading ? <div className="mt-5 rounded-2xl bg-white py-16"><PageLoader /></div> : isError ? (
            <Card className="mt-5 p-10 text-center"><HomeIcon className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-4 font-black">Não foi possível carregar os imóveis</h2></Card>
          ) : filteredProperties.length === 0 ? (
            <Card className="mt-5 overflow-hidden rounded-2xl border-0 shadow-sm">
              <div className="grid md:grid-cols-[1.3fr_1fr]">
                <div className="p-7 sm:p-10"><span className="inline-flex rounded-full bg-primary/10 p-3 text-primary"><Building2 className="h-7 w-7" /></span><h2 className="mt-5 text-2xl font-black">{properties.length === 0 ? "Novos imóveis estão chegando" : "Nenhum imóvel combina com seus filtros"}</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{properties.length === 0 ? "Estamos conectando imobiliárias e corretores parceiros da região. Em breve você poderá comparar imóveis e agendar visitas diretamente pelo Praça.ai." : "Amplie a região ou ajuste tipo, quartos e faixa de preço para encontrar mais opções."}</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={clearFilters}>{properties.length === 0 ? "Explorar o Praça.ai" : "Limpar filtros"}</Button><Link href="/profile" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-bold">Quero anunciar um imóvel</Link></div></div>
                <div className="flex min-h-56 items-center justify-center bg-gradient-to-br from-primary/10 to-white"><HomeIcon className="h-28 w-28 text-primary" strokeWidth={1.2} /></div>
              </div>
            </Card>
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredProperties.map((property) => <PropertyCard key={property.id} property={property} />)}
            </div>
          )}
        </main>
      </div>

      {showMobileFilters && <div className="fixed inset-0 z-50 bg-black/40 lg:hidden"><div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-6"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-black">Filtrar imóveis</h2><button onClick={() => setShowMobileFilters(false)} className="rounded-full bg-muted p-2"><X className="h-5 w-5" /></button></div>{filters}<div className="sticky bottom-0 mt-6 grid grid-cols-2 gap-3 border-t bg-white py-4"><Button variant="ghost" onClick={clearFilters}>Limpar</Button><Button onClick={() => setShowMobileFilters(false)}>Ver {filteredProperties.length} imóveis</Button></div></div></div>}
    </div>
  )
}

function FilterNumbers({ title, value, onChange }: { title: string; value: number; onChange: (value: number) => void }) {
  return <div className="mb-5"><p className="mb-2 text-sm text-muted-foreground">{title}</p><div className="flex gap-2">{numberOptions.map((number) => <button key={number} onClick={() => onChange(value === number ? 0 : number)} className={cn("h-11 min-w-11 rounded-full border text-sm font-bold", value === number ? "border-primary bg-primary text-white" : "bg-white")}>{number}+</button>)}</div></div>
}

function PropertyCard({ property }: { property: Imovel }) {
  return <Link href={`/imoveis/${property.id}`} className="group block"><Card className="h-full overflow-hidden rounded-2xl border-0 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="relative aspect-[4/3] overflow-hidden bg-slate-200">{property.imageUrl ? <img src={property.imageUrl} alt={property.titulo} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><HomeIcon className="h-16 w-16 text-slate-400" /></div>}{property.destaque && <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-black shadow">Destaque</span>}<span className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow"><Heart className="h-5 w-5" /></span></div><div className="p-4"><p className="text-xs text-muted-foreground">{PROPERTY_TYPES.find(([value]) => value === property.tipo)?.[1] ?? property.tipo} para {property.finalidade === "aluguel" ? "alugar" : "comprar"}</p><h2 className="mt-1 line-clamp-2 font-black">{property.titulo}</h2><p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {[property.bairro, property.cidade].filter(Boolean).join(", ") || "Localização não informada"}</p><div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-700">{property.areaM2 != null && <span className="flex items-center gap-1"><Maximize2 className="h-4 w-4" /> {property.areaM2} m²</span>}{property.quartos != null && <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" /> {property.quartos}</span>}{property.banheiros != null && <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {property.banheiros}</span>}{property.vagas != null && <span className="flex items-center gap-1"><Car className="h-4 w-4" /> {property.vagas}</span>}</div><p className="mt-5 text-2xl font-black">{formatMoney(property.valor)}{property.finalidade === "aluguel" && <span className="text-xs font-medium text-muted-foreground">/mês</span>}</p>{(property.valorCondominio || property.valorIptu) && <p className="mt-1 text-[11px] text-muted-foreground">{property.valorCondominio ? `Cond. ${formatMoney(property.valorCondominio)}` : ""}{property.valorCondominio && property.valorIptu ? " · " : ""}{property.valorIptu ? `IPTU ${formatMoney(property.valorIptu)}` : ""}</p>}<p className="mt-4 flex items-center gap-1.5 border-t pt-3 text-xs font-semibold text-muted-foreground"><Store className="h-3.5 w-3.5" /> {property.vendorName}</p><Button className="mt-4 w-full">Ver imóvel e agendar visita</Button></div></Card></Link>
}
