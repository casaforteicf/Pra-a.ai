# Praça.ai

Marketplace B2C local para Chapecó, SC — experiência de consumidor (tipo Mercado Livre/iFood), onde o consumidor é cliente da própria Praça.ai. Lê catálogo/produto/estoque dos tenants Vendor.ai (Supabase compartilhado) e tem suas próprias tabelas para pedido, consumidor, avaliação e favoritos.

## Run & Operate

- `pnpm --filter @workspace/praca-ai run dev` — frontend (porta dinâmica via $PORT)
- `pnpm --filter @workspace/api-server run dev` — API server (porta 8080 / /api)
- `pnpm run typecheck` — typecheck completo
- `pnpm --filter @workspace/api-spec run codegen` — regenerar hooks e schemas Zod da spec OpenAPI
- `pnpm --filter @workspace/db run push` — push do schema de DB (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 + shadcn/ui + Framer Motion + Wouter
- API: Express 5 (shared api-server)
- DB: PostgreSQL + Drizzle ORM (pronto para integração Supabase compartilhado)
- Validação: Zod (`zod/v4`), `drizzle-zod`
- Codegen de API: Orval (a partir da spec OpenAPI em `lib/api-spec/openapi.yaml`)

## Where things live

- `artifacts/praca-ai/src/pages/` — páginas: Home, Listing, ProductDetail, Checkout, Success, Feed, Profile
- `artifacts/praca-ai/src/components/` — componentes compartilhados (PhoneFrame, BottomNav, UI)
- `artifacts/api-server/src/routes/` — rotas Express: home, categories, products, orders, cart, coupons, feed, favorites, profile
- `lib/api-spec/openapi.yaml` — contrato OpenAPI (fonte da verdade)
- `lib/api-client-react/src/generated/` — hooks React Query gerados (nunca editar à mão)
- `lib/api-zod/src/generated/` — schemas Zod gerados (usados pelo servidor)

## Architecture decisions

- App renderizado dentro de um PhoneFrame (390×844px) — simula um smartphone no navegador
- Paleta: verde mata (#1A6B3A / #2A8C4E) + terracota (#C45C2E) + creme (#FAF8F4)
- Tipografia: Plus Jakarta Sans (Google Fonts) — peso 900 em títulos heroicos
- Backend usa dados de exemplo (mock) por enquanto — integração Supabase Vendor.ai em etapa futura
- Todos os valores monetários em Real (R$) com formatação brasileira

## Product

- **Home**: header verde, busca, banners, grade de categorias 2×4, ofertas relâmpago, carrosséis por categoria
- **Listing**: grade de produtos com chips de ordenação (relevância, preço, avaliação, ofertas)
- **Product Detail**: galeria de imagens, seletor de tamanho, avaliações, tabs de info, CTAs de compra
- **Checkout multi-etapa**: endereço → entrega + cupom → pagamento (cartão com preview live, Pix com QR, boleto)
- **Success**: confirmação com timeline de rastreio, botão de notificação WhatsApp
- **Feed**: posts de lojistas com curtidas animadas e cards de produto inline
- **Profile**: perfil da usuária, meus pedidos, favoritos, cupons, configurações

## User preferences

_Adicionar conforme o projeto evolui._

## Gotchas

- Após qualquer mudança em `lib/api-spec/openapi.yaml`, rodar `pnpm --filter @workspace/api-spec run codegen` antes de usar os hooks gerados
- As categorias no Home.tsx usam Lucide icons mapeados por `category.slug` — adicionar slug novo requer adicionar o ícone correspondente
- O `index.css` usa valores HSL sem wrapper `hsl()` nas variáveis CSS (padrão do shadcn/ui)
- Integração Supabase Vendor.ai (próxima fase): configurar `DATABASE_URL` apontando para o projeto `gfocphuiyyufwzcyihbk`

## Pointers

- Ver skill `pnpm-workspace` para estrutura do monorepo, TypeScript e dependências
- Ver `lib/api-spec/openapi.yaml` para todos os endpoints e schemas
