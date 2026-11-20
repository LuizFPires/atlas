-- M32: registra qual app pronto (segmento) foi comprado na prateleira. Nulo = implantação do zero / mensalidade.
alter table pagamentos add column segmento text check (segmento in ('barbearia','restaurante','mercearia','academia'));

-- gravar_pagamento ganha p_segmento (opcional). Remove a assinatura antiga para não ficar função duplicada.
drop function gravar_pagamento(uuid, uuid, text, numeric, text, text, text, timestamptz);
create function gravar_pagamento(
  p_licenca uuid, p_conta uuid, p_tipo text, p_valor numeric, p_status text, p_ref text, p_pi text, p_pago_em timestamptz, p_segmento text default null
) returns text language plpgsql security definer set search_path = public as $$
declare antes text;
begin
  perform pg_advisory_xact_lock(hashtextextended('pgto:' || p_conta::text || ':' || p_ref, 0));
  select status into antes from pagamentos where conta_gateway_id = p_conta and gateway_ref = p_ref;
  if not found then
    insert into pagamentos (licenca_id, conta_gateway_id, tipo, valor, status, gateway_ref, gateway_pi, pago_em, segmento)
    values (p_licenca, p_conta, p_tipo, p_valor, p_status, p_ref, p_pi, p_pago_em, p_segmento);
    return null;
  end if;
  if antes = 'estornado' and p_status <> 'estornado' then return antes; end if;
  update pagamentos set licenca_id = p_licenca, tipo = p_tipo, valor = p_valor, status = p_status, gateway_pi = p_pi, pago_em = p_pago_em,
         segmento = coalesce(p_segmento, segmento)
   where conta_gateway_id = p_conta and gateway_ref = p_ref;
  return antes;
end $$;

revoke all on function gravar_pagamento from public, anon, authenticated;
grant execute on function gravar_pagamento to service_role;
