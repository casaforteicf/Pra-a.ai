import * as React from "react"
import { ArrowLeft, ArrowRight, CalendarDays, Camera, Check, ClipboardList, FileText, Image, LoaderCircle, MapPin, Package, Plus, Sparkles, Trash2, Upload, UserRound, X } from "lucide-react"
import { Link, useLocation } from "wouter"
import { useAuth } from "@/contexts/AuthContext"
import { PracaLogo } from "@/components/brand/PracaLogo"
import { useMarketplaceCity } from "@/lib/marketplace-city"

const DRAFT_KEY = "praca-ai-quote-draft"
const UNITS = ["un", "cx", "kg", "m", "m²", "m³", "L", "saco", "rolo", "serviço", "milheiro", "par"]
const COTATION_CATEGORIES = ["Cimento e agregados","Alvenaria","Elétrica e iluminação","Hidráulica e conexões","Cobertura e telhado","Acabamentos","Ferragens e EPI","Agro e indústria","Máquinas e equipamentos","Casa e decoração","Informática e eletrônicos","Alimentos e suprimentos","Construção e reforma","Produtos e materiais","Serviços","Veículos","Agro","Outro"]
const MATERIAL_SUGGESTIONS: Record<string, {name:string;unit:string}[]> = {
  "Cimento e agregados": [{name:"Cimento CP II",unit:"saco"},{name:"Areia média",unit:"m³"},{name:"Brita nº 1",unit:"m³"},{name:"Cal hidratada",unit:"saco"}],
  "Alvenaria": [{name:"Tijolo cerâmico",unit:"milheiro"},{name:"Bloco de concreto",unit:"un"},{name:"Argamassa",unit:"saco"},{name:"Rejunte",unit:"kg"}],
  "Elétrica e iluminação": [{name:"Cabo elétrico",unit:"m"},{name:"Disjuntor",unit:"un"},{name:"Conduíte",unit:"m"},{name:"Lâmpada LED",unit:"un"}],
  "Hidráulica e conexões": [{name:"Tubo PVC",unit:"m"},{name:"Joelho PVC",unit:"un"},{name:"Registro",unit:"un"},{name:"Caixa d'água",unit:"un"}],
  "Cobertura e telhado": [{name:"Telha",unit:"un"},{name:"Madeira para estrutura",unit:"m"},{name:"Manta para telhado",unit:"m²"},{name:"Calha",unit:"m"}],
  "Acabamentos": [{name:"Piso cerâmico",unit:"m²"},{name:"Tinta",unit:"L"},{name:"Argamassa colante",unit:"saco"},{name:"Rejunte",unit:"kg"}],
  "Ferragens e EPI": [{name:"Prego",unit:"kg"},{name:"Parafuso",unit:"cx"},{name:"Disco de corte",unit:"un"},{name:"Luva de proteção",unit:"par"}],
}

type QuoteItem = { id: string; quantity: string; unit: string; description: string; brand: string }
type QuoteDraft = { category?: string; title?: string; description?: string; location?: string; date?: string; items?: QuoteItem[] }
type CatalogProduct = { id: string; name: string; specs?: { label: string; value: string }[]; vendorName?: string }

const newItem = (description = "", quantity = "1", unit = "un"): QuoteItem => ({ id: crypto.randomUUID(), quantity, unit, description, brand: "" })

