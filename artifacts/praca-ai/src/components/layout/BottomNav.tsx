import * as React from "react"
import { Link, useLocation } from "wouter"
import { Home, User, ShoppingCart, ClipboardList, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { PracaLogo } from "@/components/brand/PracaLogo"

export function BottomNav() {
  const [location] = useLocation()
  
  const navItems = [
    { href: "/", icon: Home, label: "Início" },
    { href: "/listing", icon: ShoppingCart, label: "Comprar" },
    { href: "/cotacao", icon: ClipboardList, label: "Cotação" },
    { href: "/rodadas", icon: Users, label: "Rodadas" },
    { href: "/profile", icon: User, label: "Conta" },
  ]

  const mobileItems = [
    { href: "/", icon: Home, label: "Início" },
    { href: "/listing", icon: ShoppingCart, label: "Comprar" },
    { href: "/cotacao", icon: ClipboardList, label: "Cotação" },
    { href: "/rodadas", icon: Users, label: "Rodadas" },
    { href: "/profile", icon: User, label: "Conta" },
  ]
  return (
    <>
    <nav aria-label="Navegação principal mobile" className="absolute inset-x-0 bottom-0 z-40 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-[#E5EAF0] bg-white pb-[env(safe-area-inset-bottom)] text-[#0B2240] shadow-sm lg:hidden">
      {mobileItems.map(item => {
        const active = location === item.href || (item.href !== "/" && !item.href.includes("?") && location.startsWith(item.href))
        return <Link key={item.label} href={item.href} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 text-[10px]",active ? "font-bold text-[#008878]" : "text-[#64748B]")}><item.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.9} />{item.label}</Link>
      })}
    </nav>
    <nav className="absolute bottom-0 inset-x-0 z-40 hidden h-[88px] items-center justify-between border-t border-white/10 bg-[#0B2240] px-6 pb-6 pt-2 text-white shadow-[0_-10px_30px_rgba(11,34,64,.16)] lg:flex lg:top-0 lg:bottom-auto lg:h-[72px] lg:border-b lg:border-t-0 lg:px-8 lg:py-0">
      <Link href="/" className="hidden items-center gap-2 lg:flex">
        <PracaLogo inverse />
      </Link>
      <div className="contents lg:flex lg:h-full lg:items-center lg:gap-2">
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href))
        return (
          <Link key={item.href} href={item.href} className="group flex flex-1 flex-col items-center justify-center gap-1 lg:h-10 lg:flex-none lg:flex-row lg:gap-2 lg:rounded-xl lg:px-4 lg:hover:bg-muted">
            <div className={cn(
              "rounded-xl p-2 transition-all duration-200 lg:p-0",
              isActive ? "bg-[#10D3B8]/15 text-[#10D3B8]" : "text-white/55 group-hover:text-white"
            )}>
              <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={cn(
              "text-[10px] font-bold transition-colors duration-200 lg:text-sm",
              isActive ? "text-[#10D3B8]" : "text-white/55"
            )}>
              {item.label}
            </span>
          </Link>
        )
      })}
      </div>
    </nav>
    </>
  )
}
