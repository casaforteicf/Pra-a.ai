import * as React from "react"
import { Link } from "wouter"
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Car,
  ChevronDown,
  CircleDollarSign,
  Gauge,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Veiculo {
  id: string
  marca: string
  modelo: string
  anoFabricacao: number | null
  anoModelo: number | null
  km: number | null
  combustivel: string | null
  cambio: string | null
  preco: number
  precoOriginal: number | null
  imageUrl: string | null
  vendorName: string
  destaque?: boolean
}

const POPULAR_BRANDS = ["Chevrolet", "Fiat", "Volkswagen", "Toyota", "Honda", "Hyundai", "Jeep", "Renault"]

const SERVICES = [
  { icon: CircleDollarSign, title: "Financie seu veículo", text: "Compare condições e organize sua entrada." },
  { icon: Gauge, title: "Consulte a referência", text: "Tenha uma base de preço antes de negociar." },
  { icon: Car, title: "Venda seu veículo", text: "Anuncie pela loja parceira do Praça.ai." },
  { icon: CalendarDays, title: "Agende um test-drive", text: "Escolha o veículo e solicite o melhor horário." },
]

export default function VeiculosListing() {
  const [search, setSearch] = React.useState("")
  const [brand, setBrand] = React.useState("")
  const [maxPrice, setMaxPrice] = React.useState("")
  const [minYear, setMinYear] = React.useState("")

  const { data: veiculos = [], isLoading, isError } = useQuery<Veiculo[]>({
    queryKey: ["veiculos"],
    queryFn: async () => {
      const response = await fetch("/api/veiculos")
      if (!response.ok) throw new Error("Falha ao carregar veículos")
      return response.json()
    },
  })

  const availableBrands = React.useMemo(
    () => Array.from(new Set(veiculos.map((vehicle) => vehicle.marca))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [veiculos],
  )

  const filteredVehicles = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR")
    const priceLimit = maxPrice ? Number(maxPrice) : null
    const yearLimit = minYear ? Number(minYear) : null

    return veiculos.filter((vehicle) => {
      const matchesSearch = !normalizedSearch || `${vehicle.marca} ${vehicle.modelo} ${vehicle.vendorName}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)
      const matchesBrand = !brand || vehicle.marca === brand
      const matchesPrice = priceLimit == null || vehicle.preco <= priceLimit
      const matchesYear = yearLimit == null || (vehicle.anoModelo != null && vehicle.anoModelo >= yearLimit)
      return matchesSearch && matchesBrand && matchesPrice && matchesYear
    })
  }, [brand, maxPrice, minYear, search, veiculos])

  const partnerStores = React.useMemo(
    () => Array.from(new Set(veiculos.map((vehicle) => vehicle.vendorName))).slice(0, 8),
    [veiculos],
  )

  const clearFilters = () => {
    setSearch("")
    setBrand("")
    setMaxPrice("")
    setMinYear("")
  }

  return (
    <div className="min-h-full w-full bg-[#f3f4f2] pb-12 text-slate-950">
      <section className="relative overflow-hidden bg-[#123d2a] text-white">
        <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-emerald-300/10" />
        <div className="absolute -bottom-44 left-1/3 h-80 w-80 rounded-full bg-white/5" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 text-sm font-bold text-white/80 transition hover:text-white">
              <Store className="h-5 w-5" /> Praça.ai Veículos
            </Link>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur">
              <MapPin className="h-4 w-4" /> Chapecó e região
            </div>
          </div>

          <div className="max-w-3xl">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
              <ShieldCheck className="h-4 w-4" /> Anúncios de lojas parceiras verificadas
            </span>
            <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              Encontre seu próximo veículo perto de você
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
              Compare ofertas locais, consulte os detalhes e agende seu test-drive diretamente com a loja.
            </p>
          </div>
        </div>
      </section>

      <main className="relative z-10 mx-auto -mt-12 max-w-6xl px-4 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border-0 p-4 shadow-xl shadow-slate-900/10 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Busca inteligente</p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">Qual veículo combina com você?</h2>
            </div>
            <Car className="hidden h-10 w-10 text-primary/20 sm:block" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <label className="relative">
              <span className="sr-only">Buscar por marca ou modelo</span>
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Marca, modelo ou loja" className="h-12 pl-11" />
            </label>
            <label className="relative">
              <span className="sr-only">Marca</span>
              <select value={brand} onChange={(event) => setBrand(event.target.value)} className="h-12 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Todas as marcas</option>
                {availableBrands.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </label>
            <label className="relative">
              <span className="sr-only">Preço máximo</span>
              <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="h-12 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Preço máximo</option>
                <option value="50000">Até R$ 50 mil</option>
                <option value="80000">Até R$ 80 mil</option>
                <option value="120000">Até R$ 120 mil</option>
                <option value="200000">Até R$ 200 mil</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </label>
            <label className="relative">
              <span className="sr-only">Ano mínimo</span>
              <select value={minYear} onChange={(event) => setMinYear(event.target.value)} className="h-12 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Ano mínimo</option>
                <option value="2024">2024</option>
                <option value="2022">2022</option>
                <option value="2020">2020</option>
                <option value="2018">2018</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </label>
            <Button className="h-12 gap-2 px-6"><Search className="h-4 w-4" /> Buscar</Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span className="font-semibold text-muted-foreground">Buscas populares:</span>
            {POPULAR_BRANDS.slice(0, 5).map((item) => (
              <button key={item} onClick={() => setSearch(item)} className="rounded-full bg-muted px-3 py-1.5 font-semibold transition hover:bg-primary/10 hover:text-primary">{item}</button>
            ))}
          </div>
        </Card>

        <section className="py-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Ofertas da região</p>
              <h2 className="mt-1 text-2xl font-black">Veículos em destaque</h2>
              {!isLoading && <p className="mt-1 text-sm text-muted-foreground">{filteredVehicles.length} {filteredVehicles.length === 1 ? "veículo encontrado" : "veículos encontrados"}</p>}
            </div>
            {(search || brand || maxPrice || minYear) && <button onClick={clearFilters} className="shrink-0 text-sm font-bold text-primary hover:underline">Limpar filtros</button>}
          </div>

          {isLoading ? (
            <div className="rounded-2xl bg-white py-12"><PageLoader /></div>
          ) : isError ? (
            <Card className="rounded-2xl p-10 text-center">
              <Car className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-bold">Não foi possível carregar os veículos</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tente novamente em alguns instantes.</p>
            </Card>
          ) : filteredVehicles.length === 0 ? (
            <Card className="overflow-hidden rounded-2xl border-0 shadow-sm">
              <div className="grid md:grid-cols-[1.3fr_1fr]">
                <div className="p-7 sm:p-10">
                  <span className="inline-flex rounded-full bg-primary/10 p-3 text-primary"><Car className="h-7 w-7" /></span>
                  <h3 className="mt-5 text-2xl font-black">{veiculos.length === 0 ? "As primeiras ofertas estão chegando" : "Nenhum veículo combina com estes filtros"}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {veiculos.length === 0
                      ? "Estamos conectando as lojas da região ao Praça.ai. Em breve você poderá comparar veículos vistoriados e agendar seu test-drive por aqui."
                      : "Altere a marca, o ano ou o limite de preço para ampliar sua busca."}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {veiculos.length > 0 ? (
                      <Button onClick={clearFilters}>Ver todos os veículos</Button>
                    ) : (
                      <Link href="/listing"><Button>Explorar outras ofertas</Button></Link>
                    )}
                    <Link href="/profile" className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-bold hover:bg-muted">
                      Sou lojista <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
                <div className="flex min-h-56 items-center justify-center bg-gradient-to-br from-primary/10 via-emerald-50 to-white p-8">
                  <div className="relative">
                    <div className="absolute inset-0 scale-125 rounded-full bg-primary/10 blur-2xl" />
                    <Car className="relative h-28 w-28 text-primary" strokeWidth={1.25} />
                    <BadgeCheck className="absolute -right-2 -top-2 h-9 w-9 fill-white text-primary" />
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVehicles.map((vehicle) => (
                <Link key={vehicle.id} href={`/veiculos/${vehicle.id}`} className="group block">
                  <Card className="h-full overflow-hidden rounded-2xl border-0 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-200">
                      {vehicle.imageUrl ? (
                        <img src={vehicle.imageUrl} alt={`${vehicle.marca} ${vehicle.modelo}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200"><Car className="h-16 w-16 text-slate-400" /></div>
                      )}
                      {vehicle.destaque && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold shadow"><Sparkles className="h-3.5 w-3.5 text-amber-500" /> Destaque</span>}
                      <span className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-700 shadow backdrop-blur"><Heart className="h-4 w-4" /></span>
                    </div>
                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-primary">{vehicle.marca}</p>
                      <h3 className="mt-1 truncate text-lg font-black">{vehicle.modelo}</h3>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                        <span className="rounded-md bg-muted px-2 py-1">{vehicle.anoFabricacao ?? "—"}/{vehicle.anoModelo ?? "—"}</span>
                        <span className="rounded-md bg-muted px-2 py-1">{vehicle.km != null ? `${vehicle.km.toLocaleString("pt-BR")} km` : "KM não informado"}</span>
                        {vehicle.cambio && <span className="rounded-md bg-muted px-2 py-1 capitalize">{vehicle.cambio}</span>}
                      </div>
                      <div className="mt-5 border-t pt-4">
                        {vehicle.precoOriginal && <p className="text-xs text-muted-foreground line-through">{formatMoney(vehicle.precoOriginal)}</p>}
                        <p className="text-2xl font-black text-primary">{formatMoney(vehicle.preco)}</p>
                        <p className="mt-2 flex items-center gap-1.5 truncate text-xs font-semibold text-muted-foreground"><Store className="h-3.5 w-3.5" /> {vehicle.vendorName}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="pb-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Parceiros locais</p>
              <h2 className="mt-1 text-2xl font-black">Lojas e marcas para acompanhar</h2>
            </div>
          </div>
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {(partnerStores.length > 0 ? partnerStores : POPULAR_BRANDS).map((item) => (
              <div key={item} className="flex min-h-24 min-w-36 snap-start flex-col items-center justify-center rounded-2xl border bg-white px-5 text-center shadow-sm sm:min-w-40">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Store className="h-5 w-5" /></span>
                <p className="mt-2 text-sm font-black">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-[#e7ebe8] p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Jornada completa</p>
            <h2 className="mt-1 text-2xl font-black">Soluções para comprar e vender melhor</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl bg-white p-5 shadow-sm">
                <Icon className="h-7 w-7 text-primary" />
                <h3 className="mt-5 font-black">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary">Saiba mais <ArrowRight className="h-3.5 w-3.5" /></span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
