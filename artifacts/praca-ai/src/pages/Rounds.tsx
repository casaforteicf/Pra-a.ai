import * as React from "react"
import { ArrowRight, Building2, ChevronDown, CircleDollarSign, Clock3, Package, Plus, ShieldCheck, Store, Users, X } from "lucide-react"
import { Link, useLocation } from "wouter"
import { useAuth } from "@/contexts/AuthContext"
import { MarketplaceCityPicker } from "@/components/MarketplaceCityPicker"
import { useMarketplaceCity } from "@/lib/marketplace-city"

type Round = {
  id: string; code: string; category: string; itemName: string; specification?: string | null
  unit: string; city: string; state: string; neededAt: string; closesAt: string; totalQuantity: number
}
type RoundOrder = {
  id: string; status: string; quantity: number; total: number; code: string; itemName: string
  unit: string; neededAt: string; total?: number | null; deliveryDays?: number | null; vendor?: { id: string; name: string; storeUrl: string } | null
}
const SEGMENTS = ["Construção e agregados","Alvenaria","Elétrica e iluminação","Hidráulica e conexões","Cobertura e telhado","Acabamentos","Ferragens e EPI","Agro e indústria","Máquinas e equipamentos","Casa e decoração","Informática e eletrônicos","Alimentos e suprimentos"]
const UNITS = ["un","cx","kg","m","m²","m³","L","saco","rolo","milheiro"]

