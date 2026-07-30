import * as React from "react"
import { useLocation, Link } from "wouter"
import { ChevronLeft, UtensilsCrossed } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { PageLoader } from "@/components/ui/skeleton"

interface Restaurante {
  vendorId: string
  vendorName: string
}

export default function RestaurantesListing() {
  const [, setLocation] = useLocation()

  const { data: restaurantes, isLoading } = useQuery<Restaurante[]>({
    queryKey: ["restaurantes"],
    queryFn: () => fetch("/api/restaurantes").then((r) => r.json()),
  })

  return (
    <div className="flex flex-col w-full min-h-full pb-8 bg-background">
      <header className="sticky top-0 inset-x-0 bg-background/95 backdrop-blur-md z-30 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black">Restaurantes</h1>
        </div>
      </header>

      {isLoading ? (
        <PageLoader />
      ) : !restaurantes || restaurantes.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 text-muted-foreground">
          <UtensilsCrossed className="w-12 h-12" />
          <p className="font-medium">Nenhum restaurante disponível ainda.</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {restaurantes.map((r) => (
            <Link key={r.vendorId} href={`/restaurantes/${r.vendorId}`}>
              <Card className="p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="font-bold">{r.vendorName}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
