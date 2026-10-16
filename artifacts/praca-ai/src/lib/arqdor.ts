const ARQDOR_PRE_PROJECT_URL = "https://app.appvendorai.com/arch/projetos/novo"

type PreProjectReference = {
  type: "terreno" | "ambiente"
  id?: string | number | null
  title?: string | null
  image?: string | null
  areaM2?: number | null
  description?: string | null
  category?: string | null
  specs?: Array<{ label: string; value: string }>
}

function compact(value?: string | null, limit = 600) {
  return value?.trim().slice(0, limit) || ""
}

export function buildArqdorPreProjectUrl(reference?: PreProjectReference) {
  const url = new URL(ARQDOR_PRE_PROJECT_URL)
  url.searchParams.set("origem", "praca-ai")
  url.searchParams.set("aba", "pre-projeto")

  if (!reference) return url.toString()

  url.searchParams.set("tipo", reference.type)
  if (reference.id != null) url.searchParams.set("referencia", String(reference.id))
  if (reference.title) url.searchParams.set("titulo", compact(reference.title, 140))
  if (reference.image) url.searchParams.set("imagem", reference.image)
  if (reference.areaM2) url.searchParams.set("area", String(reference.areaM2))
  if (reference.category) url.searchParams.set("categoria", compact(reference.category, 100))
  if (reference.description) url.searchParams.set("descricao", compact(reference.description))
  if (reference.specs?.length) {
    url.searchParams.set(
      "especificacoes",
      compact(reference.specs.map((spec) => `${spec.label}: ${spec.value}`).join(" | ")),
    )
  }

  return url.toString()
}

export function isFurnitureProduct(category?: string | null, name?: string | null) {
  const value = `${category ?? ""} ${name ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return [
    "moveis",
    "decoracao",
    "sofa",
    "mesa",
    "cadeira",
    "armario",
    "estante",
    "cama",
    "cozinha modulada",
    "sob medida",
  ].some((term) => value.includes(term))
}
