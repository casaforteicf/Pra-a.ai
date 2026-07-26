import * as React from "react"
import { Link, useLocation } from "wouter"
import { Home, Search, Heart, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const [location] = useLocation()
  
  const navItems = [
    { href: "/", icon: Home, label: "Início" },
    { href: "/listing", icon: Search, label: "Explorar" },
    { href: "/feed", icon: Heart, label: "Feed" },
    { href: "/profile", icon: User, label: "Conta" },
  ]

  return (
    <div className="absolute bottom-0 inset-x-0 h-[88px] bg-card border-t rounded-b-[40px] px-6 pb-6 pt-2 flex items-center justify-between z-40">
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href))
        return (
          <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center gap-1 group">
            <div className={cn(
              "p-2 rounded-xl transition-all duration-200",
              isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary/70"
            )}>
              <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={cn(
              "text-[10px] font-bold transition-colors duration-200",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
