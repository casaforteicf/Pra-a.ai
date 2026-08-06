import * as React from "react"
import { useLocation, useRoute } from "wouter"
import { CheckCircle2, MessageSquare, Package, Truck, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react"
import { formatMoney } from "@/lib/utils"

export default function Success() {
  const [, setLocation] = useLocation()
  const [, params] = useRoute("/success/:id")
  const orderId = params?.id

  const { data: order } = useGetOrder(orderId!, {
    query: {
      queryKey: getGetOrderQueryKey(orderId!),
      enabled: !!orderId,
    },
  })

  const orderNumber = order?.orderNumber ?? "#PRC-0000"
  const total = order?.total != null ? formatMoney(Number(order.total)) : null

  const trackingEvents = order?.trackingEvents ?? [
    { status: "Pedido Confirmado", description: "Seu pedido foi confirmado", completed: true, timestamp: "" },
    { status: "Em Preparação", description: "O vendedor está preparando seu pedido", completed: false, timestamp: "" },
    { status: "A Caminho", description: "", completed: false, timestamp: "" },
    { status: "Entregue", description: "", completed: false, timestamp: "" },
  ]

  return (
    <div className="flex flex-col w-full min-h-full bg-primary/5 p-6 justify-center items-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-6 shadow-xl shadow-primary/20"
      >
        <CheckCircle2 className="w-12 h-12 text-white" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-black text-center mb-2 text-foreground"
      >
        Pedido Confirmado!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground text-center font-medium mb-2"
      >
        Seu pedido{" "}
        <span className="font-black text-foreground">{orderNumber}</span>{" "}
        foi recebido e já está sendo preparado.
      </motion.p>

      {total && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-black text-primary mb-8"
        >
          {total}
        </motion.p>
      )}

      {!total && <div className="mb-8" />}

      {(order as any)?.pixQrcodeImage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="w-full"
        >
          <Card className="w-full p-6 mb-8 border-none shadow-lg flex flex-col items-center gap-3">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">
              Pague com PIX pra confirmar
            </h3>
            <img
              src={`data:image/png;base64,${(order as any).pixQrcodeImage}`}
              alt="QR Code PIX"
              className="w-48 h-48"
            />
            {(order as any)?.pixPayload && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText((order as any).pixPayload)}
                className="text-xs text-primary underline break-all text-center px-4"
              >
                Copiar código PIX
              </button>
            )}
          </Card>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full"
      >
        <Card className="w-full p-6 mb-8 border-none shadow-lg">
          <h3 className="font-bold mb-6 text-sm text-muted-foreground uppercase tracking-wider">
            Status do Pedido
          </h3>

          <div className="flex flex-col gap-6 relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-muted rounded-full" />

            {trackingEvents.slice(0, 4).map((event: any, i: number) => {
              const icons = [
                <CheckCircle2 className="w-4 h-4 text-white" />,
                <Package className="w-4 h-4" />,
                <Truck className="w-4 h-4" />,
                <Home className="w-4 h-4" />,
              ]
              const completed = event.completed
              const isActive = i > 0 && trackingEvents[i - 1]?.completed && !completed

              return (
                <div
                  key={i}
                  className={`flex items-start gap-4 relative z-10 ${!completed && !isActive ? "opacity-40" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                      completed
                        ? "bg-primary shadow-primary/20"
                        : isActive
                        ? "bg-background border-2 border-primary text-primary"
                        : "bg-muted"
                    }`}
                  >
                    {icons[i]}
                  </div>
                  <div className="flex flex-col pt-1">
                    <span className={`font-bold ${isActive ? "text-primary" : "text-foreground"}`}>
                      {event.status}
                    </span>
                    {event.description && (
                      <span className={`text-xs ${isActive ? "text-primary/70" : "text-muted-foreground"}`}>
                        {event.description}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <div className="w-full flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full bg-card flex items-center gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/5"
          >
            <MessageSquare className="w-5 h-5" />
            Acompanhar via WhatsApp
          </Button>
          <Button className="w-full" onClick={() => setLocation("/")}>
            Continuar Comprando
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
