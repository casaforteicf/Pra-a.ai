import * as React from "react"

export type MarketplaceCity = { city: string; state: string }
const STORAGE_KEY = "praca-marketplace-city"
const EVENT_NAME = "praca-marketplace-city-change"

export function readMarketplaceCity(): MarketplaceCity {
  if (typeof window === "undefined") return { city: "", state: "" }
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")
    return {
      city: typeof value.city === "string" ? value.city.trim() : "",
      state: typeof value.state === "string" ? value.state.trim().toUpperCase().slice(0, 2) : "",
    }
  } catch {
    return { city: "", state: "" }
  }
}

export function saveMarketplaceCity(value: MarketplaceCity) {
  const city = { city: value.city.trim(), state: value.state.trim().toUpperCase().slice(0, 2) }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(city))
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: city }))
  return city
}

export function useMarketplaceCity() {
  const [location, setLocation] = React.useState<MarketplaceCity>(() => readMarketplaceCity())
  React.useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<MarketplaceCity>).detail
      setLocation(detail ?? readMarketplaceCity())
    }
    window.addEventListener(EVENT_NAME, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(EVENT_NAME, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])
  return { ...location, setLocation: saveMarketplaceCity }
}
