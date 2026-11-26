-- Luiz (26/11/2026): o celular mostra o andamento com 2 casas, igual ao notebook (2,72% em vez de 3%).
-- O check (0 a 100) continua; a coluna passa a guardar 2 casas e a função passa a ler o número como decimal.
alter table status_obras alter column percentual type numeric(5,2) using percentual::numeric(5,2);

create or replace function substituir_status_obras(p_licenca uuid, p_obras jsonb, p_agora timestamptz)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if jsonb_typeof(p_obras) <> 'array' then raise exception 'p_obras deve ser uma lista'; end if;
  delete from status_obras where licenca_id = p_licenca
    and obra_id not in (select o->>'obra_id' from jsonb_array_elements(p_obras) o);
  insert into status_obras (licenca_id, obra_id, nome, segmento, etapa_atual_numero, etapa_atual_rotulo, total_etapas, percentual, estado, ativa_agora, ultima_noticia, ultima_noticia_em, atualizado_em)
  select p_licenca, o->>'obra_id', o->>'nome', nullif(o->>'segmento',''), (o->>'etapa_atual_numero')::int, o->>'etapa_atual_rotulo',
         (o->>'total_etapas')::int, round((o->>'percentual')::numeric, 2), o->>'estado', (o->>'ativa_agora')::boolean, o->>'ultima_noticia',
         (o->>'ultima_noticia_em')::timestamptz, p_agora
    from jsonb_array_elements(p_obras) o
  on conflict (licenca_id, obra_id) do update set
    nome = excluded.nome, segmento = excluded.segmento, etapa_atual_numero = excluded.etapa_atual_numero,
    etapa_atual_rotulo = excluded.etapa_atual_rotulo, total_etapas = excluded.total_etapas, percentual = excluded.percentual,
    estado = excluded.estado, ativa_agora = excluded.ativa_agora, ultima_noticia = excluded.ultima_noticia,
    ultima_noticia_em = excluded.ultima_noticia_em, atualizado_em = excluded.atualizado_em;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function substituir_status_obras(uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function substituir_status_obras(uuid, jsonb, timestamptz) to service_role;
