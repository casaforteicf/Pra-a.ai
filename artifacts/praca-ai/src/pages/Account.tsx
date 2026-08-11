import * as React from "react"
import { useLocation, useRoute } from "wouter"
import { ChevronLeft, Copy, MapPin, Plus, Save, Trash2, Store, TrendingUp, BadgePercent, MousePointerClick } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

type Address = { id: string; label: string; street: string; number: string; complement?: string | null; neighborhood: string; city: string; state: string; zipCode: string; isDefault: boolean }
type ProfileData = { name: string; email: string; phone?: string | null; cpf?: string | null; addresses: Address[] }
type Coupon = { id?: string | number; code: string; description?: string }
const titles = { profile: "Meus dados", addresses: "Endereços", coupons: "Meus cupons", listings: "Meus anúncios", influencer: "Portal do Influenciador", settings: "Configurações do app", support: "Ajuda e suporte" } as const
const blankAddress = { label: "Casa", street: "", number: "", complement: "", neighborhood: "", city: "", state: "SC", zipCode: "", isDefault: false }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } })
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Não foi possível concluir a operação.") }
  return response.status === 204 ? undefined as T : response.json()
}

export default function Account() {
  const [, params] = useRoute("/account/:section")
  const [, navigate] = useLocation()
  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()
  const section = (params?.section && params.section in titles ? params.section : "profile") as keyof typeof titles
  const [profile, setProfile] = React.useState<ProfileData | null>(null)
  const [coupons, setCoupons] = React.useState<Coupon[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState(blankAddress)
  const [adding, setAdding] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      if (section === "coupons") setCoupons(await api<Coupon[]>("/api/coupons"))
      else setProfile(await api<ProfileData>("/api/profile"))
    } catch (e) { toast({ title: "Erro ao carregar", description: (e as Error).message, variant: "destructive" }) }
    finally { setLoading(false) }
  }, [section, toast, user])
  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => { if (!authLoading && !user) navigate("/login") }, [authLoading, navigate, user])

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    try { setProfile(await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name: profile.name, phone: profile.phone, cpf: profile.cpf }) })); toast({ title: "Dados atualizados" }) }
    catch (e) { toast({ title: "Não foi possível salvar", description: (e as Error).message, variant: "destructive" }) }
    finally { setSaving(false) }
  }
  const addAddress = async () => {
    setSaving(true)
    try { await api("/api/profile/addresses", { method: "POST", body: JSON.stringify(form) }); setForm(blankAddress); setAdding(false); await load(); toast({ title: "Endereço adicionado" }) }
    catch (e) { toast({ title: "Revise o endereço", description: (e as Error).message, variant: "destructive" }) }
    finally { setSaving(false) }
  }
  const changeAddress = async (id: string, method: "PATCH" | "DELETE") => {
    try { await api(`/api/profile/addresses/${id}`, { method, body: method === "PATCH" ? JSON.stringify({ isDefault: true }) : undefined }); await load() }
    catch (e) { toast({ title: "Não foi possível alterar", description: (e as Error).message, variant: "destructive" }) }
  }

  if (authLoading || loading || !user) return <div className="min-h-full bg-muted/30 p-5 pt-16"><div className="h-36 animate-pulse rounded-2xl bg-muted" /></div>
  return <div className="min-h-full bg-muted/30 pb-24">
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/95 px-4 pb-4 pt-12 backdrop-blur">
      <button aria-label="Voltar" onClick={() => navigate("/profile")} className="grid h-10 w-10 place-items-center rounded-full bg-muted"><ChevronLeft /></button>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Portal do cliente</p><h1 className="text-xl font-black">{titles[section]}</h1></div>
    </header>
    <main className="space-y-4 p-4">
      {section === "profile" && profile && <section className="space-y-4 rounded-2xl border bg-background p-4 shadow-sm">
        <Field label="Nome" value={profile.name} onChange={name => setProfile({ ...profile, name })} />
        <Field label="E-mail" value={profile.email} disabled />
        <Field label="Telefone" value={profile.phone || ""} onChange={phone => setProfile({ ...profile, phone })} />
        <Field label="CPF" value={profile.cpf || ""} onChange={cpf => setProfile({ ...profile, cpf })} />
        <Button className="w-full" disabled={saving} onClick={saveProfile}><Save className="mr-2 h-4 w-4" />Salvar alterações</Button>
      </section>}
      {section === "addresses" && profile && <>
        <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Endereços de entrega</p><Button size="sm" onClick={() => setAdding(!adding)}><Plus className="mr-1 h-4 w-4" />Adicionar</Button></div>
        {adding && <section className="grid grid-cols-2 gap-3 rounded-2xl border bg-background p-4 shadow-sm">
          <div className="col-span-2"><Field label="Identificação" value={form.label} onChange={label => setForm({ ...form, label })} /></div>
          <div className="col-span-2"><Field label="Rua" value={form.street} onChange={street => setForm({ ...form, street })} /></div>
          <Field label="Número" value={form.number} onChange={number => setForm({ ...form, number })} /><Field label="Complemento" value={form.complement} onChange={complement => setForm({ ...form, complement })} />
          <div className="col-span-2"><Field label="Bairro" value={form.neighborhood} onChange={neighborhood => setForm({ ...form, neighborhood })} /></div>
          <Field label="Cidade" value={form.city} onChange={city => setForm({ ...form, city })} /><Field label="UF" value={form.state} onChange={state => setForm({ ...form, state: state.toUpperCase().slice(0, 2) })} />
          <div className="col-span-2"><Field label="CEP" value={form.zipCode} onChange={zipCode => setForm({ ...form, zipCode })} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} />Usar como principal</label>
          <Button className="col-span-2" disabled={saving} onClick={addAddress}>Salvar endereço</Button>
        </section>}
        {!profile.addresses.length ? <Empty text="Nenhum endereço cadastrado." /> : profile.addresses.map(a => <article key={a.id} className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex justify-between gap-3"><div><div className="flex gap-2"><strong>{a.label}</strong>{a.isDefault && <span className="rounded-full bg-primary/10 px-2 text-xs font-bold text-primary">Principal</span>}</div><p className="mt-2 text-sm text-muted-foreground">{a.street}, {a.number}{a.complement ? ` · ${a.complement}` : ""}<br />{a.neighborhood} · {a.city}/{a.state}<br />CEP {a.zipCode}</p></div><button aria-label="Remover" onClick={() => changeAddress(a.id, "DELETE")} className="text-destructive"><Trash2 className="h-5 w-5" /></button></div>{!a.isDefault && <Button className="mt-3" variant="outline" size="sm" onClick={() => changeAddress(a.id, "PATCH")}>Tornar principal</Button>}</article>)}
      </>}
      {section === "coupons" && (coupons.length ? coupons.map(c => <article key={c.id || c.code} className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><div><strong className="text-lg">{c.code}</strong><p className="text-sm text-muted-foreground">{c.description || "Disponível para sua próxima compra"}</p></div><Button variant="outline" size="icon" onClick={() => { void navigator.clipboard.writeText(c.code); toast({ title: "Cupom copiado" }) }}><Copy className="h-4 w-4" /></Button></div></article>) : <Empty text="Nenhum cupom disponível agora." />)}
      {section === "listings" && <MarketplaceManager toast={toast} />}
      {section === "influencer" && <InfluencerPortal toast={toast} />}
      {section === "settings" && <Settings />}
      {section === "support" && <Support />}
    </main>
  </div>
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange?: (v: string) => void; disabled?: boolean }) { return <label className="block text-sm font-semibold">{label}<Input className="mt-1" value={value} disabled={disabled} onChange={e => onChange?.(e.target.value)} /></label> }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed bg-background p-10 text-center text-sm text-muted-foreground">{text}</div> }

