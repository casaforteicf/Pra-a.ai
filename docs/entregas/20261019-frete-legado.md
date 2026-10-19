# FRETE-02 — Legado e carrinho — v1
Atualizado 19/10/2026.
Branch: feat/pracaai-cotacao-direta-ciclo; PR #49.
## Implementado
- POST /orders legado responde 410 CHECKOUT_LEGACY_RETIRED com endpoints de migração. Não cria pedido nem cobrança. Quebra deliberada de compatibilidade de integrações antigas; precisam montar carrinho e enviar expectedShipping no checkout único. GET /orders permanece.
- Carrinho retorna shipping=null e total=null antes de definir entrega; subtotal e itens preservados. Não assume tarifa fixa ou gratuidade.
- OpenAPI e contratos TypeScript/Zod de GET/POST/DELETE carrinho atualizados em conjunto. Saídas geradas ajustadas manualmente; regeneração completa não executada.
- /frete/calcular exige cidade/UF/subtotal e encaminha UF ao cálculo para não confundir municípios homônimos.
## Validação real
node scripts/test-freight-legacy.mjs PASS local: handler legado extraído sem dependências de banco, buildCartResponse real com catálogo/DB simulados e transformação sintática de rotas/contratos.
Sem build/typecheck completo, validação real Zod, banco, teste visual ou homologação Contabo. Não executou pagamento, merge ou deploy.
## Dependências e pendências
- Complementa FRETE-01 (d79a5d1). Ainda faltam fluxos especializados, contratos/cliente do novo endpoint de frete e validação integral de integrações existentes.
- Contrato null do carrinho exige que consumidores externos não interpretem ausência como zero. UI principal usa subtotal e consulta frete no checkout.
- Mantém regra de não promover sem build e homologação do SHA idêntico. Registro de manifesto Contabo segue bloqueio operacional conhecido.
