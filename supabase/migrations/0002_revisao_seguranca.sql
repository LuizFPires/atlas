-- Atlas M2 · correções da revisão de segurança.
-- Credencial por ativação (só hash), limite de eventos, e operações atômicas (anti-TOCTOU).
-- Todas as funções são só do service_role (edge functions).

alter table ativacoes add column token_hash text check (token_hash ~ '^[0-9a-f]{64}$'); -- sha256 do segredo da ativação

create table limites_evento (
  id bigint generated always as identity primary key,
  chave text not null,
  em timestamptz not null default now()
);
create index on limites_evento (chave, em desc);
alter table limites_evento enable row level security; -- sem política: só service_role

-- Registra o evento só se houver menos de p_max na janela. Serializa por chave.
create function tentar_evento(p_chave text, p_max int, p_janela_ms bigint, p_agora timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_chave, 0));
  delete from limites_evento where chave = p_chave and em <= p_agora - (p_janela_ms || ' milliseconds')::interval;
  select count(*) into n from limites_evento where chave = p_chave;
  if n >= p_max then return false; end if;
  insert into limites_evento (chave, em) values (p_chave, p_agora);
  return true;
end $$;

create function limpar_eventos(p_chave text) returns void language sql security definer set search_path = public as $$
  delete from limites_evento where chave = p_chave;
$$;

-- Emite código novo invalidando os abertos anteriores (mesma transação).
create function inserir_codigo(p_cliente uuid, p_finalidade text, p_hash text, p_expira timestamptz, p_agora timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  update codigos set usado_em = p_agora where cliente_id = p_cliente and finalidade = p_finalidade and usado_em is null;
  insert into codigos (cliente_id, finalidade, codigo_hash, expira_em) values (p_cliente, p_finalidade, p_hash, p_expira);
end $$;

-- UPDATE atômico: 0 linhas = falha.
create function incrementar_tentativa(p_id uuid, p_max int, p_agora timestamptz)
returns setof codigos language sql security definer set search_path = public as $$
  update codigos set tentativas = tentativas + 1
   where id = p_id and usado_em is null and tentativas < p_max and expira_em > p_agora
  returning *;
$$;

create function consumir_codigo(p_id uuid, p_max int, p_agora timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update codigos set usado_em = p_agora
   where id = p_id and usado_em is null and tentativas <= p_max and expira_em > p_agora;
  get diagnostics n = row_count;
  return n = 1;
end $$;

create function consumir_link(p_id uuid, p_agora timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update links_instalacao set usado_em = p_agora where id = p_id and usado_em is null;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Troca de computador numa transação só. false = a ativação atual mudou ou o limite de 7 dias barrou.
create function trocar_computador(
  p_licenca uuid, p_ativacao_atual uuid, p_de text, p_para text, p_token_hash text,
  p_quando timestamptz, p_por_admin boolean, p_intervalo_ms bigint
) returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform 1 from licencas where id = p_licenca for update; -- serializa trocas da mesma licença
  if p_intervalo_ms > 0 and exists (
    select 1 from trocas_computador
     where licenca_id = p_licenca and feita_em > p_quando - (p_intervalo_ms || ' milliseconds')::interval
  ) then return false; end if;
  update ativacoes set ativo = false, desativado_em = p_quando
   where id = p_ativacao_atual and licenca_id = p_licenca and ativo;
  get diagnostics n = row_count;
  if n <> 1 then return false; end if;
  insert into ativacoes (licenca_id, computador_hash, token_hash, ativado_em) values (p_licenca, p_para, p_token_hash, p_quando);
  insert into trocas_computador (licenca_id, de_hash, para_hash, feita_em, por_admin) values (p_licenca, p_de, p_para, p_quando, p_por_admin);
  if p_por_admin then update licencas set troca_liberada_em = null where id = p_licenca; end if;
  return true;
end $$;

revoke all on function tentar_evento, limpar_eventos, inserir_codigo, incrementar_tentativa, consumir_codigo, consumir_link, trocar_computador from public, anon, authenticated;
grant execute on function tentar_evento, limpar_eventos, inserir_codigo, incrementar_tentativa, consumir_codigo, consumir_link, trocar_computador to service_role;
