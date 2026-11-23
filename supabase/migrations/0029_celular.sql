-- Atlas · M33: o celular como controle remoto do notebook do cliente.
-- O celular deixa PEDIDOS; o notebook bate (sinal), leva os pedidos, executa com o Claude DO CLIENTE e publica o resultado.
-- Nada de código nem segredo aqui: só recados, o resumo do projeto (fase, progresso, nomes) e fotos de referência que só
-- existem até o notebook baixar. Acesso só pelo servidor (service_role); a licença vem sempre do login ou da ativação.
create table if not exists celular_sinal (
  licenca_id uuid primary key references licencas(id) on delete cascade,
  visto_em   timestamptz not null,
  ocupado    text check (ocupado is null or char_length(ocupado) <= 80)
);

create table if not exists celular_pedidos (
  id          text primary key check (id ~ '^[0-9a-f]{32}$'),
  licenca_id  uuid not null references licencas(id) on delete cascade,
  tipo        text not null check (tipo in ('obra_nova','ajuste','aprovar_telas','nome','construir','pausar','continuar')),
  obra_id     text not null check (obra_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  dados       jsonb not null default '{}'::jsonb check (pg_column_size(dados) <= 100000),
  estado      text not null default 'pendente' check (estado in ('pendente','entregue','feito','erro')),
  mensagem    text not null default '' check (char_length(mensagem) <= 280),
  criado_em   timestamptz not null default now(),
  entregue_em timestamptz
);
create index if not exists celular_pedidos_licenca on celular_pedidos (licenca_id, criado_em desc);

create table if not exists celular_projetos (
  licenca_id    uuid not null references licencas(id) on delete cascade,
  obra_id       text not null check (obra_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  dados         jsonb not null check (pg_column_size(dados) <= 50000),
  telas_token   text check (telas_token is null or telas_token ~ '^[A-Za-z0-9_-]{40,64}$'),
  atualizado_em timestamptz not null default now(),
  primary key (licenca_id, obra_id)
);

create table if not exists celular_referencias (
  id         text primary key check (id ~ '^[0-9a-f]{32}$'),
  licenca_id uuid not null references licencas(id) on delete cascade,
  imagem     text not null check (char_length(imagem) <= 2900000),
  criada_em  timestamptz not null default now()
);
create index if not exists celular_referencias_licenca on celular_referencias (licenca_id);

alter table celular_sinal enable row level security;
alter table celular_pedidos enable row level security;
alter table celular_projetos enable row level security;
alter table celular_referencias enable row level security;
revoke all on celular_sinal, celular_pedidos, celular_projetos, celular_referencias from public, anon, authenticated;
grant select, insert, update, delete on celular_sinal, celular_pedidos, celular_projetos, celular_referencias to service_role;

-- Leva os pedidos do notebook, de forma atômica: pendentes e os entregues sem resposta há mais de p_reentrega_ms
-- (o notebook pode ter desligado no meio). Marca como entregues e devolve, do mais antigo para o mais novo.
create or replace function levar_pedidos_celular(p_licenca uuid, p_agora timestamptz, p_reentrega_ms bigint, p_limite int)
returns setof celular_pedidos language sql security definer set search_path = public, pg_temp as $$
  update celular_pedidos set estado = 'entregue', entregue_em = p_agora
   where id in (
     select id from celular_pedidos
      where licenca_id = p_licenca
        and (estado = 'pendente' or (estado = 'entregue' and entregue_em < p_agora - make_interval(secs => p_reentrega_ms / 1000.0)))
      order by criado_em
      limit p_limite
      for update skip locked)
  returning *;
$$;
revoke all on function levar_pedidos_celular(uuid, timestamptz, bigint, int) from public, anon, authenticated;
grant execute on function levar_pedidos_celular(uuid, timestamptz, bigint, int) to service_role;

-- Limpeza: pedidos respondidos há mais de 30 dias e fotos que o notebook não baixou em 7 dias.
create or replace function limpar_celular(p_agora timestamptz) returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int; m int;
begin
  delete from celular_pedidos where estado in ('feito','erro') and criado_em < p_agora - interval '30 days';
  get diagnostics n = row_count;
  delete from celular_referencias where criada_em < p_agora - interval '7 days';
  get diagnostics m = row_count;
  return n + m;
end $$;
revoke all on function limpar_celular(timestamptz) from public, anon, authenticated;
grant execute on function limpar_celular(timestamptz) to service_role;
