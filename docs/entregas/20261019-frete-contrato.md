# FRETE-03 — Contrato do checkout — v1
19/10/2026. PR #49, branch feat/pracaai-cotacao-direta-ciclo.
## Implementado
- expectedShipping obrigatório no OpenAPI, nos tipos CheckoutInput de ambas bibliotecas e no validador ProcessCheckoutBody; número finito não negativo.
- Documentado POST /checkout/freight com sessão/carrinho, endereço, modalidade, composição por loja e erros.
- Não altera cálculo ou cobrança. Complementa FRETE-01 e FRETE-02.
## Validação e limites
- Transformação sintática Node dos tipos/validador: PASS local.
- Conferência estrutural: campo presente nos quatro contratos e endpoint documentado.
- Gerados ajustados manualmente; Orval, Zod real, build/typecheck e homologação NÃO executados. Cliente tipado para consultar frete ainda não regenerado; a tela existente usa fetch direto.
- Consulta Contabo releaseStatus(PRACA-49) nesta execução retornou MCP Internal error. Não comprova saúde nem validação do candidato. Registro anterior tinha lote não registrado.
- Sem merge/deploy. Não executou transação financeira ou migração.
## Próximo gate
Regenerar clientes a partir do OpenAPI, compilar e homologar o SHA integrado na Contabo antes de promover.
