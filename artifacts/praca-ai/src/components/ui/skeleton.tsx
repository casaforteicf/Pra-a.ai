import { Loader2 } from "lucide-react"

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-muted ${className}`}
      {...props}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center min-h-[50vh] text-primary">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  )
}
