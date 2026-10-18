# Praça.ai — estorno de pedidos por cotação e rodada

Data: 2026-10-18

Estado: **implementado localmente; aguardando validação completa e homologação**.

## Escopo implementado

- O painel administrativo pode solicitar o estorno integral de uma cobrança Asaas vinculada a um pedido pago, ainda não expedido e com cancelamento em análise.
- A solicitação fica reservada no banco antes da chamada externa. Reenvios concorrentes são bloqueados; timeout/resposta inconclusiva vira `reconciliacao` e não pode ser repetida sem conferência manual no Asaas.
- A conclusão só ocorre após `PAYMENT_REFUNDED`; eventos de parcial, processamento e negativa atualizam estados separados.
- Eventos Asaas de estorno são deduplicados por ID e conferem a cobrança vinculada ao pedido antes de alterar o estado.
- O painel e o comprador veem o estado do estorno. O pedido só passa para cancelado após a confirmação de estorno integral.
- A migração é aditiva e idempotente: adiciona campos à tabela existente e cria a tabela de eventos sem excluir dados.

## Arquivos

- `artifacts/api-server/src/lib/asaas.ts`
- `artifacts/api-server/src/ensure-tables.ts`
- `artifacts/api-server/src/routes/admin.ts`
- `artifacts/api-server/src/routes/rounds.ts`
- `artifacts/api-server/src/routes/cancellations.ts`
- `artifacts/praca-ai/src/pages/AdminPanel.tsx`
- `artifacts/praca-ai/src/components/MarketplaceCancellation.tsx`
- `scripts/test-asaas-refunds.mjs`

## Validação executada

- `scripts/test-marketplace-cancellations.mjs`: passou (autenticação, propriedade do pedido, pedido pago e não expedido, disputa ativa, duplicidade e privacidade).
- `scripts/test-asaas-refunds.mjs`: passou (endpoint Sandbox, payload, rejeição HTTP e bloqueio de ID inválido).
- Esbuild de todos os arquivos TS/TSX alterados: passou.
- `git diff --check`: passou.
- Typecheck e builds completos: **não executados**. O comando `pnpm` tentou reconciliar dependências e falhou com `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`; instalação offline também não encontrou metadados do `@replit/connectors-sdk`.
- Homologação Contabo: **não executada**. Health de homologação consultado e respondeu HTTP 200; o lote precisa ser registrado/publicado na branch e compilado pelo operador antes da promoção.

## Limite financeiro que continua aberto

Este lote implementa o reembolso integral da cobrança recebida pela conta principal da Praça.ai. Ele **não implementa split nem retenção Asaas por vendedor**. O fluxo de Conta Escrow da Asaas é por subconta recebedora e depende do `walletId` do vendedor e da Conta Escrow habilitada/configurada para aquela subconta. O cadastro do lojista conectado hoje não fornece essa carteira. Portanto, liberação financeira ao vendedor após a entrega permanece bloqueada até integrar onboarding/verificação da subconta, guardar o `walletId` com segurança e homologar split + escrow no Sandbox.

Referências oficiais consultadas em 18/10/2026:

- [Estorno de cobrança Asaas](https://docs.asaas.com/reference/estornar-cobranca)
- [Eventos de pagamento e estorno](https://docs.asaas.com/docs/payment-events)
- [Introdução à Conta Escrow](https://docs.asaas.com/docs/introducao-conta-escrow)
- [Split com Conta Escrow](https://docs.asaas.com/docs/split-para-contas-com-conta-escrow)
