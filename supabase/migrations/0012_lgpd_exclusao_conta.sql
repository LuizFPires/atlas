-- Atlas · LGPD técnica (2/2) — exclusão de conta pelo próprio cliente (LGPD art. 18, VI).
-- Decisão apagar x anonimizar: o cliente é ANONIMIZADO (a linha fica porque pagamentos e licença apontam para ela,
-- e a guarda de pagamentos é obrigação fiscal/legal, LGPD art. 16, I). Tudo que é pessoal e não é obrigação legal é APAGADO.
--   anonimiza : clientes (e-mail, nome, empresa, ramo; solta o vínculo com o login)
--   apaga     : links de instalação, códigos, computadores (ativacoes/trocas), sessões de checkout, ocorrências do cliente
--   mantém    : pagamentos (valores/datas/status, sem dado pessoal), entregas_kit (marca d'água é HMAC, prova contra vazamento)
--   consentimentos: ficam, mas com o e-mail anonimizado (prova do aceite, sem identificar a pessoa)
-- Idempotente: repetir não faz mal (a exclusão do login no Auth pode precisar ser tentada de novo).
alter table clientes add column excluido_em timestamptz;

create function excluir_conta(p_cliente uuid, p_quando timestamptz)
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
  update clientes set email_compra = anon, nome_tratamento = 'Conta excluída', empresa = null, ramo = null,
         excluido_em = p_quando
   where id = p_cliente;
  return true;
end $$;

revoke all on function excluir_conta from public, anon, authenticated;
grant execute on function excluir_conta to service_role;