type InfluencerDashboard = {
  influencer: { codigo: string; nomePublico?: string | null; nicho?: string | null; saldoComissao: string; descontoPercentual: string; comissaoPercentual: string; status: string };
  metrics: { clicks: number; conversions: number; totalSales: number; totalCommission: number; conversionRate: number };
  conversions: { id: number; orderValue: string; commissionValue: string; status: string; createdAt: string }[];
  referralLink: string;
  couponCode: string;
}

function InfluencerPortal({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [dashboard, setDashboard] = React.useState<InfluencerDashboard | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [registering, setRegistering] = React.useState(false)
  const [form, setForm] = React.useState({ nomePublico: "", codigo: "", nicho: "", cidade: "Chapecó", instagram: "", tiktok: "", youtube: "", bio: "" })
  const load = React.useCallback(async () => {
    setLoading(true)
    const response = await fetch("/api/influenciadores/me/dashboard", { credentials: "include" })
    setDashboard(response.ok ? await response.json() : null)
    setLoading(false)
  }, [])
  React.useEffect(() => { void load() }, [load])
  const register = async () => {
    setRegistering(true)
    try { await api("/api/embaixadores", { method: "POST", body: JSON.stringify(form) }); await load(); toast({ title: "Portal ativado", description: "Seu link e cupom já estão disponíveis." }) }
    catch (error) { toast({ title: "Não foi possível ativar", description: (error as Error).message, variant: "destructive" }) }
    finally { setRegistering(false) }
  }
  const copy = async (value: string, label: string) => { await navigator.clipboard.writeText(value); toast({ title: `${label} copiado` }) }
  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />
  if (!dashboard) return <div className="space-y-4">
    <section className="rounded-2xl bg-primary p-5 text-primary-foreground"><TrendingUp className="h-8 w-8" /><h2 className="mt-3 text-2xl font-black">Transforme influência em vendas</h2><p className="mt-2 text-sm opacity-80">Crie seu cupom, compartilhe produtos e acompanhe resultados com transparência.</p></section>
    <section className="space-y-3 rounded-2xl border bg-background p-4 shadow-sm"><Field label="Nome público" value={form.nomePublico} onChange={(nomePublico) => setForm({ ...form, nomePublico })} /><Field label="Código desejado" value={form.codigo} onChange={(codigo) => setForm({ ...form, codigo: codigo.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) })} /><Field label="Nicho" value={form.nicho} onChange={(nicho) => setForm({ ...form, nicho })} /><Field label="Cidade" value={form.cidade} onChange={(cidade) => setForm({ ...form, cidade })} /><Field label="Instagram" value={form.instagram} onChange={(instagram) => setForm({ ...form, instagram })} /><Field label="TikTok" value={form.tiktok} onChange={(tiktok) => setForm({ ...form, tiktok })} /><Field label="YouTube" value={form.youtube} onChange={(youtube) => setForm({ ...form, youtube })} /><Field label="Apresentação" value={form.bio} onChange={(bio) => setForm({ ...form, bio })} /><Button className="w-full" disabled={registering || form.codigo.length < 4 || !form.nomePublico.trim()} onClick={register}>Criar meu portal</Button></section>
  </div>
  const { influencer, metrics } = dashboard
  return <div className="space-y-4">
    <section className="rounded-2xl bg-primary p-5 text-primary-foreground"><p className="text-xs font-black uppercase tracking-[0.18em]">Parceiro Praça.ai</p><h2 className="mt-1 text-2xl font-black">{influencer.nomePublico || "Influenciador"}</h2><p className="mt-1 text-sm opacity-80">{influencer.nicho || "Creator commerce local"}</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => copy(dashboard.couponCode, "Cupom")} className="rounded-xl bg-card/15 p-3 text-left"><p className="text-[10px] uppercase opacity-70">Seu cupom</p><p className="font-black">{dashboard.couponCode}</p></button><button onClick={() => copy(dashboard.referralLink, "Link")} className="rounded-xl bg-card/15 p-3 text-left"><p className="text-[10px] uppercase opacity-70">Link rastreável</p><p className="truncate font-bold">Copiar link</p></button></div></section>
    <div className="grid grid-cols-2 gap-3"><Metric icon={<MousePointerClick />} label="Cliques" value={String(metrics.clicks)} /><Metric icon={<BadgePercent />} label="Conversões" value={String(metrics.conversions)} /><Metric icon={<TrendingUp />} label="Vendas geradas" value={`R$ ${metrics.totalSales.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} /><Metric icon={<Store />} label="Comissão" value={`R$ ${metrics.totalCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} /></div>
    <section className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-black">Regras atuais</h3><p className="text-sm text-muted-foreground">Benefícios configurados para seu perfil</p></div><BadgePercent className="text-primary" /></div><div className="mt-3 grid grid-cols-2 gap-3 text-center"><div className="rounded-xl bg-muted p-3"><strong>{Number(influencer.descontoPercentual)}%</strong><p className="text-xs text-muted-foreground">desconto ao cliente</p></div><div className="rounded-xl bg-muted p-3"><strong>{Number(influencer.comissaoPercentual)}%</strong><p className="text-xs text-muted-foreground">comissão por venda</p></div></div></section>
    <section className="rounded-2xl border bg-background p-4 shadow-sm"><h3 className="font-black">Histórico financeiro</h3>{dashboard.conversions.length ? <div className="mt-3 divide-y">{dashboard.conversions.map((item) => <div key={item.id} className="flex items-center justify-between py-3 text-sm"><div><p className="font-bold">Venda de R$ {Number(item.orderValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("pt-BR")} · {item.status}</p></div><strong className="text-primary">+ R$ {Number(item.commissionValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">Compartilhe seu link ou cupom para gerar a primeira venda.</p>}</section>
  </div>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl border bg-background p-4 shadow-sm"><span className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><p className="mt-3 text-xl font-black">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div> }

type PersonalListing = { id: string; title: string; price: number; category: string; condition: string; imageUrls: string[]; city: string; state: string; status: "active" | "paused" | "sold" }
const emptyListing = { title: "", description: "", price: "", category: "", condition: "good", imageUrl: "", city: "Chapecó", state: "SC" }

function MarketplaceManager({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [items, setItems] = React.useState<PersonalListing[]>([])
  const [categories, setCategories] = React.useState<string[]>([])
  const [form, setForm] = React.useState(emptyListing)
  const [adding, setAdding] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const load = React.useCallback(async () => setItems(await api<PersonalListing[]>("/api/marketplace/mine")), [])
  React.useEffect(() => { void load(); fetch("/api/marketplace/categories").then((r) => r.json()).then(setCategories) }, [load])
  const create = async () => {
    setSaving(true)
    try {
      await api("/api/marketplace", { method: "POST", body: JSON.stringify({ ...form, price: Number(form.price), imageUrls: [form.imageUrl] }) })
      setForm(emptyListing); setAdding(false); await load(); toast({ title: "Anúncio publicado" })
    } catch (error) { toast({ title: "Revise o anúncio", description: (error as Error).message, variant: "destructive" }) }
    finally { setSaving(false) }
  }
  const updateStatus = async (id: string, status: PersonalListing["status"]) => { await api(`/api/marketplace/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load() }
  const remove = async (id: string) => { await api(`/api/marketplace/${id}`, { method: "DELETE" }); await load() }
  return <div className="space-y-4">
    <section className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-black"><Store className="h-5 w-5 text-primary" />Venda no Marketplace</h2><p className="mt-1 text-sm text-muted-foreground">Anuncie objetos novos ou usados. A categoria é obrigatória.</p></div><Button size="sm" onClick={() => setAdding(!adding)}><Plus className="mr-1 h-4 w-4" />Novo</Button></div></section>
    {adding && <section className="space-y-3 rounded-2xl border bg-background p-4 shadow-sm">
      <Field label="Título do item" value={form.title} onChange={(title) => setForm({ ...form, title })} />
      <label className="block text-sm font-semibold">Categoria<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 h-10 w-full rounded-xl border bg-background px-3"><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="block text-sm font-semibold">Estado do item<select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="mt-1 h-10 w-full rounded-xl border bg-background px-3"><option value="new">Novo</option><option value="like_new">Seminovo</option><option value="good">Bom estado</option><option value="used">Usado</option></select></label>
      <Field label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} />
      <Field label="Preço (R$)" value={form.price} onChange={(price) => setForm({ ...form, price })} />
      <Field label="URL da foto" value={form.imageUrl} onChange={(imageUrl) => setForm({ ...form, imageUrl })} />
      <div className="grid grid-cols-[1fr_80px] gap-3"><Field label="Cidade" value={form.city} onChange={(city) => setForm({ ...form, city })} /><Field label="UF" value={form.state} onChange={(state) => setForm({ ...form, state: state.toUpperCase().slice(0, 2) })} /></div>
      <Button className="w-full" disabled={saving || !form.category} onClick={create}>Publicar anúncio</Button>
    </section>}
    {!items.length ? <Empty text="Você ainda não publicou nenhum item." /> : items.map((item) => <article key={item.id} className="flex gap-3 rounded-2xl border bg-background p-3 shadow-sm"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">{item.imageUrls[0] && <img src={item.imageUrls[0]} alt={item.title} className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate font-black">{item.title}</p><p className="text-sm text-primary">R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">{item.category} · {item.status}</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => updateStatus(item.id, item.status === "active" ? "paused" : "active")}>{item.status === "active" ? "Pausar" : "Ativar"}</Button><Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "sold")}>Vendido</Button><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" /></Button></div></div></article>)}
  </div>
}

function Settings() {
  const [prefs, setPrefs] = React.useState<Record<string, boolean>>(() => JSON.parse(localStorage.getItem("praca-preferences") || '{"offers":true,"orders":true,"location":true}'))
  const toggle = (key: string) => { const next = { ...prefs, [key]: !prefs[key] }; setPrefs(next); localStorage.setItem("praca-preferences", JSON.stringify(next)) }
  return <section className="divide-y rounded-2xl border bg-background px-4 shadow-sm">{[["offers", "Ofertas e novidades"], ["orders", "Atualizações de pedidos"], ["location", "Usar localização nos resultados"]].map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 py-4 font-medium"><span>{label}</span><input type="checkbox" checked={prefs[key]} onChange={() => toggle(key)} className="h-5 w-5 accent-primary" /></label>)}</section>
}
function Support() { return <div className="space-y-3"><section className="rounded-2xl border bg-background p-4 shadow-sm"><h2 className="font-black">Como podemos ajudar?</h2><p className="mt-1 text-sm text-muted-foreground">Pedidos, entregas, pagamentos ou sua conta.</p><div className="mt-4 grid gap-2"><Button asChild><a href="https://wa.me/554933233030" target="_blank" rel="noreferrer">Conversar pelo WhatsApp</a></Button><Button variant="outline" asChild><a href="mailto:atendimento@praca.ai">Enviar e-mail</a></Button></div></section>{["Como acompanho meu pedido?", "Como altero o endereço?", "Como uso um cupom?"].map(q => <details key={q} className="rounded-xl border bg-background p-4"><summary className="cursor-pointer font-bold">{q}</summary><p className="mt-2 text-sm text-muted-foreground">Use as opções do Portal do Cliente ou fale com o atendimento.</p></details>)}</div> }
