-- Atlas · M59: os 12 testadores do Google (decisão do Luiz, 25/11/2026: "Página de convite do Atlas").
-- O Google não informa quem entrou no teste fechado. O convite do WhatsApp abre a página /teste/<código> do Atlas: a pessoa entra no
-- grupo do Google, vira testadora, instala e toca "Já instalei". O Atlas conta por ali (14 dias a partir do 12º).
-- 1) lojas_convites: um convite por obra (só endereços do Google: grupo e opt-in do teste).
-- 2) lojas_testadores: o nome que a pessoa escreveu e quando entrou (sem e-mail e sem telefone).
create table if not exists lojas_convites (
  codigo text primary key check (codigo ~ '^[a-z0-9]{10,40}$'),
  licenca_id uuid not null references licencas(id) on delete cascade,
  obra_id text not null check (obra_id ~ '^[A-Za-z0-9_.-]{1,80}$'),
  app_nome text not null check (char_length(app_nome) between 1 and 40),
  grupo_url text not null check (grupo_url ~ '^https://groups\.google\.com/g/[A-Za-z0-9._-]{1,80}/?$'),
  optin_url text not null check (optin_url ~ '^https://play\.google\.com/apps/(internaltest|testing)/[A-Za-z0-9._-]{1,150}/?$'),
  criado_em timestamptz not null default now(),
  unique (licenca_id, obra_id)
);
alter table lojas_convites enable row level security;
revoke all on lojas_convites from public, anon, authenticated;
grant select, insert, update on lojas_convites to service_role;

create table if not exists lojas_testadores (
  id bigint generated always as identity primary key,
  codigo text not null references lojas_convites(codigo) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  entrou_em timestamptz not null default now()
);
create index if not exists lojas_testadores_codigo_idx on lojas_testadores (codigo, entrou_em);
alter table lojas_testadores enable row level security;
revoke all on lojas_testadores from public, anon, authenticated;
grant select, insert on lojas_testadores to service_role;
