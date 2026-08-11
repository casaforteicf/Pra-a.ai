import * as React from "react"
import { useLocation } from "wouter"
import { ChevronLeft, Eye, EyeOff, ShoppingBag } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"

type Tab = "login" | "register"

export default function Login() {
  const [, setLocation] = useLocation()
  const { login, register } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = React.useState<Tab>("login")
  const [isLoading, setIsLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [forgotPassword, setForgotPassword] = React.useState(false)
  const [forgotEmail, setForgotEmail] = React.useState("")
  const [forgotSent, setForgotSent] = React.useState(false)

  // Login form
  const [loginEmail, setLoginEmail] = React.useState("")
  const [loginPassword, setLoginPassword] = React.useState("")

  // Register form
  const [regName, setRegName] = React.useState("")
  const [regEmail, setRegEmail] = React.useState("")
  const [regPhone, setRegPhone] = React.useState("")
  const [regPassword, setRegPassword] = React.useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) return
    setIsLoading(true)
    try {
      await login(loginEmail.trim(), loginPassword)
      setLocation("/")
    } catch (err: any) {
      toast({ title: "Erro ao entrar", description: err.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regName || !regEmail || !regPassword) return
    setIsLoading(true)
    try {
      await register(regName.trim(), regEmail.trim(), regPhone.trim() || undefined, regPassword)
      setLocation("/")
    } catch (err: any) {
      toast({ title: "Erro ao cadastrar", description: err.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) return
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: forgotEmail.trim() }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || "Não foi possível enviar as instruções.")
      setForgotSent(true)
    } catch (error) {
      toast({ title: "Não foi possível enviar", description: (error as Error).message, variant: "destructive" })
    } finally { setIsLoading(false) }
  }

  return (
    <div className="flex flex-col w-full min-h-full bg-[#FAF8F4]">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-14 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-card/10 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-black/10 rounded-full" />
        <button
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-card/20 flex items-center justify-center mb-8 relative z-10"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center shadow-lg mb-4">
            <ShoppingBag className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-white leading-tight">
            {forgotPassword ? "Vamos recuperar\nsua conta" : tab === "login" ? "Bem-vindo\nde volta!" : "Crie sua\nconta"}
          </h1>
          <p className="text-white/70 text-sm mt-2">
            {forgotPassword ? "Enviaremos um link seguro para o seu e-mail." : tab === "login"
              ? "Entre para acessar seus pedidos e favoritos."
              : "Compre dos melhores comércios de Chapecó."}
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 -mt-6 rounded-t-[28px] bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-5 pt-6 pb-10">
        {/* Tab Toggle */}
        {!forgotPassword && <div className="flex bg-muted rounded-2xl p-1 mb-6">
          <button
            onClick={() => setTab("login")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              tab === "login" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setTab("register")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              tab === "register" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Cadastrar
          </button>
        </div>}

        <AnimatePresence mode="wait">
          {forgotPassword ? (
            <motion.form key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              {forgotSent ? <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground"><ShoppingBag className="h-6 w-6" /></div><h2 className="font-black">Confira seu e-mail</h2><p className="mt-2 text-sm text-muted-foreground">Se existir uma conta com esse endereço, o link chegará em alguns minutos e será válido por 30 minutos.</p></div> : <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">E-mail da sua conta</label><Input type="email" placeholder="seu@email.com" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} required className="h-12" /><Button type="submit" size="lg" className="mt-4 h-12 w-full text-base font-bold" disabled={isLoading}>{isLoading ? "Enviando..." : "Enviar link de recuperação"}</Button></div>}
              <button type="button" onClick={() => { setForgotPassword(false); setForgotSent(false) }} className="text-center text-sm font-bold text-primary">Voltar para entrar</button>
            </motion.form>
          ) : tab === "login" ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleLogin}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  E-mail
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <button type="button" onClick={() => { setForgotPassword(true); setForgotEmail(loginEmail) }} className="-mt-2 self-end text-sm font-bold text-primary hover:underline">Esqueci minha senha</button>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Senha
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full mt-2 h-12 text-base font-bold"
                disabled={isLoading}
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>

              <button
                type="button"
                onClick={() => setTab("register")}
                className="text-center text-sm text-muted-foreground mt-2"
              >
                Não tem conta?{" "}
                <span className="text-primary font-bold">Cadastre-se</span>
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleRegister}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Nome completo
                </label>
                <Input
                  placeholder="Seu nome"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  E-mail
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Telefone{" "}
                  <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
                </label>
                <Input
                  type="tel"
                  placeholder="(49) 99999-9999"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="h-12"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Senha
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full mt-2 h-12 text-base font-bold bg-[#C45C2E] hover:bg-[#C45C2E]/90 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Criando conta..." : "Criar Conta"}
              </Button>

              <button
                type="button"
                onClick={() => setTab("login")}
                className="text-center text-sm text-muted-foreground mt-1"
              >
                Já tem conta?{" "}
                <span className="text-primary font-bold">Entrar</span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
