-- Atlas · M65: o Atlas não constrói outro Atlas (sistema que transforma ideia/protótipo em plano e põe agentes para construir software).
-- Decisão do Luiz (25/11/2026): o Atlas bloqueia; quem insiste tem a OBRA embargada (só aquela); a equipe analisa e decide
-- liberar, manter o embargo ou recusar o uso do Atlas. Nada aqui age sozinho além do embargo da obra.
-- 1) politica_eventos: cada pedido bloqueado (texto do cliente cortado e limpo de segredo) e cada pedido de análise ("é engano").
-- 2) politica_obras: a situação de cada obra (obra_id '*' = a licença inteira, quando a equipe recusa o uso).
create table if not exists politica_eventos (
  id bigint generated always as identity primary key,
  licenca_id uuid not null references licencas(id) on delete cascade,
  obra_id text not null check (obra_id ~ '^[A-Za-z0-9_.-]{1,80}$'),
  onde text not null check (onde in ('ideia', 'prototipo', 'planilha', 'posobra', 'codigo', 'engano')),
  texto text not null check (char_length(texto) between 1 and 1200),
  criado_em timestamptz not null default now()
);
create index if not exists politica_eventos_obra_idx on politica_eventos (licenca_id, obra_id, criado_em);
create index if not exists politica_eventos_criado_idx on politica_eventos (criado_em);
alter table politica_eventos enable row level security;
revoke all on politica_eventos from public, anon, authenticated;
grant select, insert on politica_eventos to service_role;

create table if not exists politica_obras (
  licenca_id uuid not null references licencas(id) on delete cascade,
  obra_id text not null check (obra_id = '*' or obra_id ~ '^[A-Za-z0-9_.-]{1,80}$'),
  situacao text not null check (situacao in ('embargada', 'liberada', 'mantida', 'recusada')),
  desde timestamptz not null default now(),
  decidido_por text,
  primary key (licenca_id, obra_id)
);
alter table politica_obras enable row level security;
revoke all on politica_obras from public, anon, authenticated;
grant select, insert, update on politica_obras to service_role;
