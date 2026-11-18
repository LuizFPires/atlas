-- Atlas M2 · S3 — schema do servidor de licenças.
-- Acesso só pelo service_role (edge functions). RLS ligado e sem política
-- para anon/authenticated, exceto leitura do próprio cliente no portal.

create extension if not exists pgcrypto;

create table clientes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email_compra text not null unique,
  nome_tratamento text not null,
  empresa text,
  ramo text,
  criado_em timestamptz not null default now()
);

create table licencas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  status text not null default 'ativa' check (status in ('ativa','atrasada','pausada','cancelada')),
  plano_valor numeric(10,2) not null,
  criada_em timestamptz not null default now(),
  pausa_prevista_em timestamptz,
  troca_liberada_em timestamptz -- override manual do admin: ignora o limite 1/7 dias uma vez
);
create index on licencas (cliente_id);

create table ativacoes (
  id uuid primary key default gen_random_uuid(),
  licenca_id uuid not null references licencas(id) on delete cascade,
  computador_hash text not null check (computador_hash ~ '^[0-9a-f]{64}$'),
  ativo boolean not null default true,
  ativado_em timestamptz not null default now(),
  desativado_em timestamptz
);
-- uma licença = um computador ativo
create unique index ativacoes_um_ativo_por_licenca on ativacoes (licenca_id) where ativo;

create table trocas_computador (
  id uuid primary key default gen_random_uuid(),
  licenca_id uuid not null references licencas(id) on delete cascade,
  de_hash text not null,
  para_hash text not null,
  feita_em timestamptz not null default now(),
  por_admin boolean not null default false
);
create index on trocas_computador (licenca_id, feita_em desc);

create table links_instalacao (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  token_hash text not null unique, -- só o hash fica no banco
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table codigos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  finalidade text not null check (finalidade in ('ativacao','troca')),
  codigo_hash text not null, -- hash do código de 6 dígitos
  tentativas int not null default 0,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on codigos (cliente_id, finalidade, criado_em desc);

create table entregas_kit (
  id uuid primary key default gen_random_uuid(),
  licenca_id uuid not null references licencas(id) on delete cascade,
  obra_id text not null,
  marca_dagua text not null,
  baixado_em timestamptz not null default now()
);
create index on entregas_kit (marca_dagua);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  licenca_id uuid not null references licencas(id) on delete cascade,
  tipo text not null check (tipo in ('implantacao','mensalidade')),
  valor numeric(10,2) not null,
  status text not null check (status in ('pendente','pago','falhou','estornado')),
  gateway_ref text unique, -- referência do gateway do cliente; nunca dados de cartão
  competencia date
);

create table ocorrencias_admin (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  resolvida boolean not null default false,
  criada_em timestamptz not null default now()
);

-- RLS: tudo ligado; edge functions usam service_role (ignora RLS).
alter table clientes enable row level security;
alter table licencas enable row level security;
alter table ativacoes enable row level security;
alter table trocas_computador enable row level security;
alter table links_instalacao enable row level security;
alter table codigos enable row level security;
alter table entregas_kit enable row level security;
alter table pagamentos enable row level security;
alter table ocorrencias_admin enable row level security;

-- Portal (F15): o cliente logado lê só o que é dele.
create policy cliente_le_proprio on clientes for select to authenticated
  using (auth_user_id = auth.uid());
create policy cliente_le_licenca on licencas for select to authenticated
  using (cliente_id in (select id from clientes where auth_user_id = auth.uid()));
create policy cliente_le_ativacoes on ativacoes for select to authenticated
  using (licenca_id in (select l.id from licencas l join clientes c on c.id = l.cliente_id where c.auth_user_id = auth.uid()));
create policy cliente_le_pagamentos on pagamentos for select to authenticated
  using (licenca_id in (select l.id from licencas l join clientes c on c.id = l.cliente_id where c.auth_user_id = auth.uid()));
-- links, codigos, entregas_kit, trocas e ocorrencias_admin: sem política = só service_role.
