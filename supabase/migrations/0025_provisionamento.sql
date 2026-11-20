-- Atlas · M32 fatia (e1): estado do provisionamento do app pronto, um registro por compra.
-- NÃO há coluna de credencial, de propósito: tokens do cliente nunca são gravados (só passam pela chamada).
-- Acesso só pelo servidor (service_role).
create table if not exists provisionamentos (
  compra_id     text        primary key,
  licenca_id    uuid        references licencas(id) on delete cascade,
  passos        jsonb       not null,
  repo          jsonb,
  banco         jsonb,
  endereco      text        check (endereco is null or endereco ~ '^https://'),
  erro          text,
  atualizado_em timestamptz not null default now()
);
alter table provisionamentos enable row level security;
