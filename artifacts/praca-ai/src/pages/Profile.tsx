import * as React from "react"
import { useLocation } from "wouter"
import { Settings, Package, Heart, Tag, HelpCircle, ChevronRight, LogOut, MapPin, User } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { motion } from "framer-motion"

export default function Profile() {
  const [, setLocation] = useLocation()
  const { user, isLoading, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    setLocation("/")
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?"

  const memberYear = user?.createdAt
    ? new Date(user.createdAt).getFullYear()
    : new Date().getFullYear()

  if (isLoading) {
    return (
      <div className="flex flex-col w-full min-h-full bg-muted/30">
        <div className="bg-primary px-4 pt-12 pb-8 rounded-b-[32px] animate-pulse">
          <div className="h-20 w-20 bg-white/20 rounded-[24px] mb-3" />
          <div className="h-6 w-40 bg-white/20 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full min-h-full bg-muted/30">
      {/* Header Profile Area */}
      <div className="bg-primary px-4 pt-12 pb-8 rounded-b-[32px] text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-2xl" />

        {user ? (
          <div className="flex items-center gap-4 relative z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 rounded-[24px] bg-white text-primary flex items-center justify-center font-black text-2xl shadow-xl rotate-3 shrink-0"
            >
              {initials}
            </motion.div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-2xl font-black truncate">{user.name}</h1>
              <p className="text-white/80 text-sm font-medium flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" /> {user.email}
              </p>
              <div className="bg-white/20 backdrop-blur-sm w-fit px-2 py-0.5 rounded text-[10px] font-bold mt-2 uppercase tracking-wider">
                Membro desde {memberYear}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start relative z-10">
            <div className="w-20 h-20 rounded-[24px] bg-white/20 flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-white/60" />
            </div>
            <h1 className="text-2xl font-black mb-2">Bem-vindo(a)!</h1>
            <p className="text-white/80 text-sm mb-4 max-w-[80%]">
              Entre para fazer pedidos, salvar favoritos e receber ofertas da sua cidade.
            </p>
            <button
              onClick={() => setLocation("/login")}
              className="bg-white text-primary px-6 py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform"
            >
              Entrar ou Cadastrar
            </button>
          </div>
        )}
      </div>

      {/* Menu List */}
      <div className="p-4 flex flex-col gap-3 -mt-4 relative z-20">
        <div className="bg-background rounded-2xl shadow-sm border p-2 flex flex-col">
          <MenuRow
            icon={<Package className="text-primary" />}
            title="Meus Pedidos"
            subtitle="Acompanhe suas entregas"
            onClick={() => (user ? setLocation("/orders") : setLocation("/login"))}
          />
          <div className="h-px bg-muted mx-4" />
          <MenuRow
            icon={<Heart className="text-terracota" />}
            title="Favoritos"
            subtitle="Lojas e produtos salvos"
            onClick={() => (user ? setLocation("/favorites") : setLocation("/login"))}
          />
          <div className="h-px bg-muted mx-4" />
          <MenuRow
            icon={<Tag className="text-amber-500" />}
            title="Meus Cupons"
            subtitle="Descontos disponíveis"
            badge="2"
            onClick={() => {}}
          />
        </div>

        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-2 mt-4 mb-1">
          Ajustes
        </h3>
        <div className="bg-background rounded-2xl shadow-sm border p-2 flex flex-col">
          <MenuRow icon={<MapPin className="text-slate-500" />} title="Endereços" onClick={() => {}} />
          <div className="h-px bg-muted mx-4" />
          <MenuRow icon={<Settings className="text-slate-500" />} title="Configurações do App" onClick={() => {}} />
          <div className="h-px bg-muted mx-4" />
          <MenuRow icon={<HelpCircle className="text-slate-500" />} title="Ajuda & Suporte" onClick={() => {}} />
        </div>

        {user && (
          <button
            onClick={handleLogout}
            className="mt-6 flex items-center justify-center gap-2 text-destructive font-bold p-4 bg-destructive/10 rounded-2xl active:bg-destructive/20 transition-colors"
          >
            <LogOut className="w-5 h-5" /> Sair da conta
          </button>
        )}
      </div>
    </div>
  )
}

function MenuRow({
  icon,
  title,
  subtitle,
  badge,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center p-3 hover:bg-muted/50 transition-colors rounded-xl active:bg-muted group"
    >
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex flex-col items-start ml-4 flex-1">
        <span className="font-bold text-sm text-foreground">{title}</span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {badge && (
        <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center mr-3">
          {badge}
        </div>
      )}
      <ChevronRight className="w-5 h-5 text-muted-foreground group-active:translate-x-1 transition-transform" />
    </button>
  )
}