function ProductDescriptionCell({ item, index, onChange, onSelect }: { item: QuoteItem; index: number; onChange: (value: string) => void; onSelect: (product: CatalogProduct) => void }) {
  const { city } = useMarketplaceCity()
  const [suggestions, setSuggestions] = React.useState<CatalogProduct[]>([])
  const [open, setOpen] = React.useState(false)
  const query = item.description.trim()

  React.useEffect(() => {
    if (query.length < 2 || !city) { setSuggestions([]); setOpen(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(query)}&limit=6&cidade=${encodeURIComponent(city)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("search failed")))
        .then((data) => { setSuggestions(data.products ?? []); setOpen(true) })
        .catch((cause) => { if (cause instanceof Error && cause.name !== "AbortError") setSuggestions([]) })
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, city])

  return <div className="relative"><input aria-label={`Descrição do item ${index+1}`} role="combobox" aria-expanded={open && suggestions.length > 0} aria-controls={`product-suggestions-${item.id}`} autoComplete="off" value={item.description} onFocus={()=>suggestions.length && setOpen(true)} onBlur={()=>window.setTimeout(()=>setOpen(false),150)} onChange={(event)=>onChange(event.target.value)} placeholder="Digite para buscar no catálogo" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#0077FF] focus:outline-none" />
    {open && suggestions.length ? <div id={`product-suggestions-${item.id}`} role="listbox" className="absolute left-0 right-0 top-11 z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{suggestions.map((product)=>{ const brand = product.specs?.find((spec)=>spec.label.toLowerCase()==="marca")?.value; return <button key={product.id} type="button" role="option" aria-selected="false" onMouseDown={(event)=>event.preventDefault()} onClick={()=>{onSelect(product);setOpen(false)}} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50"><span className="block text-sm font-bold text-[#0b2742]">{product.name}</span><span className="block text-xs text-slate-500">{[brand,product.vendorName].filter(Boolean).join(" · ")}</span></button>})}</div> : null}
  </div>
}

function textToItems(text: string): QuoteItem[] {
  const ignored = /^(orçamento|orcamento|lista|item|descrição|descricao|produto|quantidade|qtd|unidade|valor|total|subtotal|cliente|fornecedor|cnpj|cpf|data)\b/i
  return text.split(/\r?\n/).map((line) => line.replace(/[|;\t]+/g, " ").replace(/\s{2,}/g, " ").trim()).filter((line) => line.length > 2 && !ignored.test(line) && !/^r?\$?\s*[\d.,]+$/i.test(line)).slice(0, 80).map((line) => {
    const clean = line.replace(/^\d+[.)-]\s*/, "").replace(/\s+r?\$\s*[\d.,]+(?:\s+r?\$\s*[\d.,]+)?$/i, "").trim()
    const match = clean.match(/^(\d+(?:[.,]\d+)?)\s*(un|und|unid|cx|caixa|kg|g|m²|m2|m³|m3|m|l|lt|litros?|sacos?|rolos?|serviços?)?\s*[-–x:]?\s*(.+)$/i)
    if (!match) return newItem(clean)
    const normalizedUnit = match[2]?.toLowerCase().replace("und", "un").replace("unid", "un").replace("caixa", "cx").replace("m2", "m²").replace("m3", "m³").replace(/^lt$|^litros?$/, "L").replace(/sacos?/, "saco").replace(/rolos?/, "rolo").replace(/serviços?/, "serviço") ?? "un"
    return newItem(match[3].trim(), match[1].replace(",", "."), normalizedUnit)
  }).filter((item) => item.description.length > 1)
}

async function readPdf(file: File) {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 20); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const lines = new Map<number, string[]>()
    for (const item of content.items) {
      if (!("str" in item) || !("transform" in item)) continue
      const row = Math.round(item.transform[5] / 4) * 4
      lines.set(row, [...(lines.get(row) ?? []), item.str])
    }
    pages.push([...lines.entries()].sort(([first], [second]) => second - first).map(([, words]) => words.join(" ")).join("\n"))
  }
  return pages.join("\n")
}

async function readImage(file: File, onProgress: (value: number) => void) {
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker("por", undefined, { logger: (message) => message.status === "recognizing text" && onProgress(Math.round(message.progress * 100)) })
  try { return (await worker.recognize(file)).data.text } finally { await worker.terminate() }
}

