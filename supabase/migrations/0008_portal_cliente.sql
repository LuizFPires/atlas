-- Atlas M6 · portal do cliente (F15).
-- (1) O portal (role authenticated) só enxerga colunas seguras de pagamentos: gateway_ref/gateway_pi/conta ficam só no servidor.
--     (0003 fez isso em ativacoes e 0004 em licencas; pagamentos tinha ficado com select total.)
-- (2) Troca pelo portal: desativa o computador atual SEM ativar outro (o novo ativa depois, pelo link de instalação).
--     A troca fica registrada com para_hash nulo e conta no limite de 1 a cada 7 dias.
-- (3) O vínculo cliente <-> usuário do Supabase Auth só é gravado pelo servidor (função abaixo + service_role).

revoke select on pagamentos from authenticated, anon;
grant select (id, licenca_id, tipo, valor, status, competencia, pago_em) on pagamentos to authenticated;

alter table trocas_computador alter column para_hash drop not null;

create function liberar_computador(
  p_licenca uuid, p_ativacao_atual uuid, p_de text, p_quando timestamptz, p_por_admin boolean, p_intervalo_ms bigint
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
  insert into trocas_computador (licenca_id, de_hash, para_hash, feita_em, por_admin) values (p_licenca, p_de, null, p_quando, p_por_admin);
  if p_por_admin then update licencas set troca_liberada_em = null where id = p_licenca; end if;
  return true;
end $$;

revoke all on function liberar_computador from public, anon, authenticated;
grant execute on function liberar_computador to service_role;

-- Ligação cliente <-> Auth: o servidor liga pelo e-mail JÁ CONFIRMADO no Auth, uma única vez (auth_user_id é unique).
-- Nenhuma política de UPDATE em clientes para authenticated: o cliente não troca o próprio vínculo.
