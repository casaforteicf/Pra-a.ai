import * as React from "react"
import { BottomNav } from "./BottomNav"

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-zinc-950 sm:p-8">
      <div className="relative w-full h-[100dvh] sm:w-[390px] sm:h-[844px] bg-background sm:rounded-[40px] shadow-2xl overflow-hidden sm:ring-8 sm:ring-zinc-900 sm:ring-offset-4 sm:ring-offset-zinc-800 flex flex-col">
        {/* Notch simulation (hidden on actual mobile, visible on desktop preview) */}
        <div className="hidden sm:flex absolute top-0 inset-x-0 h-7 justify-center z-50 pointer-events-none">
          <div className="w-40 h-7 bg-zinc-900 rounded-b-3xl"></div>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar pb-[88px] relative bg-background">
          {children}
        </div>
        
        <BottomNav />
      </div>
    </div>
  )
}
