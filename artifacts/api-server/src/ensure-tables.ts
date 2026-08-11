import { pool } from "@workspace/db";
import { logger } from "./lib/logger";

// Cria as tabelas próprias do Praça.ai caso ainda não existam. Idempotente
// (CREATE TABLE IF NOT EXISTS em tudo) e seguro num banco compartilhado com
// o Vendor.ai — nunca altera ou remove nada que já exista.
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS consumers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  password_hash text NOT NULL,
  saldo_moedas integer NOT NULL DEFAULT 0,
  ultimo_checkin_em text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carts (
  id serial PRIMARY KEY,
  consumer_id integer REFERENCES consumers(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumer_addresses (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  label text NOT NULL,
  street text NOT NULL,
  number text NOT NULL,
  complement text,
  neighborhood text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consumer_addresses_consumer ON consumer_addresses (consumer_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id serial PRIMARY KEY,
  cart_id integer NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL,
  product_image_url text NOT NULL,
  product_price numeric(10,2) NOT NULL,
  vendor_id text,
  quantity integer NOT NULL DEFAULT 1,
  selected_size text
);

CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  consumer_id integer REFERENCES consumers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'confirmed',
  subtotal numeric(10,2) NOT NULL,
  shipping numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL,
  payment_method text NOT NULL,
  delivery_address text NOT NULL,
  delivery_option text NOT NULL,
  coupon_code text,
  estimated_delivery text,
  tracking_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL,
  product_image_url text NOT NULL,
  quantity integer NOT NULL,
  price_at_purchase numeric(10,2) NOT NULL,
  vendor_id text,
  selected_size text
);

CREATE TABLE IF NOT EXISTS order_deal_links (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id text NOT NULL,
  deal_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_consumer_product UNIQUE (consumer_id, product_id)
);

CREATE TABLE IF NOT EXISTS disputes (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  consumer_id integer REFERENCES consumers(id) ON DELETE SET NULL,
  motivo text NOT NULL,
  descricao text NOT NULL,
  evidencia_url text,
  status text NOT NULL DEFAULT 'aberta',
  frete_devolucao_responsavel text,
  frete_devolucao_valor_vendedor numeric(10,2),
  frete_devolucao_valor_entregador numeric(10,2),
  resolucao_texto text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz
);

CREATE TABLE IF NOT EXISTS product_questions (
  id serial PRIMARY KEY,
  product_id text NOT NULL,
  vendor_id text NOT NULL,
  consumer_id integer REFERENCES consumers(id) ON DELETE SET NULL,
  pergunta text NOT NULL,
  resposta text,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  quantidade integer NOT NULL,
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id serial PRIMARY KEY,
  product_id text NOT NULL,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  nota integer NOT NULL,
  comentario text,
  midia_urls jsonb,
  moedas_ganhas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ambassadors (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL UNIQUE REFERENCES consumers(id) ON DELETE CASCADE,
  codigo text NOT NULL UNIQUE,
  saldo_comissao numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id serial PRIMARY KEY,
  ambassador_id integer NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
  indicado_tipo text NOT NULL,
  indicado_consumer_id integer REFERENCES consumers(id) ON DELETE SET NULL,
  indicado_tenant_id text,
  status text NOT NULL DEFAULT 'pendente',
  valor_comissao numeric(10,2),
  convertido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_partners (
  id serial PRIMARY KEY,
  praca text NOT NULL DEFAULT 'Chapecó',
  nome text NOT NULL,
  telefone text NOT NULL,
  veiculo_tipo text NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  avaliacao_media numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_points (
  id serial PRIMARY KEY,
  praca text NOT NULL DEFAULT 'Chapecó',
  nome text NOT NULL,
  endereco text NOT NULL,
  tipo text NOT NULL DEFAULT 'loja_parceira',
  ativo text NOT NULL DEFAULT 'true',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id text NOT NULL,
  partner_id integer REFERENCES delivery_partners(id) ON DELETE SET NULL,
  support_point_id integer,
  status text NOT NULL DEFAULT 'aguardando',
  valor_pago_parceiro numeric(10,2),
  aceita_em timestamptz,
  coletada_em timestamptz,
  entregue_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session (
  sid varchar PRIMARY KEY NOT NULL,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire);

-- Captura de nome/telefone pra pedidos feitos sem login (checkout anônimo)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_phone text;

-- Estoque real de produto (tabela produtos_catalogo é do Vendor.ai, mas
-- vive no mesmo banco físico — o Praça.ai lê/escreve direto nela via
-- vendorPool). controla_estoque é opt-in por produto: quando false,
-- comportamento antigo (sem checagem) é mantido; quando true, estoque_
-- quantidade passa a valer e bloqueia venda além do disponível.
ALTER TABLE produtos_catalogo ADD COLUMN IF NOT EXISTS estoque_quantidade integer;
ALTER TABLE produtos_catalogo ADD COLUMN IF NOT EXISTS controla_estoque boolean NOT NULL DEFAULT false;

-- Cobrança real via Asaas (só PIX por enquanto — ver comentário em
-- lib/asaas.ts sobre o escopo). Guarda o id da cobrança e o QR code
-- pra exibir na tela de sucesso/pedido.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_charge_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_pix_payload text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_pix_qrcode_image text;

-- CPF obrigatório no checkout (logado ou não) — desbloqueia boleto real
-- além do PIX, e é o dado que a Asaas exige pra cobrança de verdade.
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_cpf text;

-- Razão de repasses pro lojista (cálculo, não split automático — ver
-- comentário em lib/db/src/schema/vendorPayouts.ts).
CREATE TABLE IF NOT EXISTS vendor_payouts (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id text NOT NULL,
  valor_bruto numeric(12,2) NOT NULL,
  comissao_percentual numeric(5,2) NOT NULL,
  comissao_valor numeric(12,2) NOT NULL,
  valor_liquido numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor ON vendor_payouts (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON vendor_payouts (status);

-- Módulo Veículos do Vendor.ai (tabelas próprias, não produtos_catalogo) —
-- nunca foi aplicado no banco de produção porque o Republish do Vendor.ai
-- no Replit está bloqueado. Aplicado aqui pelo mesmo motivo do resto desse
-- arquivo: banco físico compartilhado, Praça.ai consegue rodar migração.
-- CREATE TYPE não aceita IF NOT EXISTS — guarda manual via exceção.
DO $$ BEGIN
  CREATE TYPE veiculos_combustivel AS ENUM ('flex', 'gasolina', 'diesel', 'eletrico', 'hibrido', 'gnv');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE veiculos_cambio AS ENUM ('manual', 'automatico', 'cvt');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE veiculos_status AS ENUM ('disponivel', 'reservado', 'vendido', 'inativo');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE veiculos_test_drive_status AS ENUM ('agendado', 'confirmado', 'realizado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS veiculos_estoque (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  placa text,
  marca text NOT NULL,
  modelo text NOT NULL,
  ano_fabricacao integer,
  ano_modelo integer,
  cor text,
  km integer,
  combustivel veiculos_combustivel,
  cambio veiculos_cambio,
  valor numeric(12,2) NOT NULL,
  valor_promocional numeric(12,2),
  descricao text,
  fotos jsonb,
  status veiculos_status NOT NULL DEFAULT 'inativo',
  vistoria_realizada boolean NOT NULL DEFAULT false,
  vistoria_laudo_url text,
  destaque boolean NOT NULL DEFAULT false,
  vendedor_responsavel_id text REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veiculos_test_drives (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  veiculo_id text NOT NULL REFERENCES veiculos_estoque(id) ON DELETE CASCADE,
  cliente_id text NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  vendedor_id text REFERENCES public.users(id) ON DELETE SET NULL,
  data_hora timestamp NOT NULL,
  status veiculos_test_drive_status NOT NULL DEFAULT 'agendado',
  feedback text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_estoque_tenant ON veiculos_estoque(tenant_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_estoque_status ON veiculos_estoque(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_veiculos_test_drives_tenant ON veiculos_test_drives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_test_drives_veiculo ON veiculos_test_drives(veiculo_id);

-- Módulo Farmácia (migration 039 original do Vendor.ai, nunca aplicada em
-- produção pelo mesmo motivo do módulo Veículos acima).
DO $$ BEGIN
  CREATE TYPE farmacia_categoria_produto AS ENUM (
    'medicamento_generico', 'medicamento_referencia', 'medicamento_similar',
    'perfumaria', 'higiene_pessoal', 'dermocosmeticos', 'infantil',
    'ortopedicos', 'suplementos', 'outros'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE farmacia_pedido_status AS ENUM (
    'aguardando_confirmacao', 'aguardando_receita', 'confirmado',
    'em_separacao', 'saiu_para_entrega', 'entregue', 'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE farmacia_pedido_origem AS ENUM ('whatsapp', 'app', 'balcao');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS farmacia_produtos (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  erp_id text,
  nome text NOT NULL,
  principio_ativo text,
  descricao text,
  categoria farmacia_categoria_produto,
  exige_receita boolean NOT NULL DEFAULT false,
  unidade text NOT NULL DEFAULT 'un',
  preco_venda numeric(12,2) NOT NULL,
  preco_promocional numeric(12,2),
  estoque integer NOT NULL DEFAULT 0,
  imagem_url text,
  ativo boolean NOT NULL DEFAULT true,
  destaque_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farmacia_pedidos (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  origem farmacia_pedido_origem NOT NULL DEFAULT 'whatsapp',
  status farmacia_pedido_status NOT NULL DEFAULT 'aguardando_confirmacao',
  endereco_entrega text,
  tem_item_controlado boolean NOT NULL DEFAULT false,
  receita_url text,
  observacoes text,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  erp_pedido_id text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farmacia_pedido_itens (
  id text PRIMARY KEY,
  pedido_id text NOT NULL REFERENCES farmacia_pedidos(id) ON DELETE CASCADE,
  produto_id text,
  nome_produto text NOT NULL,
  exige_receita boolean NOT NULL DEFAULT false,
  quantidade numeric(10,3) NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_farmacia_produtos_tenant ON farmacia_produtos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_farmacia_pedidos_tenant ON farmacia_pedidos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_farmacia_pedidos_status ON farmacia_pedidos(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_farmacia_pedido_itens_pedido ON farmacia_pedido_itens(pedido_id);

-- Módulo Serviços (migration 038 original)
CREATE TABLE IF NOT EXISTS servicos_prestadores (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome varchar(255) NOT NULL,
  email varchar(255),
  telefone varchar(20),
  especialidade varchar(20) NOT NULL DEFAULT 'geral',
  raio_atendimento_km integer DEFAULT 15,
  comissao_base numeric(5,2) DEFAULT 60,
  ativo boolean DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS servicos_tipos (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome varchar(255) NOT NULL,
  descricao text,
  especialidade varchar(20) NOT NULL DEFAULT 'geral',
  preco_base numeric(10,2),
  requer_visita_tecnica boolean DEFAULT true,
  ativo boolean DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS servicos_ordens (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id text NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  prestador_id text REFERENCES servicos_prestadores(id) ON DELETE SET NULL,
  tipo_servico_id text NOT NULL REFERENCES servicos_tipos(id) ON DELETE RESTRICT,
  endereco_atendimento text NOT NULL,
  status varchar(25) DEFAULT 'orcamento_pendente',
  data_hora_visita timestamp,
  valor_orcado numeric(10,2),
  valor_final numeric(10,2),
  fotos_antes jsonb,
  fotos_depois jsonb,
  observacoes text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servicos_prestadores_tenant ON servicos_prestadores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_servicos_tipos_tenant ON servicos_tipos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_servicos_ordens_tenant ON servicos_ordens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_servicos_ordens_prestador ON servicos_ordens(prestador_id);
CREATE INDEX IF NOT EXISTS idx_servicos_ordens_status ON servicos_ordens(tenant_id, status);

-- Módulo Fretes (migration 041 original)
DO $$ BEGIN
  CREATE TYPE fretes_veiculo_tipo AS ENUM ('utilitario', 'van', 'caminhao_toco', 'caminhao_truck', 'carreta');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE fretes_carga_status AS ENUM (
    'cotacao_pendente', 'cotado', 'aprovado', 'coletado', 'em_transito',
    'entregue', 'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS fretes_veiculos (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  placa text NOT NULL,
  tipo fretes_veiculo_tipo NOT NULL,
  capacidade_kg numeric(10,2),
  capacidade_m3 numeric(10,2),
  motorista_id text REFERENCES public.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fretes_cargas (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id text NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  veiculo_id text REFERENCES fretes_veiculos(id) ON DELETE SET NULL,
  endereco_coleta text NOT NULL,
  endereco_entrega text NOT NULL,
  tipo_carga text,
  peso_kg numeric(10,2),
  volume_m3 numeric(10,2),
  valor_cotado numeric(12,2),
  status fretes_carga_status NOT NULL DEFAULT 'cotacao_pendente',
  data_coleta_prevista timestamp,
  data_entrega_prevista timestamp,
  data_coleta_real timestamp,
  data_entrega_real timestamp,
  observacoes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fretes_veiculos_tenant ON fretes_veiculos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fretes_cargas_tenant ON fretes_cargas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fretes_cargas_status ON fretes_cargas(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fretes_cargas_veiculo ON fretes_cargas(veiculo_id);

-- Módulo Restaurante — sem migration numerada original (criado via push
-- direto em sessão anterior); reconstruído aqui a partir do schema Drizzle
-- real (lib/db/src/schema/restaurante_cardapio.ts e restaurante_pedidos.ts).
DO $$ BEGIN
  CREATE TYPE restaurante_categoria_cardapio AS ENUM (
    'entrada', 'prato_principal', 'sobremesa', 'bebida', 'combo', 'outros'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE restaurante_pedido_status AS ENUM (
    'aguardando_confirmacao', 'confirmado', 'em_preparo',
    'saiu_para_entrega', 'pronto_retirada', 'entregue', 'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE restaurante_pedido_origem AS ENUM ('whatsapp', 'app', 'mesa', 'balcao');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS restaurante_cardapio (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  categoria restaurante_categoria_cardapio,
  preco numeric(10,2) NOT NULL,
  tempo_preparo_minutos integer DEFAULT 20,
  disponivel_almoco boolean NOT NULL DEFAULT true,
  disponivel_jantar boolean NOT NULL DEFAULT true,
  imagem_url text,
  ativo boolean NOT NULL DEFAULT true,
  destaque_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurante_pedidos (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  origem restaurante_pedido_origem NOT NULL DEFAULT 'whatsapp',
  status restaurante_pedido_status NOT NULL DEFAULT 'aguardando_confirmacao',
  numero_mesa integer,
  endereco_entrega text,
  observacoes text,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  tempo_estimado_minutos integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurante_pedido_itens (
  id text PRIMARY KEY,
  pedido_id text NOT NULL REFERENCES restaurante_pedidos(id) ON DELETE CASCADE,
  cardapio_item_id text,
  nome_item text NOT NULL,
  observacao_item text,
  quantidade numeric(10,3) NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurante_cardapio_tenant ON restaurante_cardapio(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurante_pedidos_tenant ON restaurante_pedidos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurante_pedido_itens_pedido ON restaurante_pedido_itens(pedido_id);

-- Módulo Imóveis (migration 040 original do Vendor.ai) — Praça.ai só
-- conecta cliente e imobiliária parceira, nunca atua como corretora;
-- CRECI é da imobiliária, por isso não existe campo de CRECI aqui (decisão
-- de escopo, não esquecimento).
DO $$ BEGIN
  CREATE TYPE imoveis_tipo AS ENUM ('casa', 'apartamento', 'terreno', 'comercial', 'rural', 'sala_comercial');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE imoveis_finalidade AS ENUM ('venda', 'aluguel');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE imoveis_status AS ENUM ('disponivel', 'reservado', 'vendido', 'alugado', 'inativo');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE imoveis_visita_status AS ENUM ('agendada', 'confirmada', 'realizada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS imoveis_propriedades (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  tipo imoveis_tipo NOT NULL,
  finalidade imoveis_finalidade NOT NULL,
  endereco text,
  bairro text,
  cidade text,
  cep text,
  area_m2 numeric(10,2),
  quartos integer,
  banheiros integer,
  vagas integer,
  valor numeric(14,2) NOT NULL,
  valor_condominio numeric(10,2),
  valor_iptu numeric(10,2),
  fotos jsonb,
  status imoveis_status NOT NULL DEFAULT 'disponivel',
  destaque boolean NOT NULL DEFAULT false,
  corretor_responsavel_id text REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imoveis_visitas (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  propriedade_id text NOT NULL REFERENCES imoveis_propriedades(id) ON DELETE CASCADE,
  cliente_id text NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  corretor_id text REFERENCES public.users(id) ON DELETE SET NULL,
  data_hora timestamp NOT NULL,
  status imoveis_visita_status NOT NULL DEFAULT 'agendada',
  feedback text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imoveis_propriedades_tenant ON imoveis_propriedades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_imoveis_propriedades_status ON imoveis_propriedades(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_imoveis_visitas_tenant ON imoveis_visitas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_imoveis_visitas_propriedade ON imoveis_visitas(propriedade_id);

-- Controle por produto de visibilidade/preço no Praça.ai — a loja pode
-- vender no Praça.ai como um todo (tenants.vende_no_praca_ai) mas ainda
-- assim tirar produtos específicos da vitrine, ou cobrar diferente lá.
-- null = herda o comportamento padrão.
ALTER TABLE produtos_catalogo ADD COLUMN IF NOT EXISTS vende_no_praca_ai_produto boolean;
ALTER TABLE produtos_catalogo ADD COLUMN IF NOT EXISTS preco_praca_ai numeric(12,2);

-- Tabela de especificações livre do produto (Complemento Praça.ai — item 3
-- da paridade com Mercado Livre: Marca/Modelo/Cor/etc). jsonb com lista de
-- pares label/value, cabe em qualquer categoria sem coluna fixa por atributo.
ALTER TABLE produtos_catalogo ADD COLUMN IF NOT EXISTS especificacoes jsonb;

-- Compatibilidade veicular (Complemento Praça.ai — filtro "selecione seu
-- carro" na categoria Acessórios para Veículos, tipo Tuning Parts). jsonb
-- com lista de {marca, modelo, anoInicio, anoFim}.
ALTER TABLE produtos_catalogo ADD COLUMN IF NOT EXISTS compatibilidade_veicular jsonb;

-- Revenue Scout — Lado Comprador. Espelha scout_regras/scout_oportunidades
-- do Vendor.ai, mas pro consumidor final do marketplace.
CREATE TABLE IF NOT EXISTS scout_pra_regras (
  id text PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL,
  condicoes jsonb NOT NULL DEFAULT '{}',
  canal text NOT NULL DEFAULT 'push',
  mensagem_template text NOT NULL,
  peso_estrategico numeric(4,2) NOT NULL DEFAULT 1.0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scout_pra_oportunidades (
  id text PRIMARY KEY,
  regra_id text NOT NULL REFERENCES scout_pra_regras(id) ON DELETE CASCADE,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text NOT NULL,
  mensagem text NOT NULL,
  canal text NOT NULL,
  produto_id text,
  status text NOT NULL DEFAULT 'pendente',
  score_oportunidade numeric(6,2) NOT NULL,
  receita_esperada numeric(10,2),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scout_pra_oportunidades_consumer ON scout_pra_oportunidades(consumer_id);
CREATE INDEX IF NOT EXISTS idx_scout_pra_oportunidades_status ON scout_pra_oportunidades(status);

CREATE TABLE IF NOT EXISTS scout_pra_envios_log (
  id text PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  oportunidade_id text REFERENCES scout_pra_oportunidades(id) ON DELETE SET NULL,
  canal text NOT NULL,
  enviado_em timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scout_pra_envios_log_consumer_data ON scout_pra_envios_log(consumer_id, enviado_em);

-- Extras do Revenue Scout comprador — 16 situações que faltavam schema
-- (favorito+preço, aniversário, pontos expirando, navegação, busca,
-- cupom por consumidor, campanha com prazo, benefício, assinatura, NPS).
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS preco_no_favorito numeric(10,2);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS data_nascimento text;
ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS expira_em timestamp with time zone;

CREATE TABLE IF NOT EXISTS product_views (
  id serial PRIMARY KEY,
  consumer_id integer REFERENCES consumers(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_views_consumer_product ON product_views(consumer_id, product_id, created_at);

CREATE TABLE IF NOT EXISTS search_logs (
  id serial PRIMARY KEY,
  consumer_id integer REFERENCES consumers(id) ON DELETE CASCADE,
  termo text NOT NULL,
  teve_resultado boolean NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_sem_resultado ON search_logs(consumer_id, created_at) WHERE teve_resultado = false;

CREATE TABLE IF NOT EXISTS consumer_coupons (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  valor_desconto numeric(10,2),
  percentual_desconto numeric(5,2),
  expira_em timestamp with time zone NOT NULL,
  usado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consumer_coupons_pendente ON consumer_coupons(consumer_id, expira_em) WHERE usado_em IS NULL;

CREATE TABLE IF NOT EXISTS campanhas (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL,
  valor numeric(10,2),
  categoria_alvo text,
  inicio_em timestamp with time zone NOT NULL,
  fim_em timestamp with time zone NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumer_beneficios (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text NOT NULL,
  usado_em timestamp with time zone,
  expira_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assinaturas (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  frequencia_dias integer NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  proxima_entrega_em timestamp with time zone,
  cancelada_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nps_respostas (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  order_id integer,
  nota integer NOT NULL,
  comentario text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS nome_publico text;
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS nicho text;
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS tiktok text;
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS youtube text;
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS desconto_percentual numeric(5,2) NOT NULL DEFAULT 5;
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS comissao_percentual numeric(5,2) NOT NULL DEFAULT 5;
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS cliques integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS influencer_conversions (
  id serial PRIMARY KEY,
  ambassador_id integer NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
  order_id integer NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  order_value numeric(12,2) NOT NULL,
  discount_value numeric(12,2) NOT NULL,
  commission_value numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_influencer_conversions_ambassador ON influencer_conversions(ambassador_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  category text NOT NULL,
  condition text NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'used')),
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  city text NOT NULL,
  state text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'sold')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status_category
  ON marketplace_listings(status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_consumer
  ON marketplace_listings(consumer_id, created_at DESC);
`;

export async function ensurePracaAiTablesExist(): Promise<void> {
  try {
    await pool.query(MIGRATION_SQL);
    logger.info("Migração de tabelas do Praça.ai verificada/aplicada");
  } catch (err) {
    logger.error({ err }, "Falha ao aplicar migração de tabelas do Praça.ai");
    throw err;
  }
}
