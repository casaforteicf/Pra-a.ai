import * as React from "react"
import { MapPin, ChevronDown } from "lucide-react"
import { useMarketplaceCity } from "@/lib/marketplace-city"

export function MarketplaceCityPicker({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  const { city, state, setLocation } = useMarketplaceCity()
  const [open, setOpen] = React.useState(false)
  const [draftCity, setDraftCity] = React.useState(city)
  const [draftState, setDraftState] = React.useState(state)

  React.useEffect(() => {
    setDraftCity(city)
    setDraftState(state)
  }, [city, state])

  const label = city ? `${city}${state ? `, ${state}` : ""}` : "Escolha sua cidade"
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="relative shrink-0">
    <summary className={compact
      ? "flex h-8 cursor-pointer list-none items-center gap-2 bg-[#F8FAFC] px-4 text-xs text-[#0B2240]"
       : inverse ? "flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white/85 hover:bg-white/10" : "flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-[#0B2240] shadow-sm hover:bg-slate-50"}>
      <MapPin className={compact ? "h-3.5 w-3.5" : "h-5 w-5 text-[#10D3B8]"} />
      <span>{compact ? "Entregas para " : "Entregar em"}<strong className={compact ? "ml-1" : inverse ? "mt-0.5 block text-white" : "mt-0.5 block text-[#0B2240]"}>{label}</strong></span>
      {!compact && <ChevronDown className="h-3.5 w-3.5" />}
    </summary>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (!draftCity.trim() || !draftState.trim()) return
      setLocation({ city: draftCity, state: draftState })
      setOpen(false)
    }} className="absolute left-0 top-full z-[60] mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 text-[#0B2240] shadow-xl">
      <p className="text-sm font-extrabold">Escolha seu município</p>
      <p className="mt-1 text-xs text-slate-500">O catálogo e as rodadas serão desta cidade.</p>
      <label className="mt-3 block text-xs font-bold">Cidade<input autoComplete="address-level2" required maxLength={100} value={draftCity} onChange={(e) => setDraftCity(e.target.value)} placeholder="Ex.: Chapecó" className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-normal" /></label>
      <label className="mt-2 block text-xs font-bold">UF<input autoComplete="address-level1" required maxLength={2} value={draftState} onChange={(e) => setDraftState(e.target.value.toUpperCase().slice(0, 2))} placeholder="Ex.: SC" className="mt-1 h-10 w-full rounded-lg border px-3 text-sm font-normal uppercase" /></label>
      <button className="mt-3 h-10 w-full rounded-lg bg-[#10D3B8] text-sm font-extrabold text-[#0B2240]">Usar esta cidade</button>
    </form>
  </details>
}
