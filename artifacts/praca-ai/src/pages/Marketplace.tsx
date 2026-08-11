import * as React from "react"
import { Link } from "wouter"
import { MapPin, MessageCircle, PackageOpen, Plus, Search, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { ProductCard } from "@/components/ProductCard"
import type { Product } from "@workspace/api-client-react"

type Listing = { id: string; title: string; description: string; price: number; category: string; condition: string; imageUrls: string[]; city: string; state: string; sellerName: string; sellerPhone?: string | null }
const conditionLabel: Record<string, string> = { new: "Novo", like_new: "Seminovo", good: "Bom estado", used: "Usado" }

export default function Marketplace() {
  const { user } = useAuth()
  const [listings, setListings] = React.useState<Listing[]>([])
  const [partnerProducts, setPartnerProducts] = React.useState<Product[]>([])
  const [categories, setCategories] = React.useState<string[]>([])
  const [category, setCategory] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => { fetch("/api/marketplace/categories").then((r) => r.json()).then(setCategories) }, [])
  React.useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category) params.set("category", category)
    if (search.trim()) params.set("search", search.trim())
    const timer = window.setTimeout(() => {
      fetch(`/api/marketplace?${params}`).then((r) => r.json()).then(setListings).finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [category, search])
  React.useEffect(() => {
    const slug = category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    const params = new URLSearchParams({ limit: "40" })
    if (slug) params.set("category", slug)
    if (search.trim()) params.set("search", search.trim())
    fetch(`/api/products?${params}`).then((r) => r.json()).then((data) => setPartnerProducts(data.products ?? []))
  }, [category, search])

  return <div className="min-h-full bg-background pb-10">
    <header className="bg-primary px-4 py-8 text-primary-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.2em]">Compra e venda local</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-black"><Store className="h-8 w-8" />Marketplace</h1><p className="mt-2 max-w-xl text-sm opacity-80">Itens novos e usados anunciados por pessoas da sua região.</p></div>
          <Button asChild variant="secondary"><Link href={user ? "/account/listings" : "/login"}><Plus className="mr-2 h-4 w-4" />Anunciar um item</Link></Button>
        </div>
        <div className="relative mt-5 max-w-2xl"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nos anúncios" className="h-12 bg-card pl-12 text-foreground" /></div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 py-5">
      <div className="flex gap-2 overflow-x-auto pb-3"><button onClick={() => setCategory("")} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${!category ? "bg-primary text-primary-foreground" : "bg-card"}`}>Todas</button>{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${category === item ? "bg-primary text-primary-foreground" : "bg-card"}`}>{item}</button>)}</div>
      {partnerProducts.length > 0 && <section className="pt-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Lojas parceiras</p><h2 className="text-xl font-black">Produtos novos</h2></div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{partnerProducts.map((product) => <ProductCard key={product.id} product={product} compact />)}</div></section>}
      <section className="pt-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Pessoa física</p><h2 className="text-xl font-black">Itens anunciados na sua região</h2></section>
      {loading ? <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div> : listings.length ? <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 lg:grid-cols-4">{listings.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="aspect-square bg-muted">{item.imageUrls[0] ? <img src={item.imageUrls[0]} alt={item.title} className="h-full w-full object-cover" /> : <PackageOpen className="m-auto h-full w-12 text-muted-foreground" />}</div><div className="p-3"><span className="text-[10px] font-bold uppercase text-primary">{conditionLabel[item.condition]} · {item.category}</span><h2 className="mt-1 line-clamp-2 text-sm font-black">{item.title}</h2><p className="mt-2 text-lg font-black text-primary">{formatMoney(item.price)}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{item.city}/{item.state}</p>{item.sellerPhone && <a href={`https://wa.me/55${item.sellerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, vi o anúncio ${item.title} na Praça.ai`)}`} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1 rounded-xl bg-primary px-2 py-2 text-xs font-black text-primary-foreground"><MessageCircle className="h-4 w-4" />Falar com anunciante</a>}</div></article>)}</div> : <div className="mt-8 rounded-2xl border border-dashed p-12 text-center"><PackageOpen className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-3 font-black">Nenhum anúncio encontrado</h2><p className="mt-1 text-sm text-muted-foreground">Tente outra categoria ou seja o primeiro a anunciar.</p></div>}
    </main>
  </div>
}
