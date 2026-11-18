-- Atlas · /entregar — RPCs atômicas que faltavam para o adaptador Supabase real (_shared/adaptadores_supabase.ts).
-- Cada uma espelha um método atômico da porta Store (tipos.ts) com a mesma semântica do StoreMemoria.
-- Só o service_role executa (edge functions). Não altera nenhuma migration anterior.

-- Store.criarCompra: cria cliente + licença da compra paga; se o e-mail já tem licença, devolve a existente (idempotente).
-- Serializa por e-mail. Devolve { licenca: {...colunas lidas pelo servidor}, nova: boolean }.
create function criar_compra(
  p_email text, p_nome text, p_valor numeric, p_conta uuid, p_cliente_ref text, p_agora timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare cli uuid; lic licencas%rowtype; nova boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended('compra:' || p_email, 0));
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

-- Store.gravarPagamento: upsert por (conta_gateway_id, gateway_ref), condicional a status <> 'estornado'.
-- Devolve o status anterior (nulo = não existia). Se o anterior era 'estornado' e o novo não é, nada é aplicado.
create function gravar_pagamento(
  p_licenca uuid, p_conta uuid, p_tipo text, p_valor numeric, p_status text, p_ref text, p_pi text, p_pago_em timestamptz
) returns text language plpgsql security definer set search_path = public as $$
declare antes text;
begin
  perform pg_advisory_xact_lock(hashtextextended('pgto:' || p_conta::text || ':' || p_ref, 0));
  select status into antes from pagamentos where conta_gateway_id = p_conta and gateway_ref = p_ref;
  if not found then
    insert into pagamentos (licenca_id, conta_gateway_id, tipo, valor, status, gateway_ref, gateway_pi, pago_em)
    values (p_licenca, p_conta, p_tipo, p_valor, p_status, p_ref, p_pi, p_pago_em);
    return null;
  end if;
  if antes = 'estornado' and p_status <> 'estornado' then return antes; end if;
  update pagamentos set licenca_id = p_licenca, tipo = p_tipo, valor = p_valor, status = p_status, gateway_pi = p_pi, pago_em = p_pago_em
   where conta_gateway_id = p_conta and gateway_ref = p_ref;
  return antes;
end $$;

-- Store.trocarLinks: invalida os links abertos do cliente e insere o novo na mesma transação (sobra um só válido).
create function trocar_links(p_cliente uuid, p_hash text, p_expira timestamptz, p_agora timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('links:' || p_cliente::text, 0));
  update links_instalacao set usado_em = p_agora where cliente_id = p_cliente and usado_em is null;
  insert into links_instalacao (cliente_id, token_hash, expira_em) values (p_cliente, p_hash, p_expira);
end $$;

revoke all on function criar_compra, gravar_pagamento, trocar_links from public, anon, authenticated;
grant execute on function criar_compra, gravar_pagamento, trocar_links to service_role;
