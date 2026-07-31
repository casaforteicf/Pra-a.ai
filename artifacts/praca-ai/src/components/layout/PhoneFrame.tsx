import * as React from "react"
import { BottomNav } from "./BottomNav"

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-background lg:bg-muted/30">
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-[1440px] flex-col overflow-hidden bg-background lg:border-x lg:shadow-xl">
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden pb-[88px] pt-0 lg:pb-0 lg:pt-[72px]">
          {children}
        </div>

        <BottomNav />
      </div>
    </div>
  )
}
