import * as React from "react"
import { StoryViewer, type VendorStoriesGroup } from "@/components/StoryViewer"

// Fileira horizontal de lojas com story ativo, estilo Instagram — cada
// bolinha abre o visualizador fullscreen já naquela loja.
export function StoriesRow({ groups }: { groups: VendorStoriesGroup[] }) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null)

  if (groups.length === 0) return null

  return (
    <section className="bg-white border-b">
      <div className="mx-auto max-w-6xl px-3 py-3">
        <div className="flex gap-4 overflow-x-auto hide-scrollbar">
          {groups.map((group, i) => (
            <button
              key={group.tenantId}
              onClick={() => setOpenIndex(i)}
              className="flex flex-col items-center gap-1 shrink-0 w-16"
            >
              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-primary via-terracota to-primary">
                <div className="w-full h-full rounded-full bg-white p-[2px]">
                  <div className="w-full h-full rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {group.logoUrl ? <img src={group.logoUrl} className="w-full h-full object-cover" /> : group.tenantName[0]}
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-center leading-tight line-clamp-1 w-full">{group.tenantName}</span>
            </button>
          ))}
        </div>
      </div>

      {openIndex !== null && (
        <StoryViewer groups={groups} startGroupIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </section>
  )
}
