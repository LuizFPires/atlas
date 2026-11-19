-- Atlas · degustação, correções da revisão (sobre 0016/0017/0018, já commitadas).
-- 1) Ledger durável de dispositivo: o "1 teste por computador" não pode depender de ativacoes (excluir_conta apaga as ativações).
--    Guarda só o HMAC do computador_hash (HMAC-SHA256 com ATLAS_SEGREDO, domínio 'dispositivo:'), feito na borda; sem dado pessoal.
--    licenca_id (sem FK, id aleatório) só permite o MESMO teste voltar ao seu próprio computador. excluir_conta NÃO apaga o ledger
--    (marcador pseudônimo de prevenção a fraude, ver docs/degustacao.md).
-- 2) criar_compra: ao converter cortesia em paga, zera origem (a compra nunca é barrada pela trava).
-- 3) trocar_computador: licença de teste (cortesia + origem degustacao) grava/confere o ledger na mesma transação (defesa em profundidade).

create table degustacoes_dispositivos (
  id bigint generated always as identity primary key,
  dispositivo_hmac text not null unique,
  licenca_id uuid not null,
  criado_em timestamptz not null default now()
);
alter table degustacoes_dispositivos enable row level security;
revoke all on degustacoes_dispositivos from anon, authenticated;

-- true = o computador é livre ou já é desta mesma licença (grava se novo); false = outro teste já usou.
create function registrar_dispositivo_teste(p_hmac text, p_licenca uuid, p_quando timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare dono uuid;
begin
  insert into degustacoes_dispositivos (dispositivo_hmac, licenca_id, criado_em) values (p_hmac, p_licenca, p_quando)
    on conflict (dispositivo_hmac) do nothing;
  select licenca_id into dono from degustacoes_dispositivos where dispositivo_hmac = p_hmac;
  return dono = p_licenca;
end $$;

create function computador_ja_testou(p_hmac text, p_licenca uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from degustacoes_dispositivos where dispositivo_hmac = p_hmac and licenca_id <> p_licenca);
$$;

create or replace function criar_compra(
  p_email text, p_nome text, p_valor numeric, p_conta uuid, p_cliente_ref text, p_agora timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare cli uuid; lic licencas%rowtype; nova boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended('cliente:' || lower(trim(p_email)), 0));
  select id into cli from clientes where email_compra = p_email;
  if cli is null then
    insert into clientes (email_compra, nome_tratamento) values (p_email, p_nome) returning id into cli;
  end if;
  select * into lic from licencas where cliente_id = cli order by criada_em limit 1;
  if not found then
    insert into licencas (cliente_id, status, plano_valor, comprada_em, avisos_atraso, conta_gateway_id, gateway_cliente_ref)
    values (cli, 'ativa', p_valor, p_agora, 0, p_conta, p_cliente_ref) returning * into lic;
    nova := true;
  elsif lic.tipo = 'cortesia' then
    update licencas set tipo = 'paga', origem = null, validade_em = null, status = 'ativa', plano_valor = p_valor, comprada_em = p_agora,
      avisos_atraso = 0, pausa_prevista_em = null, conta_gateway_id = p_conta, gateway_cliente_ref = p_cliente_ref,
      gateway_assinatura_ref = null, mensalidade_encerra_em = null
    where id = lic.id returning * into lic;
  end if;
  return jsonb_build_object('nova', nova, 'licenca', jsonb_build_object(
    'id', lic.id, 'cliente_id', lic.cliente_id, 'status', lic.status, 'pausa_prevista_em', lic.pausa_prevista_em,
    'troca_liberada_em', lic.troca_liberada_em, 'comprada_em', lic.comprada_em, 'avisos_atraso', lic.avisos_atraso,
    'conta_gateway_id', lic.conta_gateway_id, 'gateway_cliente_ref', lic.gateway_cliente_ref,
    'gateway_assinatura_ref', lic.gateway_assinatura_ref, 'mensalidade_encerra_em', lic.mensalidade_encerra_em,
    'tipo', lic.tipo, 'origem', lic.origem, 'validade_em', lic.validade_em));
end $$;

-- Assinatura nova (p_dispositivo_hmac): troca a função da 0002. null = licença que não é teste.
drop function trocar_computador(uuid, uuid, text, text, text, timestamptz, boolean, bigint);
create function trocar_computador(
  p_licenca uuid, p_ativacao_atual uuid, p_de text, p_para text, p_token_hash text,
  p_quando timestamptz, p_por_admin boolean, p_intervalo_ms bigint, p_dispositivo_hmac text default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare n int; teste boolean;
begin
  perform 1 from licencas where id = p_licenca for update; -- serializa trocas da mesma licença
  if p_intervalo_ms > 0 and exists (
    select 1 from trocas_computador
     where licenca_id = p_licenca and feita_em > p_quando - (p_intervalo_ms || ' milliseconds')::interval
  ) then return false; end if;
  -- Só teste grátis (cortesia + origem degustacao) passa pelo ledger; compra nunca é barrada.
  select (tipo = 'cortesia' and origem = 'degustacao') into teste from licencas where id = p_licenca;
  if teste and p_dispositivo_hmac is not null then
    if computador_ja_testou(p_dispositivo_hmac, p_licenca) then return false; end if;
  end if;
  update ativacoes set ativo = false, desativado_em = p_quando
   where id = p_ativacao_atual and licenca_id = p_licenca and ativo;
  get diagnostics n = row_count;
  if n <> 1 then return false; end if;
  insert into ativacoes (licenca_id, computador_hash, token_hash, ativado_em) values (p_licenca, p_para, p_token_hash, p_quando);
  insert into trocas_computador (licenca_id, de_hash, para_hash, feita_em, por_admin) values (p_licenca, p_de, p_para, p_quando, p_por_admin);
  if p_por_admin then update licencas set troca_liberada_em = null where id = p_licenca; end if;
  -- Corrida entre dois testes no mesmo computador: o segundo desfaz a troca inteira (a exceção reverte a transação).
  if teste and p_dispositivo_hmac is not null and not registrar_dispositivo_teste(p_dispositivo_hmac, p_licenca, p_quando) then
    raise exception 'ja_testou_neste_computador';
  end if;
  return true;
end $$;

revoke all on function registrar_dispositivo_teste, computador_ja_testou, criar_compra, trocar_computador from public, anon, authenticated;
grant execute on function registrar_dispositivo_teste, computador_ja_testou, criar_compra, trocar_computador to service_role;
