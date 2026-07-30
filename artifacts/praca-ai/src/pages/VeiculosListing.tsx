import * as React from "react"
import { useLocation, Link } from "wouter"
import { ChevronLeft, Car } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { formatMoney } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { PageLoader } from "@/components/ui/skeleton"

interface Veiculo {
  id: string
  marca: string
  modelo: string
  anoModelo: number | null
  km: number | null
  preco: number
  precoOriginal: number | null
  imageUrl: string | null
  vendorName: string
}

export default function VeiculosListing() {
  const [, setLocation] = useLocation()

  const { data: veiculos, isLoading } = useQuery<Veiculo[]>({
    queryKey: ["veiculos"],
    queryFn: () => fetch("/api/veiculos").then((r) => r.json()),
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
            <h1 className="text-xl font-black">Veículos</h1>
            {veiculos && <p className="text-xs text-muted-foreground font-bold">{veiculos.length} disponíveis</p>}
          </div>
        </div>
      </header>

      {isLoading ? (
        <PageLoader />
      ) : !veiculos || veiculos.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 text-muted-foreground">
          <Car className="w-12 h-12" />
          <p className="font-medium">Nenhum veículo disponível na sua região ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {veiculos.map((v) => (
            <Link key={v.id} href={`/veiculos/${v.id}`}>
              <Card className="overflow-hidden active:scale-[0.98] transition-transform">
                <div className="aspect-video bg-muted flex items-center justify-center">
                  {v.imageUrl ? (
                    <img src={v.imageUrl} alt={`${v.marca} ${v.modelo}`} className="w-full h-full object-cover" />
                  ) : (
                    <Car className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="font-bold text-sm truncate">{v.marca} {v.modelo}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.anoModelo ?? "—"} · {v.km != null ? `${v.km.toLocaleString("pt-BR")} km` : "km não informado"}
                  </p>
                  <p className="font-black text-primary">{formatMoney(v.preco)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{v.vendorName}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
