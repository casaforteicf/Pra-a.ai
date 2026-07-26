import * as React from "react"
import { useLocation } from "wouter"
import { ChevronLeft, Package, Truck, CheckCircle2, Clock, ShoppingBag, ChevronDown } from "lucide-react"
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react"
import { useAuth } from "@/contexts/AuthContext"
import { formatMoney } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  confirmed: {
    label: "Confirmado",
    color: "bg-blue-100 text-blue-700",
    icon: <Clock className="w-3 h-3" />,
  },
  preparing: {
    label: "Em Preparo",
    color: "bg-amber-100 text-amber-700",
    icon: <Package className="w-3 h-3" />,
  },
  shipped: {
    label: "Enviado",
    color: "bg-violet-100 text-violet-700",
    icon: <Truck className="w-3 h-3" />,
  },
  out_for_delivery: {
    label: "A Caminho",
    color: "bg-orange-100 text-orange-700",
    icon: <Truck className="w-3 h-3" />,
  },
  delivered: {
    label: "Entregue",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
}

export default function MyOrders() {
  const [, setLocation] = useLocation()
  const { user, isLoading: authLoading } = useAuth()
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const { data: orders, isLoading } = useListOrders({
    query: {
      queryKey: getListOrdersQueryKey(),
      enabled: !!user,
    },
  })

  if (authLoading) {
    return (
      <div className="flex flex-col w-full min-h-full animate-pulse bg-background p-4 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full min-h-full bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black">Meus Pedidos</h1>
      </header>

      <div className="p-4 flex flex-col gap-3">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-black mb-2">Entre para ver seus pedidos</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Faça login para acompanhar suas compras.
            </p>
            <Button onClick={() => setLocation("/login")}>Entrar</Button>
          </div>
        ) : isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />)
        ) : !orders || orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-black mb-2">Nenhum pedido ainda</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Explore nossos produtos e faça seu primeiro pedido!
            </p>
            <Button onClick={() => setLocation("/")}>Explorar Produtos</Button>
          </div>
        ) : (
          (orders as any[]).map((order) => {
            const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.confirmed
            const isExpanded = expandedId === order.id
            const date = new Date(order.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })

            return (
              <motion.div
                key={order.id}
                layout
                className="bg-background rounded-2xl border shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-black text-sm">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${status.color}`}
                      >
                        {status.icon} {status.label}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {(order.items ?? []).slice(0, 3).map((item: any, i: number) => (
                        <img
                          key={i}
                          src={item.productImageUrl}
                          alt={item.productName}
                          className="w-9 h-9 rounded-lg object-cover border-2 border-white"
                        />
                      ))}
                      {(order.items?.length ?? 0) > 3 && (
                        <div className="w-9 h-9 rounded-lg bg-muted border-2 border-white flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          +{order.items.length - 3}
                        </div>
                      )}
                    </div>
                    <span className="font-black text-primary">
                      {formatMoney(order.total)}
                    </span>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t px-4 py-4 bg-muted/30"
                    >
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                        Itens do Pedido
                      </h4>
                      <div className="flex flex-col gap-2 mb-4">
                        {(order.items ?? []).map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-3">
                            <img
                              src={item.productImageUrl}
                              alt={item.productName}
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity}x • {formatMoney(item.price)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Entrega prevista</span>
                        <span className="font-bold">
                          {order.estimatedDelivery
                            ? new Date(order.estimatedDelivery + "T00:00:00").toLocaleDateString(
                                "pt-BR",
                                { day: "2-digit", month: "short" },
                              )
                            : "—"}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
