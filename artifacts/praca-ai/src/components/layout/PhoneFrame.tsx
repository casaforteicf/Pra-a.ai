import * as React from "react"
import { useLocation } from "wouter"
import { BottomNav } from "./BottomNav"

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const hasOwnNavigation = location === "/" || location.startsWith("/cotacao")

  return (
    <div className="min-h-[100dvh] w-full bg-[#F8FAFC]">
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-[1500px] flex-col overflow-hidden bg-background lg:border-x lg:border-[#E5EAF0]">
        <div className={hasOwnNavigation ? "relative flex-1 overflow-y-auto overflow-x-hidden" : "relative flex-1 overflow-y-auto overflow-x-hidden pb-[88px] pt-0 lg:pb-0 lg:pt-[72px]"}>
          {children}
        </div>

        {hasOwnNavigation ? null : <BottomNav />}
      </div>
    </div>
  )
}
