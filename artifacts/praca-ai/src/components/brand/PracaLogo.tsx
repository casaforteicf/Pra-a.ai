import { cn } from "@/lib/utils"

type PracaLogoProps = {
  inverse?: boolean
  compact?: boolean
  className?: string
}

export function PracaLogo({ inverse = false, compact = false, className }: PracaLogoProps) {
  const wordColor = inverse ? "text-white" : "text-[#0B2240]"

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        className="h-9 w-9 shrink-0"
      >
        <path d="M5 5.5h17.2c7.5 0 12.8 4.6 12.8 11.4 0 6.9-5.3 11.6-12.8 11.6H13V35H5V5.5Z" fill="#10D3B8" />
        <path d="M13 12.2h8.5c3.2 0 5.3 1.8 5.3 4.7 0 2.9-2.1 4.8-5.3 4.8H13v-9.5Z" fill="#0B2240" />
        <path d="M5 27.2 13 35H5v-7.8Z" fill="#00DB98" />
      </svg>
      {compact ? null : (
        <span className={cn("font-[Manrope] text-xl font-extrabold leading-none tracking-[-0.04em] sm:text-2xl", wordColor)}>
          Praça<span className="text-[#10D3B8]">.ai</span>
          <small className={cn("mt-1 block text-[8px] font-semibold tracking-[0.02em]", inverse ? "text-white/60" : "text-[#4B5563]")}>Tudo para seus negócios</small>
        </span>
      )}
    </span>
  )
}
