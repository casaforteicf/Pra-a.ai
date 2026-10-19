# PRACA-49 — integração do webhook Asaas
Versão: webhook-routing-1
Atualizado em 18/10/2026 (Brasília).

## Problema e comportamento
A PR #49 registra POST /api/webhooks/asaas para cotações/rodadas. A PR #52, ainda separada, registra o mesmo endpoint para checkout tradicional. O handler de rodadas respondia 200 ignorado para referências alheias, impedindo a execução de um handler posterior no Express.

Agora referências fora dos prefixos PRACA_QUOTE_REQUEST: e PRACA_ROUND_ORDER: são encaminhadas por next(), antes da autenticação específica de rodadas. Isso não confirma pagamento nem altera dados: a autenticação do handler seguinte continua obrigatória. Eventos dos prefixos próprios continuam autenticados; ausência de ID da cobrança retorna 400. Comparação de tokens usa tamanho dos buffers, evitando exceção em tokens multibyte.

## Evidência
- Base: PR #49, SHA 17f1ee863d3fa49f2d2c9770e678f5d445ac7178.
- Arquivos: artifacts/api-server/src/routes/rounds.ts; scripts/test-asaas-webhook-routing.mjs.
- Executado: node --experimental-vm-modules scripts/test-asaas-webhook-routing.mjs.
- Resultado: PASS para encaminhamento do checkout, autenticação dos dois prefixos, token multibyte, ausência de ID e zero chamadas externas.
- O teste carrega e transforma o módulo TypeScript real com Node 24 e isola dependências. Não substitui build/typecheck nem homologação com PostgreSQL/Asaas.
- Sem migração neste ajuste.

## Estado e dependências
Implementado e validado em teste isolado; sem homologação, merge ou deploy.
A PR #52 continua em branch separada, com base na PR #50. A composição completa e a ordem dos routers devem ser verificadas no candidato integrado.
A consulta de status do identificador candidato PRACA-49 retornou LOT_NOT_REGISTERED/BUILD=BLOCKED. O conector disponível não lista nem cadastra manifestos. O registro no host e a implantação do SHA exato seguem pendentes.
Retenção e repasse automático aos lojistas não são implementados por este ajuste.
