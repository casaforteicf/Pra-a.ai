import * as React from "react"
import { useLocation, Link } from "wouter"
import { ChevronLeft, Pill } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

export default function FarmaciaListing() {
  const [, setLocation] = useLocation()

  const { data: produtos, isLoading } = useQuery<FarmaciaProduto[]>({
    queryKey: ["farmacia-produtos"],
    queryFn: () => fetch("/api/farmacia/produtos").then((r) => r.json()),
  })

  return (
    <div className="flex flex-col w-full min-h-full pb-8 bg-background">
      <header className="sticky top-0 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black">Farmácia</h1>
        </div>
      </header>

      {isLoading ? (
        <PageLoader />
      ) : !produtos || produtos.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 text-muted-foreground">
          <Pill className="w-12 h-12" />
          <p className="font-medium">Nenhum produto disponível ainda.</p>
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
