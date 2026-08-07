import * as React from "react"
import { useLocation, Link } from "wouter"
import { ChevronLeft, Pill, Search, Sparkles, HeartPulse, Baby, Cross, Sun, TestTube2, Stethoscope } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PageLoader } from "@/components/ui/skeleton"

interface FarmaciaProduto {
  id: string
  nome: string
  exigeReceita: boolean
  preco: number
  precoOriginal: number | null
  imageUrl: string | null
  vendorName: string
}

// categoria é campo livre (sem produto real cadastrado ainda pra saber
// os valores em uso) — filtra por nome (ILIKE, já suportado pelo
// backend), mesmo padrão de busca por termo das outras páginas de
// categoria, não por categoria exata.
const farmaciaDepartments = [
  { label: "Medicamentos", icon: Pill, search: "medicamento remédio" },
  { label: "Genéricos", icon: Cross, search: "genérico" },
  { label: "Vitaminas e suplementos", icon: HeartPulse, search: "vitamina suplemento" },
  { label: "Higiene e beleza", icon: Sparkles, search: "higiene beleza" },
  { label: "Mamãe e bebê", icon: Baby, search: "mamãe bebê fralda" },
  { label: "Primeiros socorros", icon: Stethoscope, search: "primeiros socorros curativo" },
  { label: "Dermocosméticos", icon: Sun, search: "dermocosmético protetor solar" },
  { label: "Testes e diagnóstico", icon: TestTube2, search: "teste diagnóstico" },
]

export default function FarmaciaListing() {
  const [, setLocation] = useLocation()
  const [search, setSearch] = React.useState("")
  const [submittedSearch, setSubmittedSearch] = React.useState("")

  const { data: produtos, isLoading } = useQuery<FarmaciaProduto[]>({
    queryKey: ["farmacia-produtos", submittedSearch],
    queryFn: () => fetch(`/api/farmacia/produtos${submittedSearch ? `?nome=${encodeURIComponent(submittedSearch)}` : ""}`).then((r) => r.json()),
  })

  function selectDepartment(term: string) {
    setSearch(term)
    setSubmittedSearch(term)
  }

  return (
    <div className="flex flex-col w-full min-h-full pb-8 bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button onClick={() => setLocation("/")} className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center active:scale-95">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black">Farmácia</h1>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setSubmittedSearch(search) }} className="relative px-4 pb-4">
          <Search className="absolute left-7 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Busque medicamento, vitamina e mais" className="h-12 border-0 bg-card pl-12 text-foreground" />
        </form>
      </header>

      <section className="px-4 py-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary mb-3">Por categoria</p>
        <div className="grid grid-cols-4 gap-x-2 gap-y-4">
          {farmaciaDepartments.map(({ label, icon: Icon, search: term }) => (
            <button key={label} onClick={() => selectDepartment(term)} className="group flex min-w-0 flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-[10px] font-bold leading-tight text-foreground">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {isLoading ? (
        <PageLoader />
      ) : !produtos || produtos.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 text-muted-foreground px-4 text-center">
          <Pill className="w-12 h-12" />
          <p className="font-medium">{submittedSearch ? "Nenhum produto encontrado." : "Nenhum produto disponível ainda."}</p>
          {submittedSearch && <button onClick={() => { setSearch(""); setSubmittedSearch("") }} className="text-sm font-bold text-primary">Limpar busca</button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {produtos.map((p) => (
            <Link key={p.id} href={`/farmacia/${p.id}`}>
              <Card className="overflow-hidden active:scale-[0.98] transition-transform">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <Pill className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3 space-y-1">
                  {p.exigeReceita && <Badge variant="secondary" className="text-[10px]">Exige receita</Badge>}
                  <p className="font-bold text-sm truncate">{p.nome}</p>
                  <p className="font-black text-primary">{formatMoney(p.preco)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{p.vendorName}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
