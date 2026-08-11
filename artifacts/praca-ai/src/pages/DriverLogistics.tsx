import * as React from "react"
import { useLocation } from "wouter"
import { ArrowLeft, Banknote, Camera, Check, MapPin, PackageCheck, Power, Truck, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

type Delivery = { delivery: { id: number; status: string; valorPagoParceiro?: string; createdAt: string }; order: { orderNumber: string; deliveryAddress: string } }
type Dashboard = { partner: { nome: string; status: string; documentacaoStatus: string; veiculoTipo: string }; entregas: Delivery[]; pracaBank: { saldo: number; transacoes: { id: number; descricao: string; valor: string; status: string; createdAt: string }[] } }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers }, ...init })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir.")
  return body
}
const toDataUrl = (file?: File) => new Promise<string>((resolve, reject) => { if (!file) return resolve(""); const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })

export default function DriverLogistics() {
  const [, navigate] = useLocation()
  const { toast } = useToast()
  const [dashboard, setDashboard] = React.useState<Dashboard | null>(null)
  const [notFound, setNotFound] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [form, setForm] = React.useState({ cpf: "", veiculoTipo: "moto", placa: "", documento: undefined as File | undefined, selfie: undefined as File | undefined, cnh: undefined as File | undefined, veiculoDocumento: undefined as File | undefined })
  const load = React.useCallback(async () => { try { setDashboard(await api<Dashboard>("/api/logistica/entregador/me")); setNotFound(false) } catch { setNotFound(true) } }, [])
  React.useEffect(() => { void load() }, [load])
  const register = async () => {
    setBusy(true)
    try {
      await api("/api/logistica/entregadores/cadastro", { method: "POST", body: JSON.stringify({ cpf: form.cpf, veiculoTipo: form.veiculoTipo, placa: form.placa, documentoFotoUrl: await toDataUrl(form.documento), selfieUrl: await toDataUrl(form.selfie), cnhUrl: await toDataUrl(form.cnh), veiculoDocumentoUrl: await toDataUrl(form.veiculoDocumento) }) })
      await load(); toast({ title: "Cadastro enviado", description: "Avisaremos quando a documentação for aprovada." })
    } catch (error) { toast({ title: "Revise o cadastro", description: (error as Error).message, variant: "destructive" }) } finally { setBusy(false) }
  }
  const action = async (url: string, body: unknown) => { setBusy(true); try { await api(url, { method: "PATCH", body: JSON.stringify(body) }); await load() } catch (error) { toast({ title: "Ação não realizada", description: (error as Error).message, variant: "destructive" }) } finally { setBusy(false) } }
  const answer = async (id: number, aceitar: boolean) => { setBusy(true); try { await api(`/api/logistica/entregas/${id}/resposta`, { method: "POST", body: JSON.stringify({ aceitar }) }); await load() } catch (error) { toast({ title: "Oferta indisponível", description: (error as Error).message, variant: "destructive" }) } finally { setBusy(false) } }

  return <div className="min-h-full bg-muted/30 pb-24">
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/95 px-4 pb-4 pt-12 backdrop-blur"><button onClick={() => navigate("/profile")} className="grid h-10 w-10 place-items-center rounded-full bg-muted"><ArrowLeft /></button><div><p className="text-xs font-black uppercase tracking-wider text-primary">Operação logística</p><h1 className="text-xl font-black">Entregador Praça.ai</h1></div></header>
    <main className="space-y-4 p-4">
      {notFound ? <Registration form={form} setForm={setForm} register={register} busy={busy} /> : dashboard && <>
        <section className="rounded-3xl bg-slate-950 p-5 text-white"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-primary">{dashboard.partner.documentacaoStatus === "aprovada" ? "Cadastro aprovado" : "Documentação em análise"}</p><h2 className="mt-1 text-2xl font-black">Olá, {dashboard.partner.nome.split(" ")[0]}</h2><p className="mt-1 text-sm text-white/60"><Truck className="mr-1 inline h-4 w-4" />{dashboard.partner.veiculoTipo}</p></div><Button size="icon" disabled={busy || dashboard.partner.documentacaoStatus !== "aprovada"} variant={dashboard.partner.status === "offline" ? "secondary" : "default"} onClick={() => action("/api/logistica/entregador/disponibilidade", { online: dashboard.partner.status === "offline" })}><Power /></Button></div><div className="mt-5 rounded-2xl bg-white/10 p-3 text-sm"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${dashboard.partner.status === "offline" ? "bg-slate-400" : "bg-green-400"}`} />{dashboard.partner.status === "offline" ? "Você está offline" : "Você está disponível para entregas"}</div></section>
        <section className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-muted-foreground">Praça.Bank</p><p className="mt-1 text-3xl font-black">R$ {dashboard.pracaBank.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div><div className="rounded-2xl bg-primary/10 p-3 text-primary"><Banknote /></div></div><p className="mt-2 text-xs text-muted-foreground">Saldo liberado por entregas comprovadas.</p></section>
        <div><h2 className="mb-3 font-black">Suas tarefas</h2>{dashboard.entregas.length ? <div className="space-y-3">{dashboard.entregas.map(({ delivery, order }) => <DeliveryCard key={delivery.id} delivery={delivery} order={order} busy={busy} answer={answer} action={action} reload={load} toast={toast} />)}</div> : <div className="rounded-2xl border border-dashed bg-background p-10 text-center text-sm text-muted-foreground">Fique online para receber sua primeira entrega.</div>}</div>
      </>}
    </main>
  </div>
}

