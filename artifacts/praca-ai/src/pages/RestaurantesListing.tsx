import * as React from "react"
import { useLocation, Link } from "wouter"
import { ChevronLeft, UtensilsCrossed, Search, Croissant, Sandwich, Soup, Percent } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageLoader } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface Restaurante {
  vendorId: string
  vendorName: string
  categorias: string[]
}

// Categorias comuns de cardápio brasileiro — filtram de verdade contra
// restaurante_cardapio.categoria (ILIKE, campo livre por lojista), não
// são só decorativas. Aparecem mesmo sem restaurante cadastrado ainda,
// mas só retornam resultado quando existir cardápio real com essa
// categoria.
const restauranteDepartments = [
  { label: "Padarias", icon: Croissant, categoria: "padaria" },
  { label: "Lanches", icon: Sandwich, categoria: "lanche" },
  { label: "Brasileira", icon: Soup, categoria: "brasileira" },
  { label: "Pizzas", icon: UtensilsCrossed, categoria: "pizza" },
  { label: "Japonesa", icon: UtensilsCrossed, categoria: "japonesa" },
  { label: "Doces e sobremesas", icon: Croissant, categoria: "sobremesa" },
  { label: "Saudável", icon: Soup, categoria: "saudável" },
  { label: "Bebidas", icon: Sandwich, categoria: "bebida" },
]

export default function RestaurantesListing() {
  const [, setLocation] = useLocation()
  const [search, setSearch] = React.useState("")
  const [categoriaFiltro, setCategoriaFiltro] = React.useState<string | null>(null)

  const { data: restaurantes, isLoading } = useQuery<Restaurante[]>({
    queryKey: ["restaurantes", categoriaFiltro],
    queryFn: () => fetch(`/api/restaurantes${categoriaFiltro ? `?categoria=${encodeURIComponent(categoriaFiltro)}` : ""}`).then((r) => r.json()),
  })

  const filtrados = React.useMemo(() => {
    if (!restaurantes) return []
    if (!search.trim()) return restaurantes
    return restaurantes.filter((r) => r.vendorName.toLowerCase().includes(search.toLowerCase()))
  }, [restaurantes, search])

  return (
    <div className="flex flex-col w-full min-h-full pb-8 bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button onClick={() => setLocation("/")} className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center active:scale-95">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black">Restaurantes</h1>
        </div>
        <div className="relative px-4 pb-4">
          <Search className="absolute left-7 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Busque o restaurante" className="h-12 border-0 bg-card pl-12 text-foreground" />
        </div>
      </header>

      <section className="px-4 py-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary mb-3">Por categoria</p>
        <div className="grid grid-cols-4 gap-x-2 gap-y-4">
          {restauranteDepartments.map(({ label, icon: Icon, categoria }) => (
            <button key={label} onClick={() => setCategoriaFiltro(categoriaFiltro === categoria ? null : categoria)} className="group flex min-w-0 flex-col items-center gap-2 text-center">
              <span className={cn("flex h-12 w-12 items-center justify-center rounded-full transition", categoriaFiltro === categoria ? "bg-primary text-primary-foreground shadow-neon-sm" : "bg-primary/15 text-primary group-hover:bg-primary group-hover:text-primary-foreground")}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-[10px] font-bold leading-tight text-foreground">{label}</span>
            </button>
          ))}
        </div>
        {categoriaFiltro && <button onClick={() => setCategoriaFiltro(null)} className="mt-3 text-xs font-bold text-primary">Limpar filtro de categoria</button>}
      </section>

      <section className="mx-4 mb-5 rounded-2xl bg-card p-5 shadow-sm flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Percent className="h-6 w-6" /></span>
        <div>
          <p className="font-black text-sm">Restaurantes com cupom</p>
          <p className="text-xs text-muted-foreground mt-0.5">Cupons de desconto aparecem direto no cardápio de cada restaurante parceiro.</p>
        </div>
      </section>

      {isLoading ? (
        <PageLoader />
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 text-muted-foreground px-4 text-center">
          <UtensilsCrossed className="w-12 h-12" />
          <p className="font-medium">{categoriaFiltro || search ? "Nenhum restaurante encontrado." : "Nenhum restaurante disponível ainda."}</p>
          {(categoriaFiltro || search) && <button onClick={() => { setCategoriaFiltro(null); setSearch("") }} className="text-sm font-bold text-primary">Limpar filtros</button>}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {filtrados.map((r) => (
            <Link key={r.vendorId} href={`/restaurantes/${r.vendorId}`}>
              <Card className="p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold">{r.vendorName}</p>
                  {r.categorias.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">{r.categorias.slice(0, 3).join(" · ")}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
