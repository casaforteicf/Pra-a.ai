import * as React from "react"
import { Link } from "wouter"
import { Sparkles, MapPin, ChefHat, Tag, Percent, Play } from "lucide-react"

export interface VariedadeDiaItem {
  id: string
  categoria: string
  titulo: string
  conteudoTexto: string | null
  videoUrl: string | null
  imagemUrl: string | null
  promocaoTipo: "produto" | "texto_livre" | null
  promocaoProdutoId: string | null
  promocaoProdutoNome: string | null
  promocaoDescontoPercentual: string | null
  promocaoTexto: string | null
  tenantId: string
  tenantName: string
  tenantSlug: string
}

const CATEGORIA_INFO: Record<string, { label: string; icon: typeof MapPin; colors: string }> = {
  viagens: { label: "Viagens", icon: MapPin, colors: "from-sky-600 via-blue-600 to-indigo-700" },
  receitas: { label: "Receitas", icon: ChefHat, colors: "from-amber-600 via-orange-500 to-rose-500" },
  variedades: { label: "Variedades", icon: Sparkles, colors: "from-slate-800 via-indigo-700 to-blue-500" },
}

function VariedadeCard({ item }: { item: VariedadeDiaItem }) {
  const info = CATEGORIA_INFO[item.categoria] ?? { label: item.categoria, icon: Tag, colors: "from-emerald-700 via-teal-600 to-sky-500" }

  return (
    <div className={`relative flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br ${info.colors} p-6 text-white shadow-lg`}>
      {item.videoUrl && (
        <video src={item.videoUrl} className="absolute inset-0 h-full w-full object-cover opacity-40" autoPlay muted loop playsInline />
      )}
      <div className="relative z-10 space-y-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
          <info.icon className="h-3.5 w-3.5" /> {info.label}
        </span>
        <p className="text-xs font-semibold text-white/80">Por {item.tenantName}</p>
        <h3 className="text-2xl font-black leading-tight">{item.titulo}</h3>
        {item.conteudoTexto && <p className="text-sm text-white/90 line-clamp-3">{item.conteudoTexto}</p>}
        {item.videoUrl && !item.conteudoTexto && (
          <span className="flex items-center gap-1.5 text-sm text-white/90"><Play className="h-4 w-4" /> Vídeo do parceiro</span>
        )}

        {item.promocaoTipo && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2">
            <Percent className="h-4 w-4 shrink-0" />
            <p className="text-sm font-bold">
              {item.promocaoTipo === "produto"
                ? `${item.promocaoProdutoNome ?? "Produto"} com ${item.promocaoDescontoPercentual}% off`
                : item.promocaoTexto}
            </p>
          </div>
        )}

        <Link
          href={item.promocaoTipo === "produto" && item.promocaoProdutoId ? `/product/${item.promocaoProdutoId}` : `/listing?vendor=${item.tenantSlug}`}
          className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900"
        >
          {item.promocaoTipo === "produto" ? "Ver produto" : "Conhecer a loja"}
        </Link>
      </div>
    </div>
  )
}

// Substitui o antigo carrossel fixo (4 textos que giravam por dia da
// semana, sem parceiro nenhum por trás) — agora é conteúdo real, 1 vaga
// por categoria por dia, publicado pelos próprios lojistas. Se ninguém
// publicou nada hoje, a seção inteira some (sem fallback).
export function VariedadesDiaSection({ variedades }: { variedades: VariedadeDiaItem[] }) {
  if (variedades.length === 0) return null

  return (
    <section className="mx-auto my-7 w-full max-w-6xl sm:my-10">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-lg font-black"><Sparkles className="h-5 w-5 text-primary" /> Para descobrir hoje</h2>
      </div>
      <div className="grid gap-4 px-1 sm:grid-cols-2 lg:grid-cols-3">
        {variedades.map((item) => <VariedadeCard key={item.id} item={item} />)}
      </div>
    </section>
  )
}
