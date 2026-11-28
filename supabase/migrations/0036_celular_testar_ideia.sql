-- Atlas · Testar a ideia no celular (28/11/2026). O celular pede um teste ('testar') ou uma entrevista ('entrevistar'); o
-- notebook roda com o Claude DO CLIENTE e publica só o resumo (testes, relatórios, a Praça, entrevistas) em celular_testes.
alter table celular_pedidos drop constraint if exists celular_pedidos_tipo_check;
alter table celular_pedidos add constraint celular_pedidos_tipo_check
  check (tipo in ('obra_nova','ajuste','aprovar_telas','nome','construir','pausar','continuar','foto_ajuda','testar','entrevistar'));

create table if not exists celular_testes (
  licenca_id    uuid not null references licencas(id) on delete cascade,
  obra_id       text not null check (obra_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  dados         jsonb not null check (pg_column_size(dados) <= 70000),
  atualizado_em timestamptz not null default now(),
  primary key (licenca_id, obra_id)
);
alter table celular_testes enable row level security;
-- Sem política: só a função do servidor (service role) lê e grava, sempre filtrando pela licença.
revoke all on celular_testes from public, anon, authenticated;
grant select, insert, update, delete on celular_testes to service_role;
