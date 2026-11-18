-- Atlas · quem ganhou cortesia e depois COMPRA passa a ter licença paga: a compra converte a cortesia (não recusa).
-- Antes, criar_compra devolvia a licença de cortesia (sem conta de gateway) e o webhook dava 409 conta_divergente.
-- Só criar_compra muda (CREATE OR REPLACE); security definer, search_path, lock por e-mail e grants idênticos a 0010/0014.

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
    -- A compra converte a cortesia em paga: sem prazo, na conta do gateway, nova janela de 7 dias a partir de agora.
    update licencas set tipo = 'paga', validade_em = null, status = 'ativa', plano_valor = p_valor, comprada_em = p_agora,
      avisos_atraso = 0, pausa_prevista_em = null, conta_gateway_id = p_conta, gateway_cliente_ref = p_cliente_ref,
      gateway_assinatura_ref = null, mensalidade_encerra_em = null
    where id = lic.id returning * into lic;
  end if;
  return jsonb_build_object('nova', nova, 'licenca', jsonb_build_object(
    'id', lic.id, 'cliente_id', lic.cliente_id, 'status', lic.status, 'pausa_prevista_em', lic.pausa_prevista_em,
    'troca_liberada_em', lic.troca_liberada_em, 'comprada_em', lic.comprada_em, 'avisos_atraso', lic.avisos_atraso,
    'conta_gateway_id', lic.conta_gateway_id, 'gateway_cliente_ref', lic.gateway_cliente_ref,
    'gateway_assinatura_ref', lic.gateway_assinatura_ref, 'mensalidade_encerra_em', lic.mensalidade_encerra_em,
    'tipo', lic.tipo, 'validade_em', lic.validade_em));
end $$;

revoke all on function criar_compra from public, anon, authenticated;
grant execute on function criar_compra to service_role;
