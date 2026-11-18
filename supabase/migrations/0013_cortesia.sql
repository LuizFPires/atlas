-- Atlas · cortesia manual (bloco A). O gestor libera acesso por e-mail com data de vencimento; vencida, o acesso cai sozinho.
-- licencas já tem RLS ligado e nenhuma política para anon/authenticated: só o service_role (edge function) lê e escreve.
-- Nada de política nova aqui. Pagamento/assinatura não são tocados: licença 'paga' segue exatamente como antes.

alter table licencas
  add column tipo text not null default 'paga' check (tipo in ('paga','cortesia')),
  add column validade_em timestamptz; -- nulo = sem prazo (paga). Cortesia SEMPRE tem prazo.

alter table licencas
  add constraint licencas_cortesia_com_prazo check (tipo <> 'cortesia' or validade_em is not null);

-- Varredura por cortesias a vencer / vencidas.
create index licencas_cortesia_validade_idx on licencas (validade_em) where tipo = 'cortesia';

-- Store.criarCortesia: acha ou cria o cliente pelo e-mail (já normalizado) e cria/renova a licença de cortesia.
-- Atômica e idempotente (serializa por e-mail). Se o e-mail já tem licença PAGA, não mexe em nada ('ja_tem_paga').
-- Uma cortesia existente (ativa, vencida ou cancelada) é renovada: status 'ativa' e nova validade. O computador ativado não muda.
create function criar_cortesia(p_email text, p_nome text, p_validade timestamptz, p_agora timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cli uuid; lic licencas%rowtype; res text;
begin
  perform pg_advisory_xact_lock(hashtextextended('cortesia:' || p_email, 0));
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

revoke all on function criar_cortesia from public, anon, authenticated;
grant execute on function criar_cortesia to service_role;
