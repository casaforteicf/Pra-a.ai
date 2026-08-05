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

## O que está implementado (22 mecanismos, dado real)

| Mecanismo | Situações do documento | Precisa de histórico? |
|---|---|---|
| `carrinho_abandonado` | #23-24 | Não |
| `estoque_baixo` | #28 | Não, só onde `estoque_quantidade` é preenchido |
| `favorito_preco_caiu` | #27 | Não — precisa só de 1 favorito com preço salvo |
| `navegacao_intensa` | #25 | Não — precisa só de views recentes |
| `busca_sem_resultado` | #26 | Não |
| `cupom_expirando` | #31 | Não — precisa de cupom atribuído a alguém |
| `promocao_relampago` | #29-30 | Não — precisa de campanha cadastrada |
| `aniversario` | #50-51 | Não — precisa de data de nascimento cadastrada |
| `recompra_programada` | #1-8 | Sim |
| `reativacao_inativo` | #46-48 | Sim |
| `milestone_compras` | #52 | Sim |
| `pos_compra_avaliacao` | #59-60 | Sim |
| `cross_sell` | #9-16 | Sim (config: pares de produto) |
| `upsell` / `produto_nova_versao` | #17-22, #61 | Sim (config: produtoSucessorId no catálogo) |
| `sazonalidade_evento` | #32-37 | Sim (13 meses de histórico) |
| `nps_baixo` | #54 | Não — precisa de resposta de NPS |
| `pontos_expirando` | #39 | Não — precisa de coin_transactions com validade |
| `beneficio_nao_usado` | #40 | Não — precisa de benefício atribuído |
| `adesao_assinatura` | #38 | Sim |
| `assinatura_cancelada` | #68 | Sim (precisa de assinatura cancelada) |
| `gatilho_externo` (só horário de almoço) | #64 | Sim |
| `auto_presente` | #62 | Sim |

Todos os 16 que faltavam schema (ver seção anterior desta versão do
documento) agora têm tabela e lógica reais — nada com dado simulado.

## O que continua de fora, e por quê (agora são só 3)

- **Serviços financeiros (#42-45)** — crédito pré-aprovado, empréstimo,
  seguro. Não construí infraestrutura pra isso porque é uma **decisão
  de negócio antes de ser decisão técnica**: significa Praça.ai
  emprestar/segurar dinheiro de verdade, com implicação regulatória
  (licença financeira, CDC, etc.) que ninguém decidiu ainda. Adicionar
  uma tabela não resolve isso.
- **Gatilhos por geolocalização/clima (#63, #65, #66 parcial)** —
  "mudança de cidade" e "frio se aproximando" precisam de API externa
  de verdade (geolocalização por IP, previsão do tempo) que não tenho
  acesso/chave configurada. `horário de almoço` (#64) e `aumento de
  renda` (#66, via ticket médio subindo) SÃO gatilhos externos que não
  precisam de API — esses dois foram implementados.
- **Pet completando 1 ano (#67)** — precisaria de um cadastro de pet
  (espécie, data de nascimento) que não existe no Praça.ai — é uma
  entidade nova, decisão de produto se vale a pena pro marketplace
  genérico (diferente do Vendor.ai, que já tem isso specific pra Pet
  Shop).

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