function Registration({ form, setForm, register, busy }: any) {
  const file = (label: string, key: string, required = false) => <label className="block rounded-xl border border-dashed p-3 text-sm font-bold"><Upload className="mr-2 inline h-4 w-4 text-primary" />{label}{required && " *"}<input type="file" accept="image/*" className="mt-2 block w-full text-xs font-normal" onChange={(e) => setForm({ ...form, [key]: e.target.files?.[0] })} /></label>
  return <><section className="rounded-2xl bg-primary p-5 text-primary-foreground"><Truck className="h-8 w-8" /><h2 className="mt-3 text-2xl font-black">Faça entregas na sua cidade</h2><p className="mt-2 text-sm opacity-80">Receba tarefas, comprove entregas e acompanhe seus ganhos no Praça.Bank.</p></section><section className="space-y-3 rounded-2xl border bg-background p-4"><label className="text-sm font-bold">CPF *<Input className="mt-1" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></label><label className="block text-sm font-bold">Veículo *<select className="mt-1 h-10 w-full rounded-xl border bg-background px-3" value={form.veiculoTipo} onChange={(e) => setForm({ ...form, veiculoTipo: e.target.value })}><option value="bike">Bicicleta</option><option value="moto">Moto</option><option value="carro">Carro</option><option value="utilitario">Utilitário</option><option value="van">Van</option><option value="caminhao">Caminhão</option></select></label><label className="text-sm font-bold">Placa, quando aplicável<Input className="mt-1" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} /></label>{file("Documento com foto", "documento", true)}{file("Selfie de validação", "selfie", true)}{file("CNH, quando aplicável", "cnh")}{file("Documento do veículo", "veiculoDocumento")}<Button className="w-full" disabled={busy || !form.cpf || !form.documento || !form.selfie} onClick={register}>Enviar para análise</Button></section></>
}

function DeliveryCard({ delivery, order, busy, answer, action, reload, toast }: any) {
  const [proof, setProof] = React.useState({ tipo: "foto_local", arquivo: undefined as File | undefined, consentimentoPessoa: false, recebedorNome: "" })
  const address = (() => { try { const a = JSON.parse(order.deliveryAddress); return `${a.street || ""}, ${a.number || ""} · ${a.city || ""}` } catch { return order.deliveryAddress } })()
  const next: Record<string, [string, string]> = { aceita: ["chegando_coleta", "Cheguei para coleta"], chegando_coleta: ["coletada", "Produto coletado"], coletada: ["em_transito", "Iniciar entrega"], em_transito: ["chegando_entrega", "Cheguei para entrega"] }
  const sendProof = async () => { try { await api(`/api/logistica/entregas/${delivery.id}/comprovante`, { method: "POST", body: JSON.stringify({ tipo: proof.tipo, arquivoUrl: await toDataUrl(proof.arquivo), recebedorNome: proof.recebedorNome, consentimentoPessoa: proof.consentimentoPessoa }) }); await action(`/api/logistica/entregas/${delivery.id}/status`, { status: "entregue" }); await reload(); toast({ title: "Entrega concluída", description: "Crédito lançado no Praça.Bank." }) } catch (error) { toast({ title: "Comprovante não enviado", description: (error as Error).message, variant: "destructive" }) } }
  return <article className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex justify-between gap-3"><div><p className="font-black">Pedido {order.orderNumber}</p><p className="mt-1 text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{address}</p></div><span className="h-fit rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">{delivery.status.replaceAll("_", " ")}</span></div>{delivery.status === "ofertada" && <div className="mt-4 grid grid-cols-2 gap-2"><Button disabled={busy} variant="outline" onClick={() => answer(delivery.id, false)}>Recusar</Button><Button disabled={busy} onClick={() => answer(delivery.id, true)}><Check className="mr-1 h-4 w-4" />Aceitar</Button></div>}{next[delivery.status] && <Button className="mt-4 w-full" disabled={busy} onClick={() => action(`/api/logistica/entregas/${delivery.id}/status`, { status: next[delivery.status][0] })}>{next[delivery.status][1]}</Button>}{delivery.status === "chegando_entrega" && <div className="mt-4 space-y-3 rounded-xl bg-muted/50 p-3"><p className="text-sm font-black"><PackageCheck className="mr-1 inline h-4 w-4" />Comprovar entrega</p><select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={proof.tipo} onChange={(e) => setProof({ ...proof, tipo: e.target.value })}><option value="foto_local">Foto do produto no local</option><option value="documento_coletado">Documento válido coletado</option></select><Input placeholder="Nome de quem recebeu" value={proof.recebedorNome} onChange={(e) => setProof({ ...proof, recebedorNome: e.target.value })} /><label className="block rounded-xl border border-dashed bg-background p-3 text-sm font-bold"><Camera className="mr-2 inline h-4 w-4" />Tirar ou selecionar foto<input className="mt-2 block w-full text-xs" type="file" accept="image/*" capture="environment" onChange={(e) => setProof({ ...proof, arquivo: e.target.files?.[0] })} /></label>{proof.tipo === "foto_local" && <label className="flex gap-2 text-xs"><input type="checkbox" checked={proof.consentimentoPessoa} onChange={(e) => setProof({ ...proof, consentimentoPessoa: e.target.checked })} />Confirmo o consentimento caso alguma pessoa apareça na foto.</label>}<Button className="w-full" disabled={!proof.arquivo || busy} onClick={sendProof}>Concluir entrega</Button></div>}</article>
}
