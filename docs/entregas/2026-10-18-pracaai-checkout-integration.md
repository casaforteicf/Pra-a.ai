# PRACA-49 — confirmação de pagamento do checkout integrada
Versão: checkout-payment-integration-1
Data: 18/10/2026, Brasília.

## Escopo
Incorpora à branch da PR #49 as alterações de confirmação de pagamento da PR #52 (head f1086cbe49958afe5fcc1d791a50f9ae7220818b), sem incorporar as demais alterações da branch de inteligência #50.
Preserva o estorno administrativo e os fluxos de cotação/rodada da PR #49.
O webhook de roundsRouter vem antes de asaasWebhooksRouter; referências de checkout seguem por next().

## Comportamento e migração
Checkout novo recebe payment_status=pending; registros legados recebem unknown.
Webhook tradicional permanece desligado por padrão por ASAAS_PAYMENT_WEBHOOK_ENABLED.
O handler autentica o token, consulta o pagamento no Asaas, valida referência, valor e vínculo da cobrança e registra eventos com ID único antes de marcar payment_status=paid.
A migração aditiva/idempotente adiciona campos em orders e cria asaas_payment_events.
Esta etapa não bloqueia automaticamente todos os fluxos de expedição do checkout tradicional: esse gate continua pendente.
Não implementa retenção, split, subcontas, repasse ou escrow.

## Testes desta execução
- node --experimental-vm-modules scripts/test-asaas-integrated-routing.mjs: PASS.
- Testa os dois módulos reais de rotas com banco e Asaas simulados: encaminhamento, confirmação única, duplicidade, autenticação, valor divergente, pagamento pendente, cobrança divergente, feature flag desligada e manutenção de cotações/rodadas.
- Transformação sintática TypeScript dos arquivos de API alterados: passou.
- Build e typecheck completos não executados; teste real com PostgreSQL/Asaas não executado.
- Sem merge, deploy ou aplicação da migração.

## Dependências
O operador retornou LOT_NOT_REGISTERED para o identificador candidato PRACA-49. Registrar/localizar manifesto no host com SHA exato e rollback antes de compilar/homologar. A PR #52 continua aberta; seu escopo financeiro está incorporado nesta branch, sujeito à revisão de integração, sem encerramento automático.
