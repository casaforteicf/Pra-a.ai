import * as React from "react"
import { useLocation, Link } from "wouter"
import { ChevronLeft, Home as HomeIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageLoader } from "@/components/ui/skeleton"

interface Imovel {
  id: string
  titulo: string
  tipo: string
  finalidade: string
  bairro: string | null
  cidade: string | null
  areaM2: number | null
  quartos: number | null
  valor: number
  imageUrl: string | null
  vendorName: string
}

export default function ImoveisListing() {
  const [, setLocation] = useLocation()

  const { data: imoveis, isLoading } = useQuery<Imovel[]>({
    queryKey: ["imoveis"],
    queryFn: () => fetch("/api/imoveis").then((r) => r.json()),
  })

  return (
    <div className="flex flex-col w-full min-h-full pb-8 bg-background">
      <header className="sticky top-0 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/")}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black">Imóveis</h1>
            {imoveis && <p className="text-xs text-muted-foreground font-bold">{imoveis.length} disponíveis</p>}
          </div>
        </div>
      </header>

      {isLoading ? (
        <PageLoader />
      ) : !imoveis || imoveis.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 text-muted-foreground">
          <HomeIcon className="w-12 h-12" />
          <p className="font-medium">Nenhum imóvel disponível na sua região ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {imoveis.map((im) => (
            <Link key={im.id} href={`/imoveis/${im.id}`}>
              <Card className="overflow-hidden active:scale-[0.98] transition-transform">
                <div className="aspect-video bg-muted flex items-center justify-center">
                  {im.imageUrl ? (
                    <img src={im.imageUrl} alt={im.titulo} className="w-full h-full object-cover" />
                  ) : (
                    <HomeIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <Badge variant="secondary" className="text-[10px]">{im.finalidade === "aluguel" ? "Aluguel" : "Venda"}</Badge>
                  <p className="font-bold text-sm truncate">{im.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {im.bairro ?? im.cidade ?? "—"} {im.quartos ? `· ${im.quartos} qts` : ""} {im.areaM2 ? `· ${im.areaM2}m²` : ""}
                  </p>
                  <p className="font-black text-primary">{formatMoney(im.valor)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{im.vendorName}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
