# Praça.ai — expedição de pedidos e confirmação de entrega

Data: 2026-10-18
Estado: **implementado em branch; aguardando homologação**.

## Escopo

- API do Praça.ai disponibiliza ao AppVendor pedidos pagos associados ao lojista autenticado e aceita atualizações controladas da expedição.
- O lojista informa separação, pedido pronto e saída para entrega/retirada, além de modalidade, transportadora, rastreio e observação.
- Dados de contato do comprador só são expostos ao lojista após pagamento confirmado.
- O comprador acompanha a expedição e só confirma o recebimento quando o pedido estiver pronto ou enviado.
- A migração é aditiva e inclui os campos de pagamento, entrega e repasse já usados no fluxo de pedidos de rodada.

## Dependências

- PR Praça.ai #49: API e acompanhamento do comprador.
- PR AppVendor #3564: lista de pedidos e controles de expedição para o lojista.
- `PRACA_ROUNDS_VENDOR_TOKEN` e `PRACA_AI_INTERNAL_API_URL` precisam ser configurados no servidor do AppVendor, em ambiente seguro.

## Validação

- `git diff --check`: passou.
- Praça.ai API build: passou.
- Praça.ai frontend build: passou.
- Praça.ai typecheck: passou.
- AppVendor API `tsconfig.launch-ci` e build: passaram.
- AppVendor frontend build: passou.
- AppVendor frontend typecheck completo: reporta erros preexistentes em vários arquivos. A execução filtrada não apontou erro nos arquivos alterados (`PracaOrders.tsx`, `AppLegacy.tsx`, `SidebarLayoutLegacy.tsx`, `ScoutConfigPanel.tsx`).
- Health de homologação Contabo consultado: HTTP 200. O operador disponível só compila lotes previamente registrados; este lote ainda não foi registrado nem compilado/homologado ali.

## Pendências e limites

- Sem merge, publicação ou alteração de produção.
- O repasse financeiro ao vendedor não foi implementado. O comprador confirmar a entrega não transfere fundos; integração de wallet/transferência Asaas e homologação financeira ponta a ponta permanecem pendentes.
- Ainda falta homologar a integração entre as duas aplicações e validar os cenários de separação, retirada, transportadora e confirmação de entrega.
- A tela não implementa disputa, prova de entrega ou reembolso.
