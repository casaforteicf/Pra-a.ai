import * as React from "react"
import { useLocation } from "wouter"
import { CheckCircle2, MessageSquare, Package, Truck, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"

export default function Success() {
  const [, setLocation] = useLocation()

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

      <h1 className="text-3xl font-black text-center mb-2 text-foreground">Pedido Confirmado!</h1>
      <p className="text-muted-foreground text-center font-medium mb-8">
        Seu pedido <span className="font-black text-foreground">#PRC-8472</span> foi recebido pela loja e já está sendo preparado.
      </p>

      <Card className="w-full p-6 mb-8 border-none shadow-lg">
        <h3 className="font-bold mb-6 text-sm text-muted-foreground uppercase tracking-wider">Status do Pedido</h3>
        
        <div className="flex flex-col gap-6 relative">
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-muted rounded-full"></div>
          
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col pt-1">
              <span className="font-bold text-foreground">Pedido Confirmado</span>
              <span className="text-xs text-muted-foreground">10:42</span>
            </div>
          </div>

          <div className="flex items-start gap-4 relative z-10">
            <div className="w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center shrink-0 text-primary">
              <Package className="w-4 h-4" />
            </div>
            <div className="flex flex-col pt-1">
              <span className="font-bold text-primary">Em Preparo</span>
              <span className="text-xs text-primary/70">O vendedor está embalando seu pedido</span>
            </div>
          </div>

          <div className="flex items-start gap-4 relative z-10 opacity-40">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="flex flex-col pt-1">
              <span className="font-bold">A Caminho</span>
            </div>
          </div>

          <div className="flex items-start gap-4 relative z-10 opacity-40">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <div className="flex flex-col pt-1">
              <span className="font-bold">Entregue</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="w-full flex flex-col gap-3">
        <Button variant="outline" className="w-full bg-white flex items-center gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/5">
          <MessageSquare className="w-5 h-5" />
          Acompanhar via WhatsApp
        </Button>
        <Button className="w-full" onClick={() => setLocation('/')}>
          Continuar Comprando
        </Button>
      </div>
    </div>
  )
}
