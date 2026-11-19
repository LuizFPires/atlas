-- Atlas · degustação, correções da revisão do QA (sobre 0016/0017, já commitadas).
-- 1) licencas.origem: marca a licença de degustação ('degustacao'); cortesia manual do gestor e compra ficam NULL.
--    Serve para o freio "1 degustação por computador" na ativação (feito no servidor, confirmarAtivacao).
-- 2) criar_degustacao grava origem='degustacao' e devolve 'origem' no JSON.
-- 3) excluir_conta passa a pegar também o lock 'degustacao:<hash>' das degustações do cliente, na ordem
--    conta: -> degustacao:<hash> (criar_degustacao usa degustacao: -> cliente:, nunca conta:; sem ciclo).

alter table licencas add column origem text check (origem in ('degustacao'));
-- Licenças de degustação já criadas pela 0016/0017: tipo cortesia + e-mail com degustação confirmada.
update licencas l set origem = 'degustacao'
 where l.tipo = 'cortesia' and exists (
   select 1 from degustacoes d join clientes c on c.email_compra = d.email
    where c.id = l.cliente_id and d.status = 'confirmada');

create or replace function criar_degustacao(p_token_hash text, p_dias int, p_agora timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d degustacoes%rowtype; cli uuid; lic licencas%rowtype;
begin
  select * into d from degustacoes where token_hash = p_token_hash;
  if not found then return jsonb_build_object('resultado', 'token_invalido'); end if;
  perform pg_advisory_xact_lock(hashtextextended('degustacao:' || d.email_hash, 0));
  select * into d from degustacoes where id = d.id for update;
  if d.token_hash <> p_token_hash or d.email is null then return jsonb_build_object('resultado', 'token_invalido'); end if; -- renovado ou anonimizado
  perform pg_advisory_xact_lock(hashtextextended('cliente:' || lower(trim(d.email)), 0));
  if d.status = 'confirmada' then return jsonb_build_object('resultado', 'ja_usada'); end if;
  if d.status = 'expirada' or d.expira_em <= p_agora then
    update degustacoes set status = 'expirada' where id = d.id;
    return jsonb_build_object('resultado', 'expirada');
  end if;
  select id into cli from clientes where email_compra = d.email;
  if cli is null then
    insert into clientes (email_compra, nome_tratamento) values (d.email, 'Convidado') returning id into cli;
  end if;
  select * into lic from licencas where cliente_id = cli order by criada_em limit 1;
  if found then return jsonb_build_object('resultado', 'ja_tem_licenca', 'email', d.email); end if;
  insert into licencas (cliente_id, status, plano_valor, tipo, origem, validade_em, comprada_em, avisos_atraso)
  values (cli, 'ativa', 0, 'cortesia', 'degustacao', p_agora + make_interval(days => p_dias), null, 0) returning * into lic;
  update degustacoes set status = 'confirmada', confirmado_em = p_agora where id = d.id;
  return jsonb_build_object('resultado', 'criada', 'email', d.email, 'licenca', jsonb_build_object(
    'id', lic.id, 'cliente_id', lic.cliente_id, 'status', lic.status, 'pausa_prevista_em', lic.pausa_prevista_em,
    'troca_liberada_em', lic.troca_liberada_em, 'comprada_em', lic.comprada_em, 'avisos_atraso', lic.avisos_atraso,
    'conta_gateway_id', lic.conta_gateway_id, 'gateway_cliente_ref', lic.gateway_cliente_ref,
    'gateway_assinatura_ref', lic.gateway_assinatura_ref, 'mensalidade_encerra_em', lic.mensalidade_encerra_em,
    'tipo', lic.tipo, 'origem', lic.origem, 'validade_em', lic.validade_em));
end $$;

create or replace function excluir_conta(p_cliente uuid, p_quando timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare cli clientes%rowtype; anon text; h text;
begin
  perform pg_advisory_xact_lock(hashtextextended('conta:' || p_cliente::text, 0));
  -- Ordem de locks: conta: -> degustacao:<hash> (em ordem de hash) -> (linhas). criar_degustacao pega degustacao: -> cliente:, nunca conta:, então não há ciclo.
  for h in select email_hash from degustacoes where email = (select email_compra from clientes where id = p_cliente) order by email_hash loop
    perform pg_advisory_xact_lock(hashtextextended('degustacao:' || h, 0));
  end loop;
  select * into cli from clientes where id = p_cliente for update;
  if not found then return false; end if;
  if cli.excluido_em is not null then return true; end if; -- já excluída
  anon := 'excluido+' || p_cliente::text || '@anonimo.invalid';

  update licencas set status = 'cancelada', pausa_prevista_em = null, troca_liberada_em = null,
         gateway_cliente_ref = null, gateway_assinatura_ref = null
   where cliente_id = p_cliente;
  delete from ativacoes where licenca_id in (select id from licencas where cliente_id = p_cliente);
  delete from trocas_computador where licenca_id in (select id from licencas where cliente_id = p_cliente);
  delete from links_instalacao where cliente_id = p_cliente;
  delete from codigos where cliente_id = p_cliente;
  delete from ocorrencias_admin where cliente_id = p_cliente;
  delete from sessoes_checkout where email = cli.email_compra;
  update consentimentos set email = anon, cliente_id = p_cliente where email = cli.email_compra;
  update degustacoes set email = null, ip = null, token_hash = 'anon-' || id::text,
         status = case when status = 'pendente' then 'expirada' else status end
   where email = cli.email_compra;
  update clientes set email_compra = anon, nome_tratamento = 'Conta excluída', empresa = null, ramo = null,
         excluido_em = p_quando
   where id = p_cliente;
  return true;
end $$;

revoke all on function criar_degustacao, excluir_conta from public, anon, authenticated;
grant execute on function criar_degustacao, excluir_conta to service_role;
