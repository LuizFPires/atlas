-- Atlas · bloco C — auto-auditoria semanal da degustação (anti-fraude). A varredura SÓ SINALIZA: abre ocorrências no painel; o gestor decide.
-- Limiares (espelho de _shared/auditoria.ts): domínio 5 · ip 8 · tronco 3 grafias ou 6 pedidos · computador 3 barradas.
-- 1) ocorrencias_admin.chave: identifica "o mesmo alerta"; índice único parcial = no máximo 1 alerta ABERTO por chave (não reabre igual toda semana).
-- 2) degustacoes: contadores de pedidos e de grafias diferentes do mesmo e-mail normalizado (pedir_degustacao passa a contá-los).
-- 3) degustacoes_dispositivos: contador de vezes que o computador foi barrado (trocar_computador e registrar_barrada_dispositivo).
-- 4) auditar_degustacao(p_agora, p_desde): a varredura. Nada de e-mail cru nas descrições: só domínio, contagens, IP mascarado e pedaço do HMAC.

alter table ocorrencias_admin add column chave text;
create unique index ocorrencias_chave_aberta_idx on ocorrencias_admin (chave) where not resolvida and chave is not null;

alter table degustacoes
  add column pedidos int not null default 1,
  add column variantes int not null default 0,
  add column ultimo_pedido_em timestamptz;
update degustacoes set ultimo_pedido_em = criado_em;
alter table degustacoes alter column ultimo_pedido_em set not null;
alter table degustacoes alter column ultimo_pedido_em set default now();

alter table degustacoes_dispositivos
  add column barradas int not null default 0,
  add column ultima_barrada_em timestamptz;

-- Mesmo corpo da 0017, mais os contadores. Repetir o pedido de quem já confirmou também conta (sem mexer em criado_em).
create or replace function pedir_degustacao(p_email text, p_hash text, p_token_hash text, p_ip text, p_expira timestamptz, p_agora timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare ex degustacoes%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('degustacao:' || p_hash, 0));
  select * into ex from degustacoes where email_hash = p_hash for update;
  if not found then
    insert into degustacoes (email, email_hash, token_hash, ip, expira_em, criado_em, ultimo_pedido_em)
    values (p_email, p_hash, p_token_hash, p_ip, p_expira, p_agora, p_agora);
    return 'criado';
  end if;
  if ex.status = 'confirmada' then
    update degustacoes set pedidos = pedidos + 1, ultimo_pedido_em = p_agora where id = ex.id;
    return 'ja_usada';
  end if;
  update degustacoes set email = p_email, token_hash = p_token_hash, ip = p_ip, expira_em = p_expira, criado_em = p_agora, status = 'pendente',
    pedidos = pedidos + 1, ultimo_pedido_em = p_agora,
    variantes = variantes + (case when ex.email is distinct from p_email then 1 else 0 end)
  where id = ex.id and status <> 'confirmada';
  if not found then return 'ja_usada'; end if;
  return 'reenviado';
end $$;

-- Conta uma tentativa barrada de um computador que já usou outro teste (a ativação/troca chama; trocar_computador faz o mesmo por dentro).
create function registrar_barrada_dispositivo(p_hmac text, p_quando timestamptz)
returns void language sql security definer set search_path = public as $$
  update degustacoes_dispositivos set barradas = barradas + 1, ultima_barrada_em = p_quando where dispositivo_hmac = p_hmac;
$$;

