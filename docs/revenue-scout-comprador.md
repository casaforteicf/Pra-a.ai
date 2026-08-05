# Revenue Scout — Lado Comprador

Motor de oportunidades pro consumidor final do Praça.ai — espelha o
Revenue Scout do Vendor.ai, mas em cima de `consumers`/`orders`, não de
`leads`. Ver `artifacts/api-server/src/lib/revenueScoutBuyer.ts`.

## Estado em 05/08/2026

**Zero pedidos no Praça.ai até agora** (confirmado direto no banco antes
de escrever qualquer código). Chapecó, a praça-piloto, ainda está
começando. Isso significa: os mecanismos baseados em histórico de
compra (recompra, reativação, milestone) estão implementados com lógica
real, mas **não vão encontrar ninguém ainda** — é o comportamento
correto, não um bug, mesmo padrão do Revenue Scout do Vendor.ai pra um
tenant recém-criado.

## O que está implementado (6 mecanismos, dado real)

| Mecanismo | Situações do documento | Precisa de histórico? |
|---|---|---|
| `carrinho_abandonado` | #23-24 | Não — funciona desde o 1º carrinho |
| `estoque_baixo` | #28 | Não, mas só onde `estoque_quantidade` é preenchido (Veículos, Varejo com grade, Farmácia, Pacotes) |
| `recompra_programada` | #1-8 | Sim — 2+ compras do mesmo produto |
| `reativacao_inativo` | #46-48 | Sim |
| `milestone_compras` | #52 | Sim |
| `pos_compra_avaliacao` | #59-60 | Sim (precisa de pedido entregue) |

## O que NÃO foi construído, e por quê (schema que falta)

Não implementei nada com dado simulado ou lógica capenga. Cada um
desses precisa de uma peça de schema/produto que genuinamente não
existe hoje:

- **navegação intensa (#25), busca sem resultado (#26), conteúdo de
  aquecimento (#55-58)** — precisam de log de navegação/busca por
  consumidor. Não existe rastreio de page-view nem de termo buscado.
- **favorito com preço caindo (#27)** — `favorites` não guarda o preço
  no momento em que o produto foi favoritado, só o vínculo.
- **cupom expirando (#31), promoção relâmpago (#29-30)** — cupons hoje
  são uma constante fixa no código (`couponService.ts`), não atribuídos
  a um consumidor específico com data de expiração individual. Não
  existe entidade de "campanha com prazo" nenhuma.
- **aniversário (#50-51)** — `consumers` não tem data de nascimento.
- **pontos expirando (#39)** — o sistema de moedas (`coins`) é saldo
  simples, sem conceito de expiração.
- **assinatura/reposição automática (#38, #41), benefício de fidelidade
  não usado (#40)** — não existem como produto no Praça.ai hoje.
- **serviços financeiros (#42-45)** — crédito, empréstimo, seguro:
  Praça.ai não oferece nenhum produto financeiro. Pré-requisito de
  negócio, não só técnico.
- **produto com nova versão (#61)** — catálogo não tem conceito de
  "versão"/sucessor de um produto.
- **gatilhos externos (#63-68)** — geolocalização por IP, clima,
  integração com loja física: dependem de dado externo que o Praça.ai
  não coleta.

Existentes mas não implementados por escopo (dado já existe, é só
questão de escrever a query, mais rápido de completar depois):
**cross_sell (#9-16), upsell (#17-22), sazonalidade_evento (#32-37),
nps_baixo (#54), auto_presente (#62)**.

## O maior gap de todos: não existe canal de envio genérico

O motor decide **quem** recebe **qual** mensagem (grava em
`scout_pra_oportunidades`). Ele **não envia nada** — não existe
integração de push notification, SMS ou e-mail transacional no Praça.ai
hoje. Só existe WhatsApp, e só pra confirmação de pedido de farmácia.

Sem isso, o motor gera oportunidades que ficam só no banco, sem chegar
no comprador. Esse é o próximo passo real antes de tudo isso valer a
pena de verdade — precisa de uma decisão de produto (qual provedor de
push/SMS/e-mail usar) antes de ter código.

## Como rodar hoje

Não existe cron configurado ainda (rodar automaticamente todo dia, como
o documento descreve na seção 4 — 06h/07h/08h/13h/18h). Por enquanto,
dispara manualmente:

```
POST /api/admin/scout/rodar
Header: x-admin-key: <PRACA_ADMIN_API_KEY>
```

## Governança (seção 5 do documento) — implementada

- Push: 1x/dia por comprador
- SMS/E-mail: 2x/semana
- Suprime se o comprador já converteu (comprou) no dia
- Não duplica oportunidade pendente da mesma regra pro mesmo comprador

Ver `LIMITES_POR_CANAL` em `revenueScoutBuyer.ts` pra ajustar.
