import * as React from "react"
import { useLocation } from "wouter"
import { Eye, EyeOff, KeyRound, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

export default function ResetPassword() {
  const [, navigate] = useLocation()
  const { toast } = useToast()
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [show, setShow] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const token = new URLSearchParams(window.location.search).get("token") || ""

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirm) return void toast({ title: "As senhas não coincidem", variant: "destructive" })
    setLoading(true)
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || "Não foi possível redefinir a senha.")
      toast({ title: "Senha atualizada", description: "Entre usando sua nova senha." })
      navigate("/login")
    } catch (error) { toast({ title: "Link não aceito", description: (error as Error).message, variant: "destructive" }) } finally { setLoading(false) }
  }

  return <div className="min-h-full bg-[radial-gradient(circle_at_top,#ede9fe,#f4f5f9_48%)] px-5 pb-12 pt-16"><div className="mx-auto max-w-md"><div className="mb-7 flex items-center justify-center gap-2 text-primary"><Store className="h-8 w-8 fill-primary" /><span className="text-2xl font-black">Praça.ai</span></div><section className="rounded-[28px] border bg-card p-6 shadow-neon"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-violet-800 text-white"><KeyRound /></div><h1 className="mt-5 text-2xl font-black">Crie uma nova senha</h1><p className="mt-2 text-sm text-muted-foreground">Use pelo menos 8 caracteres e não reutilize uma senha antiga.</p>{token ? <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold">Nova senha<div className="relative mt-1"><Input type={show ? "text" : "password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 pr-11" /><button type="button" aria-label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label><label className="block text-sm font-bold">Confirme a nova senha<Input type={show ? "text" : "password"} minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 h-12" /></label><Button type="submit" className="h-12 w-full font-black" disabled={loading}>{loading ? "Salvando..." : "Redefinir senha"}</Button></form> : <div className="mt-6 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">Este link está incompleto. Solicite uma nova recuperação na tela de entrada.</div>}<button onClick={() => navigate("/login")} className="mt-5 w-full text-center text-sm font-bold text-primary">Voltar para entrar</button></section></div></div>
}