export default function QuoteRequest() {
  const [, navigate] = useLocation()
  const { user } = useAuth()
  const { city, state } = useMarketplaceCity()
  const fileInput = React.useRef<HTMLInputElement>(null)
  const cameraInput = React.useRef<HTMLInputElement>(null)
  const [saved, setSaved] = React.useState(false)
  const [processing, setProcessing] = React.useState("")
  const [progress, setProgress] = React.useState(0)
  const [error, setError] = React.useState("")
  const [result, setResult] = React.useState<{ id: string; protocol: string; recipients: number } | null>(null)
  const [form, setForm] = React.useState<QuoteDraft>(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as QuoteDraft } catch { return {} }
  })
  React.useEffect(() => {
    if (!form.location && city) update("location", `${city}${state ? `, ${state}` : ""}`)
  }, [city, state])
  const items = (form.items ?? []).map((item) => ({ ...item, brand: item.brand ?? "" }))
  const update = (field: keyof QuoteDraft, value: QuoteDraft[keyof QuoteDraft]) => setForm((current) => ({ ...current, [field]: value }))
  const updateItem = (id: string, field: keyof QuoteItem, value: string) => update("items", items.map((item) => item.id === id ? { ...item, [field]: value } : item))
  const selectProduct = (id: string, product: CatalogProduct) => {
    const brand = product.specs?.find((spec) => spec.label.toLowerCase() === "marca")?.value ?? ""
    update("items", items.map((item) => item.id === id ? { ...item, description: product.name, brand } : item))
  }

  const importFile = async (file?: File) => {
    if (!file) return
    setError(""); setProgress(0); setProcessing(file.name)
    try {
      let text = ""
      if (file.type.startsWith("image/")) text = await readImage(file, setProgress)
      else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) text = await readPdf(file)
      else text = await file.text()
      const extracted = textToItems(text)
      if (!extracted.length) throw new Error("Não encontrei itens legíveis. Tente uma foto mais nítida ou adicione os itens manualmente.")
      update("items", [...items, ...extracted])
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ler esse arquivo.") }
    finally { setProcessing(""); setProgress(0); if (fileInput.current) fileInput.current.value = ""; if (cameraInput.current) cameraInput.current.value = "" }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const completeItems = items.filter((item) => item.description.trim())
    if (!completeItems.length) { setError("Adicione pelo menos um item à lista."); return }
    const draft = { ...form, items: completeItems }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    if (!user) { navigate("/login?returnTo=/cotacao&intent=cotacao"); return }
    setProcessing("Enviando solicitação")
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível enviar a cotação.")
      setResult({ id: payload.id, protocol: payload.protocol, recipients: payload.recipients ?? 0 })
      localStorage.removeItem(DRAFT_KEY)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a cotação.")
    } finally {
      setProcessing("")
    }
  }

  return <div className="min-h-full bg-[#F8FAFC] text-[#0B2240]">
    <header className="border-b border-[#E5EAF0] bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"><Link href="/" aria-label="Praça.ai — página inicial"><PracaLogo /></Link><Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft className="h-4 w-4" />Voltar</Link></div></header>
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[.72fr_1.28fr] lg:py-12">
      <aside className="rounded-3xl bg-[#0B2240] p-7 text-white lg:sticky lg:top-8 lg:h-fit"><span className="inline-flex rounded-full bg-[#10D3B8] px-3 py-1 text-xs font-extrabold text-[#0B2240]">Aberto para todos</span><h1 className="mt-5 font-[Manrope] text-3xl font-extrabold leading-tight">Peça uma cotação na sua cidade.</h1><p className="mt-3 text-sm leading-relaxed text-white/75">Importe um orçamento, envie sua lista ou tire uma foto. O Praça.ai organiza os itens para você revisar antes de consultar fornecedores.</p><ol className="mt-7 space-y-5 text-sm">{[[Package,"Escolha o segmento"],[Sparkles,"Importe ou adicione materiais"],[ClipboardList,"Revise quantidades e itens"],[UserRound,"Identifique-se para acompanhar"]].map(([Icon,text],index)=><li key={text as string} className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10"><Icon className="h-4 w-4" /></span><span><strong className="mr-2 text-[#10D3B8]">{index+1}.</strong>{text as string}</span></li>)}</ol></aside>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(11,39,66,.08)] sm:p-8">
        {saved ? <div className="flex min-h-[440px] flex-col items-center justify-center text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-[#DDF9F4] text-[#008F76]"><Check className="h-8 w-8" /></span><h2 className="mt-5 font-[Manrope] text-2xl font-extrabold">Cotação enviada</h2><p className="mt-2 max-w-md text-sm text-slate-600">Sua solicitação foi registrada com o protocolo <strong>{result?.protocol}</strong>{result?.recipients ? ` e distribuída para ${result.recipients} fornecedor${result.recipients === 1 ? "" : "es"}.` : ". Ela está aguardando fornecedores compatíveis."}</p><Link href={result?.id ? `/cotacao/${result.id}` : "/"} className="mt-6 rounded-xl bg-[#0077FF] px-5 py-3 text-sm font-extrabold text-white">Acompanhar propostas</Link><Link href="/" className="mt-3 text-sm font-bold text-slate-600">Voltar ao início</Link></div> : <form onSubmit={(event)=>void submit(event)} className="space-y-6">
          <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#0077FF]">Nova solicitação</p><h2 className="mt-1 font-[Manrope] text-2xl font-extrabold">Monte sua lista de cotação</h2><p className="mt-1 text-sm text-slate-500">Escolha o segmento primeiro; depois adicione materiais por busca, foto ou arquivo.</p></div>
           <div className="rounded-2xl border border-[#BCEDE5] bg-[#F0FCFA] p-4"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#087E8B]">Etapa 1 · Categoria</p><label className="mt-2 block text-sm font-bold">O que você precisa comprar?<select required value={form.category ?? ""} onChange={(event)=>update("category",event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal"><option value="">Selecione um segmento</option>{COTATION_CATEGORIES.map((category)=><option key={category}>{category}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Título da necessidade<input required value={form.title ?? ""} onChange={(event)=>update("title",event.target.value)} placeholder="Ex.: materiais para reforma" className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal" /></label></div>
           {form.category && MATERIAL_SUGGESTIONS[form.category]?.length ? <div><p className="mb-2 text-sm font-bold">Materiais comuns neste segmento</p><div className="flex flex-wrap gap-2">{MATERIAL_SUGGESTIONS[form.category].map((product)=><button key={product.name} type="button" onClick={()=>{if(!items.some((item)=>item.description.trim().toLocaleLowerCase("pt-BR")===product.name.toLocaleLowerCase("pt-BR")))update("items",[...items,newItem(product.name,"1",product.unit)])}} className="rounded-full border border-[#BCEDE5] bg-[#F0FCFA] px-3 py-2 text-xs font-bold text-[#087E8B] hover:bg-[#DDF9F4]">+ {product.name}</button>)}</div></div> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" disabled={!form.category} onClick={()=>fileInput.current?.click()} className="flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3 text-center text-sm font-bold hover:border-[#0077FF] hover:bg-blue-50"><Upload className="mb-2 h-6 w-6 text-[#0077FF]" />Importar orçamento<span className="mt-1 text-[11px] font-normal text-slate-500">PDF, CSV ou TXT</span></button>
            <button type="button" disabled={!form.category} onClick={()=>cameraInput.current?.click()} className="flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3 text-center text-sm font-bold hover:border-[#0077FF] hover:bg-blue-50"><Camera className="mb-2 h-6 w-6 text-[#0077FF]" />Tirar foto<span className="mt-1 text-[11px] font-normal text-slate-500">Lista escrita ou impressa</span></button>
            <button type="button" disabled={!form.category} onClick={()=>update("items", [...items, newItem()])} className="flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3 text-center text-sm font-bold hover:border-[#0077FF] hover:bg-blue-50"><Plus className="mb-2 h-6 w-6 text-[#0077FF]" />Adicionar item<span className="mt-1 text-[11px] font-normal text-slate-500">Preencher manualmente</span></button>
            <input ref={fileInput} type="file" className="hidden" accept=".pdf,.csv,.txt,text/plain,text/csv,application/pdf,image/*" onChange={(event)=>void importFile(event.target.files?.[0])} />
            <input ref={cameraInput} type="file" className="hidden" accept="image/*" capture="environment" onChange={(event)=>void importFile(event.target.files?.[0])} />
          </div>
          {processing ? <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-center gap-3"><LoaderCircle className="h-5 w-5 animate-spin text-[#0870c9]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">Lendo {processing}</p><p className="text-xs text-slate-500">{progress ? `Reconhecendo texto: ${progress}%` : "Extraindo e organizando os itens…"}</p></div></div>{progress ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-[#0870c9] transition-all" style={{ width: `${progress}%` }} /></div> : null}</div> : null}
          {error ? <div role="alert" className="flex items-start justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setError("")}><X className="h-4 w-4" /></button></div> : null}
          <div className="space-y-3"><div className="flex items-end justify-between"><div><h3 className="font-extrabold">Tabela de itens</h3><p className="text-xs text-slate-500">Revise e edite diretamente nas células.</p></div><span className="rounded-full bg-[#fff4bd] px-3 py-1 text-xs font-extrabold">{items.length} {items.length === 1 ? "item" : "itens"}</span></div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[790px] border-collapse text-left text-sm">
                <thead className="bg-[#0B2240] text-white"><tr><th scope="col" className="w-12 px-3 py-3 text-center text-xs font-extrabold">Nº</th><th scope="col" className="w-24 px-3 py-3 text-xs font-extrabold">Quantidade</th><th scope="col" className="w-24 px-3 py-3 text-xs font-extrabold">Unidade</th><th scope="col" className="px-3 py-3 text-xs font-extrabold">Descrição do item</th><th scope="col" className="w-36 px-3 py-3 text-xs font-extrabold">Marca</th><th scope="col" className="w-14 px-3 py-3 text-center text-xs font-extrabold">Ação</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length ? items.map((item,index)=><tr key={item.id} className="bg-white hover:bg-slate-50"><td className="px-3 py-2 text-center font-bold text-slate-500">{index+1}</td><td className="p-2"><input aria-label={`Quantidade do item ${index+1}`} inputMode="decimal" value={item.quantity} onChange={(event)=>updateItem(item.id,"quantity",event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900 focus:border-[#0870c9] focus:outline-none" /></td><td className="p-2"><select aria-label={`Unidade do item ${index+1}`} value={item.unit} onChange={(event)=>updateItem(item.id,"unit",event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-[#0870c9] focus:outline-none">{UNITS.map((unit)=><option key={unit}>{unit}</option>)}</select></td><td className="p-2"><ProductDescriptionCell item={item} index={index} onChange={(value)=>updateItem(item.id,"description",value)} onSelect={(product)=>selectProduct(item.id,product)} /></td><td className="p-2"><input aria-label={`Marca do item ${index+1}`} value={item.brand} onChange={(event)=>updateItem(item.id,"brand",event.target.value)} placeholder="Opcional" className="h-10 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-900 focus:border-[#0870c9] focus:outline-none" /></td><td className="p-2 text-center"><button type="button" aria-label={`Excluir item ${index+1}`} onClick={()=>update("items",items.filter((current)=>current.id!==item.id))} className="inline-grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td></tr>) : <tr><td colSpan={6} className="h-32 bg-slate-50 px-4 text-center"><FileText className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 font-bold text-slate-600">Nenhum item adicionado</p><p className="text-xs text-slate-400">Importe um documento, tire uma foto ou adicione manualmente.</p></td></tr>}
                </tbody>
              </table>
            </div>
            <button type="button" disabled={!form.category} onClick={()=>update("items", [...items, newItem()])} className="flex items-center gap-2 text-sm font-extrabold text-[#0077FF] disabled:opacity-50"><Plus className="h-4 w-4" />Adicionar nova linha</button>
          </div>
          <label className="block text-sm font-bold">Observações <span className="font-normal text-slate-400">(opcional)</span><textarea value={form.description ?? ""} onChange={(event)=>update("description",event.target.value)} placeholder="Marcas preferidas, medidas ou detalhes importantes" className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold"><MapPin className="mr-1 inline h-4 w-4" />Cidade ou região<input required value={form.location ?? ""} onChange={(event)=>update("location",event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 font-normal" /></label><label className="text-sm font-bold"><CalendarDays className="mr-1 inline h-4 w-4" />Quando precisa?<input type="date" value={form.date ?? ""} onChange={(event)=>update("date",event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 font-normal" /></label></div>
          <div className="rounded-2xl bg-[#F8FAFC] p-4 text-sm leading-6 text-slate-600"><Image className="mr-2 inline h-4 w-4 text-[#0077FF]" />Fotos e documentos são processados neste dispositivo. Seu rascunho fica salvo localmente.<p className="mt-2"><strong>Privacidade:</strong> lojistas recebem a lista e a cidade selecionada. Nome, telefone e e-mail ficam ocultos até você aceitar uma proposta. Não informe endereço completo.</p></div>
          <button type="submit" disabled={Boolean(processing)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0077FF] px-5 py-3.5 font-extrabold text-white shadow-[0_8px_22px_rgba(0,119,255,.25)] disabled:cursor-wait disabled:opacity-60">{user ? "Salvar solicitação" : "Continuar e identificar-me"}<ArrowRight className="h-4 w-4" /></button>
        </form>}
      </section>
    </main>
  </div>
}
