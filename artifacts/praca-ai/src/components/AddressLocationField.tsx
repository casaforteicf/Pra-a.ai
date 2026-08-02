import * as React from "react"
import { Loader2, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LocationPickerMap } from "@/components/LocationPickerMap"

type Point = { lat: number; lng: number }
type Mode = "endereco" | "cep" | "mapa"
type SearchResult = Point & { address: string }

interface AddressLocationFieldProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  point: Point | null
  onPointChange: (point: Point | null) => void
}

export function AddressLocationField({ label, value, onValueChange, point, onPointChange }: AddressLocationFieldProps) {
  const [mode, setMode] = React.useState<Mode>("endereco")
  const [query, setQuery] = React.useState(value)
  const [cep, setCep] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => { if (!query && value) setQuery(value) }, [query, value])

  const choose = (result: SearchResult) => {
    onValueChange(result.address)
    onPointChange({ lat: result.lat, lng: result.lng })
    setQuery(result.address)
    setResults([])
    setError("")
  }

  const search = async () => {
    if (query.trim().length < 3) { setError("Digite ao menos 3 caracteres."); return }
    setLoading(true); setError("")
    try {
      const response = await fetch(`/api/localizacao/busca?q=${encodeURIComponent(query.trim())}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setResults(data)
      if (!data.length) setError("Nenhum local encontrado. Tente incluir cidade e estado.")
    } catch (err: any) { setError(err.message || "Não foi possível buscar o endereço.") }
    finally { setLoading(false) }
  }

  const searchCep = async () => {
    const cleanCep = cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) { setError("Informe um CEP com 8 números."); return }
    setLoading(true); setError("")
    try {
      const response = await fetch(`/api/localizacao/cep?cep=${cleanCep}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      onValueChange(data.address)
      setQuery(data.address)
      if (data.lat != null && data.lng != null) onPointChange({ lat: data.lat, lng: data.lng })
    } catch (err: any) { setError(err.message || "Não foi possível consultar o CEP.") }
    finally { setLoading(false) }
  }

  const pickOnMap = async (nextPoint: Point | null) => {
    onPointChange(nextPoint)
    if (!nextPoint) return
    setLoading(true); setError("")
    try {
      const response = await fetch(`/api/localizacao/reversa?lat=${nextPoint.lat}&lng=${nextPoint.lng}`)
      const data = await response.json()
      if (response.ok && data.address) { onValueChange(data.address); setQuery(data.address) }
    } finally { setLoading(false) }
  }

  return (
    <fieldset className="space-y-3 rounded-xl border bg-background p-3">
      <legend className="px-1 text-sm font-black">{label}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {([['endereco','Endereço'],['cep','CEP'],['mapa','Mapa']] as Array<[Mode,string]>).map(([id, text]) => <button key={id} type="button" onClick={() => { setMode(id); setError("") }} className={`rounded-md px-2 py-2 text-xs font-bold ${mode === id ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}>{text}</button>)}
      </div>

      {mode === "endereco" && <div className="space-y-2"><div className="flex gap-2"><Input value={query} onChange={(event) => { setQuery(event.target.value); onValueChange(event.target.value) }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search() } }} placeholder="Rua, número, bairro, cidade" /><Button type="button" variant="outline" size="icon" disabled={loading} onClick={search} aria-label="Buscar endereço">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></div>{results.length > 0 && <div className="max-h-52 overflow-y-auto rounded-lg border bg-background shadow-sm">{results.map((result) => <button key={`${result.lat}-${result.lng}`} type="button" onClick={() => choose(result)} className="flex w-full gap-2 border-b p-3 text-left text-xs last:border-0 hover:bg-muted"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{result.address}</span></button>)}</div>}</div>}

      {mode === "cep" && <div className="space-y-2"><div className="flex gap-2"><Input inputMode="numeric" value={cep} onChange={(event) => setCep(event.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchCep() } }} placeholder="00000000" /><Button type="button" disabled={loading} onClick={searchCep}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Buscar CEP</Button></div><p className="text-xs text-muted-foreground">Depois de localizar o CEP, acrescente número e complemento no endereço.</p></div>}

      {mode === "mapa" && <div className="space-y-2"><p className="text-xs text-muted-foreground">Toque no mapa para marcar o ponto exato. O endereço será identificado automaticamente.</p><LocationPickerMap value={point} onChange={pickOnMap} /></div>}

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>}
      {value && <div className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><strong className="block text-foreground">Endereço selecionado</strong><span className="text-muted-foreground">{value}</span></span></div>}
    </fieldset>
  )
}
