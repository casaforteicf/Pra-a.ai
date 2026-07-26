import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getMe, getGetMeQueryKey } from "@workspace/api-client-react"

export interface ConsumerSession {
  id: number | string
  name: string
  email: string
  phone?: string | null
  createdAt?: string
}

interface AuthContextValue {
  user: ConsumerSession | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, phone: string | undefined, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<ConsumerSession | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const queryClient = useQueryClient()

  // Check session on mount
  React.useEffect(() => {
    getMe()
      .then((data) => setUser(data as ConsumerSession))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "E-mail ou senha incorretos.")
    }
    const data = await res.json()
    setUser(data)
    // Invalidate profile and orders so they refetch for new user
    queryClient.invalidateQueries()
  }

  const register = async (name: string, email: string, phone: string | undefined, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, phone: phone || undefined, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Erro ao criar conta.")
    }
    const data = await res.json()
    setUser(data)
    queryClient.invalidateQueries()
  }

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {})
    setUser(null)
    queryClient.clear()
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