-- Mesma trocar_computador da 0019, mais a contagem da barrada. O "return false" não desfaz a transação, então a contagem fica.
create or replace function trocar_computador(
  p_licenca uuid, p_ativacao_atual uuid, p_de text, p_para text, p_token_hash text,
  p_quando timestamptz, p_por_admin boolean, p_intervalo_ms bigint, p_dispositivo_hmac text default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare n int; teste boolean;
begin
  perform 1 from licencas where id = p_licenca for update;
  if p_intervalo_ms > 0 and exists (
    select 1 from trocas_computador
     where licenca_id = p_licenca and feita_em > p_quando - (p_intervalo_ms || ' milliseconds')::interval
  ) then return false; end if;
  select (tipo = 'cortesia' and origem = 'degustacao') into teste from licencas where id = p_licenca;
  if teste and p_dispositivo_hmac is not null then
    if computador_ja_testou(p_dispositivo_hmac, p_licenca) then
      perform registrar_barrada_dispositivo(p_dispositivo_hmac, p_quando);
      return false;
    end if;
  end if;
  update ativacoes set ativo = false, desativado_em = p_quando
   where id = p_ativacao_atual and licenca_id = p_licenca and ativo;
  get diagnostics n = row_count;
  if n <> 1 then return false; end if;
  insert into ativacoes (licenca_id, computador_hash, token_hash, ativado_em) values (p_licenca, p_para, p_token_hash, p_quando);
  insert into trocas_computador (licenca_id, de_hash, para_hash, feita_em, por_admin) values (p_licenca, p_de, p_para, p_quando, p_por_admin);
  if p_por_admin then update licencas set troca_liberada_em = null where id = p_licenca; end if;
  if teste and p_dispositivo_hmac is not null and not registrar_dispositivo_teste(p_dispositivo_hmac, p_licenca, p_quando) then
    raise exception 'ja_testou_neste_computador';
  end if;
  return true;
end $$;

-- A varredura. Devolve quantos alertas NOVOS abriu. Alerta igual ainda aberto (mesma chave) não é repetido.
create function auditar_degustacao(p_agora timestamptz, p_desde timestamptz)
returns int language plpgsql security definer set search_path = public as $$
declare total int := 0; n int; r record;
begin
  perform pg_advisory_xact_lock(hashtextextended('auditoria:degustacao', 0)); -- duas varreduras ao mesmo tempo não se atropelam

  -- 1) Domínio ainda NÃO bloqueado com muitos e-mails diferentes pedindo (candidato a descartável). Provedores grandes ficam de fora.
  for r in
    select split_part(email, '@', 2) as dominio, count(distinct email_hash) as qtd
      from degustacoes
     where ultimo_pedido_em >= p_desde and email is not null and position('@' in email) > 0
     group by 1
    having count(distinct email_hash) >= 5
  loop
    continue when r.dominio = '' or r.dominio = any (array['gmail.com','googlemail.com','hotmail.com','outlook.com','live.com','msn.com','yahoo.com','yahoo.com.br','icloud.com','me.com','uol.com.br','bol.com.br','terra.com.br','globo.com','globomail.com','ig.com.br','oi.com.br','r7.com','protonmail.com','proton.me']);
    continue when exists (select 1 from dominios_bloqueados b where r.dominio = b.dominio or r.dominio like '%.' || b.dominio);
    insert into ocorrencias_admin (cliente_id, tipo, descricao, autor, resolvida, criada_em, chave)
    values (null, 'auditoria_degustacao',
      format('Domínio suspeito no teste grátis: %s pessoas diferentes pediram o teste com e-mail @%s nos últimos dias. Se for e-mail temporário (daqueles que somem em minutos), clique em "Bloquear este domínio". Se for uma empresa de verdade, é só dar baixa.', r.qtd, r.dominio),
      'auto-auditoria', false, p_agora, 'aud:dominio:' || r.dominio)
    on conflict (chave) where (not resolvida and chave is not null) do nothing;
    get diagnostics n = row_count; total := total + n;
  end loop;

  -- 2) Muitos e-mails diferentes saindo do mesmo IP. IP mascarado na descrição.
  for r in
    select ip, count(distinct email_hash) as qtd
      from degustacoes
     where ultimo_pedido_em >= p_desde and ip is not null
     group by ip
    having count(distinct email_hash) >= 8
  loop
    insert into ocorrencias_admin (cliente_id, tipo, descricao, autor, resolvida, criada_em, chave)
    values (null, 'auditoria_degustacao',
      format('Muitos pedidos do mesmo lugar: %s e-mails diferentes pediram o teste grátis a partir do IP %s nos últimos dias. Pode ser uma empresa ou escola dividindo a internet (normal), ou uma pessoa tentando muitos testes. Olhe os domínios dos e-mails; se parecer abuso, bloqueie o domínio ou desligue o teste por um tempo.',
        r.qtd, case when r.ip ~ '^\d+\.\d+\.\d+\.\d+$' then split_part(r.ip, '.', 1) || '.' || split_part(r.ip, '.', 2) || '.*.*' else left(r.ip, 9) || '…' end),
      'auto-auditoria', false, p_agora, 'aud:ip:' || left(md5(r.ip), 12))
    on conflict (chave) where (not resolvida and chave is not null) do nothing;
    get diagnostics n = row_count; total := total + n;
  end loop;

  -- 3) Mesmo e-mail (depois de tirar pontos e +tag) pedido de muitos jeitos ou muitas vezes. Sem o e-mail na descrição.
  for r in
    select email_hash, pedidos, variantes
      from degustacoes
     where ultimo_pedido_em >= p_desde and (variantes >= 3 or pedidos >= 6)
  loop
    insert into ocorrencias_admin (cliente_id, tipo, descricao, autor, resolvida, criada_em, chave)
    values (null, 'auditoria_degustacao',
      format('Uma mesma pessoa tentou o teste grátis %s vezes, escrevendo o e-mail de %s jeitos diferentes (com pontos ou "+algo" no meio). O Atlas já trata tudo isso como o mesmo e-mail e libera só 1 teste, então não precisa fazer nada; é só um aviso de que tem gente tentando burlar. Dê baixa quando quiser.',
        r.pedidos, r.variantes + 1),
      'auto-auditoria', false, p_agora, 'aud:tronco:' || left(r.email_hash, 12))
    on conflict (chave) where (not resolvida and chave is not null) do nothing;
    get diagnostics n = row_count; total := total + n;
  end loop;

  -- 4) Computador barrado várias vezes (quer um segundo teste de graça). Só um pedaço do código do computador, nunca o código inteiro.
  for r in
    select dispositivo_hmac, barradas
      from degustacoes_dispositivos
     where ultima_barrada_em >= p_desde and barradas >= 3
  loop
    insert into ocorrencias_admin (cliente_id, tipo, descricao, autor, resolvida, criada_em, chave)
    values (null, 'auditoria_degustacao',
      format('Um computador (final %s) foi barrado %s vezes tentando usar outro teste grátis. O Atlas já recusou todas; é só um aviso de reincidência. Se essa pessoa quiser mesmo continuar, o caminho é assinar. Dê baixa quando quiser.',
        right(r.dispositivo_hmac, 6), r.barradas),
      'auto-auditoria', false, p_agora, 'aud:disp:' || left(r.dispositivo_hmac, 12))
    on conflict (chave) where (not resolvida and chave is not null) do nothing;
    get diagnostics n = row_count; total := total + n;
  end loop;

  return total;
end $$;

revoke all on function pedir_degustacao, trocar_computador, registrar_barrada_dispositivo, auditar_degustacao from public, anon, authenticated;
grant execute on function pedir_degustacao, trocar_computador, registrar_barrada_dispositivo, auditar_degustacao to service_role;