export default function RoundsPage() {
  const { user } = useAuth()
  const { city, state } = useMarketplaceCity()
  const [, navigate] = useLocation()
  const [rounds,setRounds]=React.useState<Round[]>([])
  const [orders,setOrders]=React.useState<RoundOrder[]>([])
  const [segment,setSegment]=React.useState("Todos os segmentos")
  const [showDemand,setShowDemand]=React.useState(false)
  const [selected,setSelected]=React.useState<Round|null>(null)
  const [quantity,setQuantity]=React.useState("")
  const [loading,setLoading]=React.useState(true)
  const [saving,setSaving]=React.useState(false)
  const [message,setMessage]=React.useState("")
  const [error,setError]=React.useState("")
  const [form,setForm]=React.useState({category:SEGMENTS[0],itemName:"",specification:"",unit:"saco",quantity:"",city,state,neededAt:""})

  React.useEffect(() => { setForm((current) => ({ ...current, city, state })) }, [city, state])

  const load=React.useCallback(async()=>{
    setLoading(true); setError("")
    if (!city || !state) { setRounds([]); setOrders([]); setLoading(false); return }
    try{
      const params = new URLSearchParams({ city, state })
      if (segment !== "Todos os segmentos") params.set("category", segment)
      const response=await fetch("/api/rounds?"+params.toString(),{credentials:"include"})
      const body=await response.json()
      if(!response.ok) throw new Error(body.error??"Não foi possível carregar as rodadas.")
      setRounds(body)
      if(user){
        const mine=await fetch("/api/round-orders",{credentials:"include"})
        if(mine.ok) setOrders(await mine.json())
      } else setOrders([])
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao carregar.");}
    finally{setLoading(false)}
  },[segment,user,city,state])
  React.useEffect(()=>{void load()},[load])

  const authOrLogin=()=>{
    if(user) return true
    navigate("/login?returnTo=/rodadas&intent=rodadas")
    return false
  }
  const createDemand=async(event:React.FormEvent)=>{
    event.preventDefault()
    if(!authOrLogin()) return
    setSaving(true);setError("");setMessage("")
    try{
      const response=await fetch("/api/rounds",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,city,state,quantity:form.quantity.replace(",","." )})})
      const body=await response.json()
      if(!response.ok) throw new Error(body.error??"Não foi possível criar sua demanda.")
      setMessage(body.created?"Demanda cadastrada e aberta para receber participantes.":"Sua quantidade foi somada a um lote compatível.")
      setShowDemand(false);setForm({...form,itemName:"",specification:"",quantity:""});await load()
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao enviar a demanda.");}
    finally{setSaving(false)}
  }
  const joinRound=async(event:React.FormEvent)=>{
    event.preventDefault()
    if(!selected||!authOrLogin()) return
    setSaving(true);setError("");setMessage("")
    try{
      const response=await fetch("/api/rounds/"+encodeURIComponent(selected.id)+"/participations",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({quantity:quantity.replace(",","." )})})
      const body=await response.json()
      if(!response.ok) throw new Error(body.error??"Não foi possível participar deste lote.")
      setMessage("Sua quantidade foi adicionada ao lote "+selected.code+".")
      setSelected(null);setQuantity("");await load()
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao participar.");}
    finally{setSaving(false)}
  }
  const answerOrder=async(id:string,action:"accept"|"decline")=>{
    if(!authOrLogin())return
    setSaving(true);setError("");setMessage("")
    try{
      const response=await fetch("/api/round-orders/"+encodeURIComponent(id)+"/"+action,{method:"POST",credentials:"include"})
      const body=await response.json()
      if(!response.ok) throw new Error(body.error??"Não foi possível atualizar o pedido.")
      setMessage(action==="accept"?(body.paymentStatus??"Proposta aceita."):"Proposta recusada.")
      await load()
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao responder.");}
    finally{setSaving(false)}
  }
  const dateLabel=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value))
  const dateOnly=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(value))

  return <main className="min-h-full bg-[#F7F9FC] px-4 py-6 pb-24 text-[#0B2240] md:px-8 md:py-10">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#008878]">Praça.ai · compras coletivas</p>
          <h1 className="mt-2 font-[Manrope] text-3xl font-extrabold sm:text-4xl">Rodadas de negócios</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#64748B] sm:text-base">Escolha um lote aberto ou cadastre o material de que precisa. O prazo e a data de entrega ficam visíveis antes de participar.</p><div className="mt-3"><MarketplaceCityPicker /></div>
        </div>
        <button onClick={()=>{if(authOrLogin())setShowDemand(true)}} className="inline-flex items-center gap-2 rounded-xl bg-[#10D3B8] px-4 py-3 text-sm font-extrabold text-[#0B2240]"><Plus className="h-4 w-4"/>Cadastrar minha demanda</button>
      </div>

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl bg-[#0B2240] p-5 text-white md:col-span-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-[#8BF1E4]"><Users className="h-4 w-4"/>Compra em lote</span>
          <h2 className="mt-4 max-w-xl font-[Manrope] text-2xl font-extrabold">Você informa o que precisa. A Praça.ai organiza as propostas.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Lojistas enviam propostas decrescentes sem ver seu nome ou contato. No encerramento, você recebe uma proposta individual para aceitar ou recusar.</p>
        </article>
        <div className="grid gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[#E5EAF0] bg-white p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><ShieldCheck className="h-5 w-5"/></span><div><h2 className="text-sm font-extrabold">Identidade protegida</h2><p className="text-xs text-[#64748B]">A loja só recebe seu contato se você aceitar.</p></div></div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#E5EAF0] bg-white p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><CircleDollarSign className="h-5 w-5"/></span><div><h2 className="text-sm font-extrabold">Decisão individual</h2><p className="text-xs text-[#64748B]">Cada comprador aceita e formaliza seu próprio pedido.</p></div></div>
        </div>
      </section>

      {message&&<div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      {error&&<div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button aria-label="Fechar aviso" onClick={()=>setError("")}><X className="h-4 w-4"/></button></div>}

      {showDemand&&<section className="mb-5 rounded-2xl border border-[#BCEDE5] bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-[Manrope] text-xl font-extrabold">Cadastrar necessidade</h2><p className="mt-1 text-sm text-[#64748B]">Itens compatíveis do mesmo município e data podem ser agrupados em um lote.</p></div><button aria-label="Fechar formulário" onClick={()=>setShowDemand(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
        <form onSubmit={(e)=>void createDemand(e)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-bold">Segmento<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1 h-11 w-full rounded-lg border px-3 font-normal">{SEGMENTS.map(s=><option key={s}>{s}</option>)}</select></label>
          <label className="text-sm font-bold">Material<input required maxLength={200} value={form.itemName} onChange={e=>setForm({...form,itemName:e.target.value})} placeholder="Ex.: Cimento CP II" className="mt-1 h-11 w-full rounded-lg border px-3 font-normal"/></label>
          <label className="text-sm font-bold">Quantidade<input required inputMode="decimal" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="Ex.: 80" className="mt-1 h-11 w-full rounded-lg border px-3 font-normal"/></label>
          <label className="text-sm font-bold">Unidade<select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} className="mt-1 h-11 w-full rounded-lg border px-3 font-normal">{UNITS.map(u=><option key={u}>{u}</option>)}</select></label>
          <label className="text-sm font-bold">Especificações<input maxLength={500} value={form.specification} onChange={e=>setForm({...form,specification:e.target.value})} placeholder="Marca, medida ou padrão" className="mt-1 h-11 w-full rounded-lg border px-3 font-normal"/></label>
          <label className="text-sm font-bold">Precisa receber em<input type="date" required value={form.neededAt} onChange={e=>setForm({...form,neededAt:e.target.value})} className="mt-1 h-11 w-full rounded-lg border px-3 font-normal"/></label>
          <div className="rounded-lg bg-[#F8FAFC] p-3 text-sm"><span className="block text-xs font-bold text-[#64748B]">Município do lote</span><strong>{city && state ? `${city}/${state}` : "Escolha sua cidade no topo"}</strong></div>
          <div className="flex items-end"><button disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#10D3B8] px-4 font-extrabold disabled:opacity-60">{saving?"Salvando…":"Enviar demanda"}<ArrowRight className="h-4 w-4"/></button></div>
        </form>
      </section>}

      <section className="mb-5 rounded-2xl border border-[#E5EAF0] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-[Manrope] text-xl font-extrabold">Lotes abertos para participar</h2><p className="mt-1 text-sm text-[#64748B]">A lista mostra somente rodadas ativas.</p></div>
          <label className="flex items-center gap-2 text-sm font-bold"><span>Segmento</span><span className="relative"><select value={segment} onChange={e=>setSegment(e.target.value)} className="h-10 max-w-[230px] appearance-none rounded-lg border bg-white py-2 pl-3 pr-8 text-sm">{["Todos os segmentos",...SEGMENTS].map(s=><option key={s}>{s}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-3 h-4 w-4"/></span></label>
        </div>
        {selected&&<form onSubmit={e=>void joinRound(e)} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-[#F0FCFA] p-4"><div className="min-w-0 flex-1"><h3 className="font-bold">Participar do lote {selected.code}</h3><p className="text-sm text-[#64748B]">{selected.itemName} · {selected.unit} · {selected.city}/{selected.state}</p></div><label className="text-sm font-bold">Sua quantidade<input required inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)} className="mt-1 h-10 w-36 rounded-lg border px-3 font-normal"/></label><button disabled={saving} className="h-10 rounded-lg bg-[#0B2240] px-4 text-sm font-bold text-white disabled:opacity-60">{saving?"Salvando…":"Confirmar participação"}</button><button type="button" onClick={()=>setSelected(null)} className="h-10 rounded-lg px-3 text-sm font-bold">Cancelar</button></form>}
        {!city || !state ? <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Escolha sua cidade para ver os lotes disponíveis no município.</div> : loading?<div className="py-12 text-center text-sm text-[#64748B]">Carregando lotes abertos…</div>:rounds.length?<div className="mt-4 grid gap-3 md:grid-cols-2">{rounds.map(r=><article key={r.id} className="rounded-xl border border-[#E5EAF0] p-4"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-[#E8F2FF] px-2.5 py-1 text-xs font-bold text-[#0077FF]">{r.category}</span><h3 className="mt-3 font-[Manrope] text-lg font-extrabold">{r.itemName}</h3>{r.specification&&<p className="mt-1 text-sm text-[#64748B]">{r.specification}</p>}</div><span className="rounded-lg bg-[#F8FAFC] px-2 py-1 text-xs font-bold">{r.code}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[#64748B]">Volume agrupado</dt><dd className="font-extrabold">{r.totalQuantity.toLocaleString("pt-BR")} {r.unit}</dd></div><div><dt className="text-xs text-[#64748B]">Região</dt><dd className="font-extrabold">{r.city}/{r.state}</dd></div><div><dt className="text-xs text-[#64748B]">Precisa receber até</dt><dd className="font-extrabold">{dateOnly(r.neededAt)}</dd></div><div><dt className="text-xs text-[#64748B]">Encerra</dt><dd className="font-extrabold">{dateLabel(r.closesAt)}</dd></div></dl><button onClick={()=>{if(authOrLogin())setSelected(r)}} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#0B2240] px-4 py-2.5 text-sm font-extrabold hover:bg-[#F8FAFC]">Participar deste lote<ArrowRight className="h-4 w-4"/></button></article>)}</div>:<div className="mt-5 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-5 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#64748B] shadow-sm"><Package className="h-6 w-6"/></span><h3 className="mt-4 font-[Manrope] text-lg font-extrabold">Nenhum lote aberto{segment!=="Todos os segmentos"?" neste segmento":""}</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#64748B]">Cadastre sua demanda ou peça uma cotação direta. Lotes compatíveis podem reunir a procura neste município.</p><button onClick={()=>{if(authOrLogin())setShowDemand(true)}} className="mt-5 rounded-xl bg-[#10D3B8] px-4 py-2.5 text-sm font-extrabold">Cadastrar minha demanda</button><Link href="/cotacao" className="ml-3 inline-flex items-center gap-2 rounded-xl border border-[#0B2240] bg-white px-4 py-2.5 text-sm font-bold">Cotação direta<ArrowRight className="h-4 w-4"/></Link></div>}
      </section>

      {user&&<section className="mb-5 rounded-2xl border border-[#E5EAF0] bg-white p-4 sm:p-5"><div className="mb-4"><h2 className="font-[Manrope] text-xl font-extrabold">Minhas rodadas</h2><p className="mt-1 text-sm text-[#64748B]">Acompanhe o pedido após o encerramento. As propostas dos lojistas permanecem ocultas durante a rodada.</p></div>{orders.length?<div className="grid gap-3 md:grid-cols-2">{orders.map(o=><article key={o.id} className="rounded-xl border border-[#E5EAF0] p-4"><span className="text-xs font-bold text-[#008878]">{o.code}</span><h3 className="mt-1 font-extrabold">{o.itemName}</h3><p className="mt-1 text-sm text-[#64748B]">{o.quantity} {o.unit}{o.total!=null?` · R$ ${o.total.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:""}{o.deliveryDays!=null?` · entrega em até ${o.deliveryDays} dias`:""}</p>{o.status==="awaiting_buyer"?<div className="mt-3 flex gap-2"><button disabled={saving} onClick={()=>void answerOrder(o.id,"accept")} className="rounded-lg bg-[#10D3B8] px-3 py-2 text-sm font-extrabold">Aceitar proposta</button><button disabled={saving} onClick={()=>void answerOrder(o.id,"decline")} className="rounded-lg border px-3 py-2 text-sm font-bold">Recusar</button></div>:o.vendor?<div className="mt-3 rounded-lg bg-[#F0FCFA] p-3 text-sm"><strong>Loja: {o.vendor.name}</strong><p className="mt-1 text-xs text-[#64748B]">Pagamento e entrega precisam ser formalizados com a loja.</p><Link href={o.vendor.storeUrl} className="mt-2 inline-flex items-center gap-1 font-bold text-[#0077FF]">Ver loja<ArrowRight className="h-3.5 w-3.5"/></Link></div>:<p className="mt-3 text-xs text-[#64748B]">{o.status==="declined"?"Você recusou esta proposta.":o.status==="awaiting_payment"?"Sua aceitação foi registrada.":o.status==="no_offers"?"A rodada foi encerrada sem propostas. Você pode pedir cotação direta.":o.status==="participating"?"Sua demanda está nesta rodada. Acompanhe após o encerramento.":"Aguardando encerramento da rodada."}</p>}</article>)}</div>:<div className="rounded-xl bg-[#F8FAFC] px-4 py-8 text-center text-sm text-[#64748B]">Você ainda não tem propostas encerradas.</div>}</section>}

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/listing?category=materiais-de-construcao" className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5EAF0] bg-white p-4 hover:border-[#10D3B8]"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><Building2 className="h-5 w-5"/></span><span><strong className="block text-sm">Comprar no marketplace</strong><span className="text-xs text-[#64748B]">Veja produtos disponíveis agora</span></span></span><ArrowRight className="h-4 w-4"/></Link>
        <Link href="/marketplace" className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5EAF0] bg-white p-4 hover:border-[#10D3B8]"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F2FF] text-[#0077FF]"><Store className="h-5 w-5"/></span><span><strong className="block text-sm">É lojista?</strong><span className="text-xs text-[#64748B]">Participe pelo AppVendor.ai</span></span></span><ArrowRight className="h-4 w-4"/></Link>
      </section>
      <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-[#64748B]"><Clock3 className="mt-0.5 h-4 w-4 shrink-0"/> A proposta final é individual: cada participante decide se aceita e conclui o pedido.</p>
    </div>
  </main>
}
