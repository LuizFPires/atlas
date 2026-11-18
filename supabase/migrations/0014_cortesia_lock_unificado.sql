-- Atlas · corrige TOCTOU entre compra e cortesia do mesmo e-mail: as duas travavam em chaves diferentes (prefixos distintos por fluxo)
-- e não se serializavam. Agora ambas pegam o MESMO advisory lock por e-mail normalizado ('cliente:' || lower(trim(email))).
-- Só a linha do lock muda; corpo, security definer, search_path e grants idênticos a 0010/0013 (que não são reescritas).

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
  end if;
  return jsonb_build_object('nova', nova, 'licenca', jsonb_build_object(
    'id', lic.id, 'cliente_id', lic.cliente_id, 'status', lic.status, 'pausa_prevista_em', lic.pausa_prevista_em,
    'troca_liberada_em', lic.troca_liberada_em, 'comprada_em', lic.comprada_em, 'avisos_atraso', lic.avisos_atraso,
    'conta_gateway_id', lic.conta_gateway_id, 'gateway_cliente_ref', lic.gateway_cliente_ref,
    'gateway_assinatura_ref', lic.gateway_assinatura_ref, 'mensalidade_encerra_em', lic.mensalidade_encerra_em));
end $$;

create or replace function criar_cortesia(p_email text, p_nome text, p_validade timestamptz, p_agora timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cli uuid; lic licencas%rowtype; res text;
begin
  perform pg_advisory_xact_lock(hashtextextended('cliente:' || lower(trim(p_email)), 0));
  select id into cli from clientes where email_compra = p_email;
  if cli is null then
    insert into clientes (email_compra, nome_tratamento) values (p_email, p_nome) returning id into cli;
  end if;
  select * into lic from licencas where cliente_id = cli order by criada_em limit 1;
  if not found then
    insert into licencas (cliente_id, status, plano_valor, tipo, validade_em, comprada_em, avisos_atraso)
    values (cli, 'ativa', 0, 'cortesia', p_validade, null, 0) returning * into lic;
    res := 'criada';
  elsif lic.tipo = 'cortesia' then
    update licencas set status = 'ativa', validade_em = p_validade where id = lic.id returning * into lic;
    res := 'atualizada';
  else
    res := 'ja_tem_paga';
  end if;
  return jsonb_build_object('resultado', res, 'licenca', jsonb_build_object(
    'id', lic.id, 'cliente_id', lic.cliente_id, 'status', lic.status, 'pausa_prevista_em', lic.pausa_prevista_em,
    'troca_liberada_em', lic.troca_liberada_em, 'comprada_em', lic.comprada_em, 'avisos_atraso', lic.avisos_atraso,
    'conta_gateway_id', lic.conta_gateway_id, 'gateway_cliente_ref', lic.gateway_cliente_ref,
    'gateway_assinatura_ref', lic.gateway_assinatura_ref, 'mensalidade_encerra_em', lic.mensalidade_encerra_em,
    'tipo', lic.tipo, 'validade_em', lic.validade_em));
end $$;

revoke all on function criar_compra, criar_cortesia from public, anon, authenticated;
grant execute on function criar_compra, criar_cortesia to service_role;
