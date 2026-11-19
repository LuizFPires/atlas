-- Atlas · degustação, correções da revisão de segurança (sobre 0016, já commitada).
-- 1) Corrida: pedir_degustacao nunca mexe numa degustação CONFIRMADA. Pedir e confirmar pegam a MESMA chave de lock
--    ('degustacao:' || email_hash) ANTES do lock por cliente ('cliente:' || email), sempre nessa ordem (sem deadlock).
-- 2) LGPD: o dedup passa a usar um HASH do e-mail normalizado (sha256 hex), não o texto cru. email e ip viram anuláveis:
--    excluir_conta zera os dois (e invalida o token), e limpar_ips_degustacao zera o ip de linhas antigas (cron do deploy).

alter table degustacoes add column email_hash text;
update degustacoes set email_hash = encode(sha256(convert_to(email_normalizado, 'utf8')), 'hex');
alter table degustacoes alter column email_hash set not null;
alter table degustacoes add constraint degustacoes_email_hash_key unique (email_hash);
alter table degustacoes drop column email_normalizado;
alter table degustacoes alter column email drop not null;

drop function pedir_degustacao(text, text, text, text, timestamptz, timestamptz);
create function pedir_degustacao(p_email text, p_hash text, p_token_hash text, p_ip text, p_expira timestamptz, p_agora timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare ex degustacoes%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('degustacao:' || p_hash, 0));
  select * into ex from degustacoes where email_hash = p_hash for update;
  if not found then
    insert into degustacoes (email, email_hash, token_hash, ip, expira_em, criado_em)
    values (p_email, p_hash, p_token_hash, p_ip, p_expira, p_agora);
    return 'criado';
  end if;
  if ex.status = 'confirmada' then return 'ja_usada'; end if;
  update degustacoes set email = p_email, token_hash = p_token_hash, ip = p_ip, expira_em = p_expira, criado_em = p_agora, status = 'pendente'
  where id = ex.id and status <> 'confirmada';
  if not found then return 'ja_usada'; end if;
  return 'reenviado';
end $$;

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
  insert into licencas (cliente_id, status, plano_valor, tipo, validade_em, comprada_em, avisos_atraso)
  values (cli, 'ativa', 0, 'cortesia', p_agora + make_interval(days => p_dias), null, 0) returning * into lic;
  update degustacoes set status = 'confirmada', confirmado_em = p_agora where id = d.id;
  return jsonb_build_object('resultado', 'criada', 'email', d.email, 'licenca', jsonb_build_object(
    'id', lic.id, 'cliente_id', lic.cliente_id, 'status', lic.status, 'pausa_prevista_em', lic.pausa_prevista_em,
    'troca_liberada_em', lic.troca_liberada_em, 'comprada_em', lic.comprada_em, 'avisos_atraso', lic.avisos_atraso,
    'conta_gateway_id', lic.conta_gateway_id, 'gateway_cliente_ref', lic.gateway_cliente_ref,
    'gateway_assinatura_ref', lic.gateway_assinatura_ref, 'mensalidade_encerra_em', lic.mensalidade_encerra_em,
    'tipo', lic.tipo, 'validade_em', lic.validade_em));
end $$;

-- Limpeza do ip (o cron diário do deploy chama). Zera o ip de linhas mais velhas que p_dias; devolve quantas.
create function limpar_ips_degustacao(p_agora timestamptz, p_dias int default 30)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update degustacoes set ip = null where ip is not null and criado_em < p_agora - make_interval(days => p_dias);
  get diagnostics n = row_count;
  return n;
end $$;

-- excluir_conta (0012) + degustação: zera e-mail e ip, invalida o token e fecha o pedido pendente.
-- Fica só o hash do e-mail normalizado (anti-repetição: quem apaga a conta não ganha outro teste).
create or replace function excluir_conta(p_cliente uuid, p_quando timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare cli clientes%rowtype; anon text;
begin
  perform pg_advisory_xact_lock(hashtextextended('conta:' || p_cliente::text, 0));
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

revoke all on function pedir_degustacao, criar_degustacao, limpar_ips_degustacao, excluir_conta from public, anon, authenticated;
grant execute on function pedir_degustacao, criar_degustacao, limpar_ips_degustacao, excluir_conta to service_role;
