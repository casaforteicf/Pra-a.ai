import * as React from "react"
import { useLocation } from "wouter"
import { ChevronLeft, CreditCard, QrCode, Receipt, Check, ArrowRight, Tag, X } from "lucide-react"
import { useGetCart, getGetCartQueryKey, useProcessCheckout, useValidateCoupon } from "@workspace/api-client-react"
import { useAuth } from "@/contexts/AuthContext"
import { formatMoney } from "@/lib/utils"
import { PageLoader } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"

export default function Checkout() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: cart, isLoading } = useGetCart({
    query: { queryKey: getGetCartQueryKey() }
  })

  const checkoutMutation = useProcessCheckout()
  const validateCouponMutation = useValidateCoupon()

  const [step, setStep] = React.useState(1)

  // Dados de contato pra quem está comprando sem login — obrigatórios
  // nesse caso (o pedido precisa de um jeito de contatar o cliente).
  const [guestName, setGuestName] = React.useState('')
  const [guestPhone, setGuestPhone] = React.useState('')
  const [cpf, setCpf] = React.useState('')
  const isGuest = !user

  // Form State
  const [address, setAddress] = React.useState({
    zipCode: '89801-000',
    street: 'Av. Getúlio Vargas',
    number: '123N',
    complement: 'Apto 402',
    neighborhood: 'Centro',
    city: 'Chapecó',
    state: 'SC'
  })

  const [deliveryOption, setDeliveryOption] = React.useState<'express' | 'standard'>('express')
  const [paymentMethod, setPaymentMethod] = React.useState<'credit_card' | 'pix' | 'boleto'>('pix')

  const [couponCode, setCouponCode] = React.useState(() => localStorage.getItem('praca-influencer-coupon') || '')
  const [appliedCoupon, setAppliedCoupon] = React.useState<{ code: string; discount: number; description: string } | null>(null)
  const [couponError, setCouponError] = React.useState('')

  const [cardData, setCardData] = React.useState({
    number: '',
    holder: '',
    expiry: '',
    cvv: ''
  })

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return
    setCouponError('')
    validateCouponMutation.mutate(
      { data: { code: couponCode.trim().toUpperCase(), orderValue: cart?.subtotal ?? 0 } },
      {
        onSuccess: (data: any) => {
          setAppliedCoupon({ code: couponCode.trim().toUpperCase(), discount: data.discount, description: data.description ?? `Desconto aplicado` })
          localStorage.setItem('praca-influencer-coupon', couponCode.trim().toUpperCase())
          toast({ title: "Cupom aplicado!", description: data.description ?? `Desconto de ${formatMoney(data.discount)}` })
        },
        onError: () => {
          setCouponError('Cupom inválido ou expirado.')
        }
      }
    )
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
    localStorage.removeItem('praca-influencer-coupon')
  }

  if (isLoading) return <PageLoader />
  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-background">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
          <Receipt className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-black mb-2">Seu carrinho está vazio</h2>
        <p className="text-muted-foreground mb-6">Explore nossas categorias e encontre as melhores ofertas da cidade.</p>
        <Button onClick={() => setLocation('/')}>Voltar para o Início</Button>
      </div>
    )
  }

  const handleNext = () => setStep(prev => Math.min(prev + 1, 3))
  const handleBack = () => {
    if (step > 1) setStep(prev => prev - 1)
    else window.history.back()
  }

  const shipping = deliveryOption === 'express' ? 12.9 : 0
  const pixDiscount = paymentMethod === 'pix' ? Math.round((cart.subtotal ?? 0) * 0.1 * 100) / 100 : 0
  const couponDiscount = appliedCoupon?.discount ?? 0
  const totalDiscount = pixDiscount + couponDiscount
  const grandTotal = (cart.subtotal ?? 0) + shipping - totalDiscount

  const handleSubmit = () => {
    if (isGuest && (!guestName.trim() || !guestPhone.trim())) {
      toast({
        title: "Faltam seus dados",
        description: "Preencha nome e telefone pra continuar sem login.",
        variant: "destructive"
      })
      setStep(1)
      return
    }

    const cpfDigits = cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11) {
      toast({
        title: "CPF inválido",
        description: "Preencha um CPF válido pra continuar.",
        variant: "destructive"
      })
      setStep(1)
      return
    }

    checkoutMutation.mutate({
      data: {
        deliveryAddress: address as any,
        deliveryOption: deliveryOption as any,
        paymentMethod: paymentMethod as any,
        couponCode: appliedCoupon?.code ?? undefined,
        cpf: cpfDigits,
        ...(isGuest ? { guestName: guestName.trim(), guestPhone: guestPhone.trim() } : {}),
        ...(paymentMethod === 'credit_card' ? {
          cardNumber: cardData.number,
          cardHolder: cardData.holder,
          cardExpiry: cardData.expiry,
          cardCvv: cardData.cvv
        } : {})
      } as any
    }, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() })
        const orderId = data?.order?.id ?? data?.id
        setLocation(orderId ? `/success/${orderId}` : '/success/0')
      },
      onError: () => {
        toast({
          title: "Erro ao finalizar",
          description: "Ocorreu um problema. Tente novamente.",
          variant: "destructive"
        })
      }
    })
  }

  return (
    <div className="flex flex-col w-full min-h-full pb-52 bg-background relative">
      <header className="sticky top-0 inset-x-0 z-30 border-b bg-background/95 px-4 pb-3 pt-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black">Finalizar Pedido</h1>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mt-6 mb-2">
          {[1, 2, 3].map(i => (
            <React.Fragment key={i}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors duration-300 ${
                step >= i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {step > i ? <Check className="w-4 h-4" /> : i}
              </div>
              {i < 3 && <div className={`flex-1 h-1 rounded-full transition-colors duration-300 ${step > i ? 'bg-primary' : 'bg-muted'}`} />}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground px-1 uppercase tracking-wider">
          <span className={step >= 1 ? 'text-primary' : ''}>Endereço</span>
          <span className={step >= 2 ? 'text-primary' : ''}>Entrega</span>
          <span className={step >= 3 ? 'text-primary' : ''}>Pagamento</span>
        </div>
      </header>

      <div className="p-4 flex-1">
        <AnimatePresence mode="wait">
          {/* STEP 1: ADDRESS */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <h2 className="font-bold text-lg mb-2">Para onde vamos enviar?</h2>

              {isGuest && (
                <div className="space-y-4 pb-2 border-b mb-2">
                  <p className="text-sm text-muted-foreground">Seus dados de contato</p>
                  <Input placeholder="Nome completo" value={guestName} onChange={e => setGuestName(e.target.value)} />
                  <Input placeholder="Telefone (com DDD)" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
                </div>
              )}

              <div className="space-y-4 pb-2 border-b mb-2">
                <p className="text-sm text-muted-foreground">CPF (necessário pra confirmar o pagamento)</p>
                <Input placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(e.target.value)} maxLength={14} />
              </div>

              <div className="space-y-4">
                <Input placeholder="CEP" value={address.zipCode} onChange={e => setAddress({...address, zipCode: e.target.value})} />
                <div className="grid grid-cols-[2fr_1fr] gap-3">
                  <Input placeholder="Rua / Avenida" value={address.street} onChange={e => setAddress({...address, street: e.target.value})} />
                  <Input placeholder="Número" value={address.number} onChange={e => setAddress({...address, number: e.target.value})} />
                </div>
                <Input placeholder="Complemento (Opcional)" value={address.complement} onChange={e => setAddress({...address, complement: e.target.value})} />
                <Input placeholder="Bairro" value={address.neighborhood} onChange={e => setAddress({...address, neighborhood: e.target.value})} />
                <div className="grid grid-cols-[2fr_1fr] gap-3">
                  <Input placeholder="Cidade" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
                  <Input placeholder="Estado" value={address.state} onChange={e => setAddress({...address, state: e.target.value})} />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: DELIVERY & COUPON */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h2 className="font-bold text-lg mb-4">Opções de Entrega</h2>
                <div className="flex flex-col gap-3">
                  <div
                    onClick={() => setDeliveryOption('express')}
                    className={`p-4 rounded-2xl border-2 transition-colors cursor-pointer flex items-center justify-between ${
                      deliveryOption === 'express' ? 'border-primary bg-primary/5' : 'border-muted bg-card'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">Entrega Expressa</span>
                      <span className="text-xs text-muted-foreground">Em até 2 horas</span>
                    </div>
                    <span className="font-black text-terracota">R$ 12,90</span>
                  </div>

                  <div
                    onClick={() => setDeliveryOption('standard')}
                    className={`p-4 rounded-2xl border-2 transition-colors cursor-pointer flex items-center justify-between ${
                      deliveryOption === 'standard' ? 'border-primary bg-primary/5' : 'border-muted bg-card'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">Padrão</span>
                      <span className="text-xs text-muted-foreground">1 a 2 dias úteis</span>
                    </div>
                    <span className="font-black text-primary">Grátis</span>
                  </div>
                </div>
              </div>

              <div className="bg-card border rounded-2xl p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Cupom de Desconto
                </h3>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
                    <div>
                      <p className="font-bold text-sm text-primary">{appliedCoupon.code}</p>
                      <p className="text-xs text-muted-foreground">-{formatMoney(appliedCoupon.discount)}</p>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite o código"
                        className="bg-muted uppercase"
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError('') }}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                      />
                      <Button
                        variant="outline"
                        className="shrink-0"
                        onClick={handleApplyCoupon}
                        disabled={validateCouponMutation.isPending || !couponCode.trim()}
                      >
                        {validateCouponMutation.isPending ? '...' : 'Aplicar'}
                      </Button>
                    </div>
                    {couponError && <p className="text-xs text-destructive mt-2">{couponError}</p>}
                    <p className="text-[10px] text-muted-foreground mt-2">Tente: PRACA10, VERAO25, FRETEGRATIS</p>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3: PAYMENT */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <h2 className="font-bold text-lg mb-2">Como você prefere pagar?</h2>

              <div className="flex bg-muted p-1 rounded-2xl">
                <button
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${paymentMethod === 'pix' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                  <QrCode className="w-4 h-4" /> Pix
                </button>
                <button
                  onClick={() => setPaymentMethod('credit_card')}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${paymentMethod === 'credit_card' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                  <CreditCard className="w-4 h-4" /> Cartão
                </button>
              </div>

              {paymentMethod === 'pix' && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-card rounded-2xl shadow-sm flex items-center justify-center mb-4">
                    <QrCode className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-black text-primary text-lg mb-1">Pagamento via Pix</h3>
                  <p className="text-sm text-muted-foreground">Você terá 10 minutos para pagar o QR Code que será gerado na próxima tela.</p>
                  <div className="mt-4 bg-terracota/10 text-terracota px-3 py-1 rounded-full text-xs font-bold">
                    + 10% de desconto automático
                  </div>
                </div>
              )}

              {paymentMethod === 'credit_card' && (
                <div className="flex flex-col gap-4">
                  <div className="w-full h-48 rounded-2xl bg-gradient-to-tr from-zinc-900 to-zinc-700 p-6 flex flex-col justify-between text-white shadow-xl">
                    <div className="flex justify-between items-center">
                      <div className="w-10 h-8 bg-card/20 rounded-md" />
                      <div className="font-mono text-xl font-bold tracking-wider opacity-50">VISA</div>
                    </div>
                    <div className="font-mono text-xl tracking-widest mt-2">
                      {cardData.number || '•••• •••• •••• ••••'}
                    </div>
                    <div className="flex justify-between items-end mt-2 uppercase">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white/50">Titular</span>
                        <span className="font-bold text-sm tracking-widest">{cardData.holder || 'NOME DO TITULAR'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white/50">Validade</span>
                        <span className="font-bold text-sm tracking-widest">{cardData.expiry || 'MM/AA'}</span>
                      </div>
                    </div>
                  </div>

                  <Input placeholder="Número do Cartão" maxLength={19} value={cardData.number} onChange={e => setCardData({...cardData, number: e.target.value})} />
                  <Input placeholder="Nome Impresso" className="uppercase" value={cardData.holder} onChange={e => setCardData({...cardData, holder: e.target.value})} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="MM/AA" maxLength={5} value={cardData.expiry} onChange={e => setCardData({...cardData, expiry: e.target.value})} />
                    <Input placeholder="CVV" maxLength={4} type="password" value={cardData.cvv} onChange={e => setCardData({...cardData, cvv: e.target.value})} />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Order Summary Panel */}
      <div className="fixed bottom-[88px] inset-x-0 z-40 rounded-t-[32px] border-t bg-card/95 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.22)] backdrop-blur-md lg:bottom-0 lg:left-1/2 lg:max-w-4xl lg:-translate-x-1/2">
        <div className="flex justify-between text-sm mb-1 text-muted-foreground">
          <span>Subtotal ({cart.itemCount} itens)</span>
          <span>{formatMoney(cart.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm mb-1 text-muted-foreground">
          <span>Frete</span>
          <span>{deliveryOption === 'express' ? 'R$ 12,90' : 'Grátis'}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between text-sm mb-1 text-primary font-medium">
            <span>{paymentMethod === 'pix' && appliedCoupon ? `Pix (10%) + cupom ${appliedCoupon.code}` : paymentMethod === 'pix' ? 'Desconto Pix (10%)' : `Cupom ${appliedCoupon?.code ?? ''}`}</span>
            <span>-{formatMoney(totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between items-end mb-4 mt-2">
          <span className="font-bold">Total</span>
          <span className="text-2xl font-black text-primary">
            {formatMoney(grandTotal)}
          </span>
        </div>

        {step < 3 ? (
          <Button size="lg" className="w-full flex items-center justify-center gap-2" onClick={handleNext}>
            Continuar <ArrowRight className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full bg-terracota hover:bg-terracota/90 text-white"
            onClick={handleSubmit}
            disabled={checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? 'Processando...' : 'Finalizar Pedido'}
          </Button>
        )}
      </div>
    </div>
  )
}
