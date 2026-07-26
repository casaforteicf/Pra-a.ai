---
name: Praça.ai Phase 2 — Auth & DB Persistence
description: Session auth, DB schema, and persistence for Praça.ai marketplace; runtime and config gotchas
---

## Stack decisions
- Auth: bcryptjs (NOT bcrypt — bcrypt requires native build scripts that don't work in Replit's pnpm env)
- Sessions: express-session + connect-pg-simple backed by PostgreSQL
- Schema: Drizzle ORM in lib/db/src/schema/ — consumers, carts, cart_items, orders, order_items, favorites tables

## Critical gotchas

### connect-pg-simple `createTableIfMissing` breaks with esbuild bundles
**Why:** The option reads a `table.sql` file at runtime from the package directory. esbuild doesn't bundle it, so the path resolves to `dist/table.sql` (missing).  
**How to apply:** Always pre-create the session table via SQL (done once). Never use `createTableIfMissing: true` in this project. SQL:
```sql
CREATE TABLE IF NOT EXISTS "session" ("sid" varchar NOT NULL COLLATE "default", "sess" json NOT NULL, "expire" timestamp(6) NOT NULL, CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

### credentials: 'include' required on all fetches
**Why:** Session cookie must be sent cross-origin. Added to `customFetch` in lib/api-client-react/src/custom-fetch.ts. CORS in app.ts must have `credentials: true` and `origin: true` (not wildcard).

### Session type augmentation
**Why:** TypeScript doesn't know about custom session fields. Declare module in routes/auth.ts:
```ts
declare module "express-session" { interface SessionData { consumerId?: number; cartToken?: string } }
```

### AuthContext placement
**Why:** `useQueryClient` needs QueryClientProvider above it. AuthProvider must be INSIDE QueryClientProvider in App.tsx.

### productData.ts shared module
**Why:** Products are mock data used by products.ts, cart.ts, and orders.ts. Extracted to routes/productData.ts to avoid duplication. Import ALL_PRODUCTS and PRODUCTS_BY_ID from there.

## Frontend structure added (Phase 2)
- `src/contexts/AuthContext.tsx` — AuthProvider + useAuth hook (session via getMe() on mount)
- `src/pages/Login.tsx` — login/register with tab toggle
- `src/pages/MyOrders.tsx` — real orders from DB via useListOrders
- `src/pages/MyFavorites.tsx` — real favorites from DB via useListFavorites
- Routes added: /login, /orders, /favorites, /success/:id

## OpenAPI codegen
Auth endpoints were added to openapi.yaml and codegen was re-run. Generated hooks: useRegisterConsumer, useLoginConsumer, useLogoutConsumer, useGetMe.
useToggleFavorite takes `{productId: string}` as mutate argument.
