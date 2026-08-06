import * as React from "react"
import { useLocation } from "wouter"
import { X, ChevronLeft, ChevronRight, Package, ExternalLink } from "lucide-react"

export interface StoryItem {
  id: string
  mediaType: "foto" | "video"
  mediaUrl: string
  produtoId: string | null
  linkUrl: string | null
  caption: string | null
  createdAt: string
}

export interface VendorStoriesGroup {
  tenantId: string
  tenantName: string
  tenantSlug: string
  logoUrl: string | null
  stories: StoryItem[]
}

const PHOTO_DURATION_MS = 5_000

// Visualizador fullscreen tipo Instagram Stories: barra de progresso por
// item, avança sozinho (foto = 5s, vídeo = duração real), toque nas laterais
// pra navegar manual, toque na legenda/produto sai pro destino vinculado.
export function StoryViewer({
  groups, startGroupIndex, onClose,
}: {
  groups: VendorStoriesGroup[]
  startGroupIndex: number
  onClose: () => void
}) {
  const [, setLocation] = useLocation()
  const [groupIndex, setGroupIndex] = React.useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = React.useState(0)
  const [progress, setProgress] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const rafRef = React.useRef<number>()
  const startRef = React.useRef<number>(0)

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]

  const goNext = React.useCallback(() => {
    if (!group) return
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }, [group, storyIndex, groupIndex, groups.length, onClose])

  const goPrev = React.useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex((i) => i - 1)
      setStoryIndex(prevGroup.stories.length - 1)
    }
  }, [storyIndex, groupIndex, groups])

  // Progresso automático — foto avança sozinha em 5s, vídeo segue o
  // timestamp real (fetch da duração via metadata do próprio <video>).
  React.useEffect(() => {
    if (!story) return
    setProgress(0)
    fetch(`/api/home/stories/${story.id}/visualizar`, { method: "POST" }).catch(() => {})

    if (story.mediaType === "video") return // progresso vem do onTimeUpdate

    startRef.current = performance.now()
    function tick(now: number) {
      if (paused) { rafRef.current = requestAnimationFrame(tick); return }
      const elapsed = now - startRef.current
      const pct = Math.min(1, elapsed / PHOTO_DURATION_MS)
      setProgress(pct)
      if (pct >= 1) { goNext(); return }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused])

  React.useEffect(() => {
    if (paused) videoRef.current?.pause()
    else videoRef.current?.play().catch(() => {})
  }, [paused, story?.id])

  if (!group || !story) return null

  const destino = story.produtoId ? `/product/${story.produtoId}` : story.linkUrl

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
      <div className="flex gap-1 px-2 pt-3">
        {group.stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-0.5 rounded-full bg-card/30 overflow-hidden">
            <div
              className="h-full bg-card"
              style={{ width: i < storyIndex ? "100%" : i === storyIndex ? `${progress * 100}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-card/20 overflow-hidden flex items-center justify-center text-white text-xs font-bold">
            {group.logoUrl ? <img src={group.logoUrl} className="w-full h-full object-cover" /> : group.tenantName[0]}
          </div>
          <span className="text-white text-sm font-semibold">{group.tenantName}</span>
        </div>
        <button onClick={onClose} className="text-white p-2"><X className="w-6 h-6" /></button>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {story.mediaType === "foto" ? (
          <img src={story.mediaUrl} className="w-full h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            src={story.mediaUrl}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration) setProgress(v.currentTime / v.duration)
            }}
            onEnded={goNext}
          />
        )}

        {/* Zonas de toque: laterais navegam, segurar no meio pausa */}
        <button className="absolute inset-y-0 left-0 w-1/3" onClick={goPrev} aria-label="Anterior" />
        <button
          className="absolute inset-y-0 right-0 w-1/3"
          onClick={goNext}
          aria-label="Próximo"
        />
        <button
          className="absolute inset-y-0 left-1/3 right-1/3"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          aria-label="Segurar pra pausar"
        />

        {groupIndex > 0 && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 text-white/40"><ChevronLeft className="w-6 h-6" /></div>
        )}
        {groupIndex < groups.length - 1 && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-white/40"><ChevronRight className="w-6 h-6" /></div>
        )}
      </div>

      {(story.caption || destino) && (
        <div className="p-4 space-y-2">
          {story.caption && <p className="text-white text-sm">{story.caption}</p>}
          {destino && (
            <button
              onClick={() => { onClose(); setLocation(destino) }}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-bold py-2.5"
            >
              {story.produtoId ? <><Package className="w-4 h-4" /> Ver produto</> : <><ExternalLink className="w-4 h-4" /> Ver mais</>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
