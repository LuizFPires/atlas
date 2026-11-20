-- Atlas · M30 item 2 (relay): RESUMO do status das obras, publicado pelo computador do cliente e lido pelo Portal.
-- É só resumo (nome, etapa, percentual, estado, uma notícia curta). NUNCA código, caminho de arquivo nem segredo.
-- Acesso só pelo servidor (service_role); o dono é sempre descoberto no servidor pelo login/ativação, nunca pelo corpo.
create table if not exists status_obras (
  licenca_id          uuid        not null references licencas(id) on delete cascade,
  obra_id             text        not null check (char_length(obra_id) between 1 and 64),
  nome                text        not null check (char_length(nome) between 1 and 80),
  segmento            text        check (segmento is null or char_length(segmento) <= 60),
  etapa_atual_numero  int         not null check (etapa_atual_numero >= 0),
  etapa_atual_rotulo  text        not null check (char_length(etapa_atual_rotulo) <= 80),
  total_etapas        int         not null check (total_etapas >= 0),
  percentual          int         not null check (percentual between 0 and 100),
  estado              text        not null check (estado in ('construindo','pausada','aguardando_aprovacao','pronta','no_ar')),
  ativa_agora         boolean     not null default false,
  ultima_noticia      text        not null default '' check (char_length(ultima_noticia) <= 280),
  ultima_noticia_em   timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  primary key (licenca_id, obra_id)
);
alter table status_obras enable row level security;
revoke all on status_obras from public, anon, authenticated;
grant select, insert, update, delete on status_obras to service_role;

-- Substitui, de forma atômica, o conjunto de obras DA licença (as que sumiram do computador somem daqui).
create or replace function substituir_status_obras(p_licenca uuid, p_obras jsonb, p_agora timestamptz)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if jsonb_typeof(p_obras) <> 'array' then raise exception 'p_obras deve ser uma lista'; end if;
  delete from status_obras where licenca_id = p_licenca
    and obra_id not in (select o->>'obra_id' from jsonb_array_elements(p_obras) o);
  insert into status_obras (licenca_id, obra_id, nome, segmento, etapa_atual_numero, etapa_atual_rotulo, total_etapas, percentual, estado, ativa_agora, ultima_noticia, ultima_noticia_em, atualizado_em)
  select p_licenca, o->>'obra_id', o->>'nome', nullif(o->>'segmento',''), (o->>'etapa_atual_numero')::int, o->>'etapa_atual_rotulo',
         (o->>'total_etapas')::int, (o->>'percentual')::int, o->>'estado', (o->>'ativa_agora')::boolean, o->>'ultima_noticia',
         (o->>'ultima_noticia_em')::timestamptz, p_agora
    from jsonb_array_elements(p_obras) o
  on conflict (licenca_id, obra_id) do update set
    nome = excluded.nome, segmento = excluded.segmento, etapa_atual_numero = excluded.etapa_atual_numero,
    etapa_atual_rotulo = excluded.etapa_atual_rotulo, total_etapas = excluded.total_etapas, percentual = excluded.percentual,
    estado = excluded.estado, ativa_agora = excluded.ativa_agora, ultima_noticia = excluded.ultima_noticia,
    ultima_noticia_em = excluded.ultima_noticia_em, atualizado_em = excluded.atualizado_em;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function substituir_status_obras(uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function substituir_status_obras(uuid, jsonb, timestamptz) to service_role;
