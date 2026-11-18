-- Atlas · degustação self-service (bloco B): teste de N dias (padrão 5) com e-mail confirmado, anti-abuso e liga/desliga pelo painel.
-- A licença de teste é a MESMA infra da cortesia (0013): tipo='cortesia', validade_em, plano_valor 0, sem gateway.
-- Pagamento/assinatura não são tocados.

-- 1) Config: UMA linha. Nasce DESLIGADA; só o gestor liga (rota /admin/degustacao, service_role).
create table config_degustacao (
  id smallint primary key default 1 check (id = 1),
  ativa boolean not null default false,
  dias int not null default 5 check (dias between 1 and 30),
  atualizada_em timestamptz not null default now(),
  atualizada_por text
);
insert into config_degustacao (id) values (1);
alter table config_degustacao enable row level security;
revoke all on config_degustacao from anon, authenticated;
-- A página de vendas pode ler SÓ o que precisa (ativa, dias). Quem escreve é só o service_role.
grant select (ativa, dias) on config_degustacao to anon, authenticated;
create policy config_degustacao_leitura on config_degustacao for select to anon, authenticated using (true);

-- 2) Domínios de e-mail descartável: lista EXTENSÍVEL (a lista base também está em código; o bloco C alimenta esta tabela).
create table dominios_bloqueados (
  dominio text primary key check (dominio = lower(dominio) and dominio !~ '\s'),
  motivo text not null default 'descartavel',
  criado_em timestamptz not null default now()
);
alter table dominios_bloqueados enable row level security;
revoke all on dominios_bloqueados from anon, authenticated;

-- 3) Pedidos de degustação. UMA linha por e-mail normalizado (gmail: sem pontos e sem +tag) = 1 degustação por pessoa.
-- O token só existe como hash (sha256); o link no e-mail leva o token puro, uso único, ~48 h.
create table degustacoes (
  id uuid primary key default gen_random_uuid(),
  email text not null,                       -- como a pessoa digitou (lower/trim): é para onde o e-mail vai e o e-mail do cliente
  email_normalizado text not null unique,    -- chave anti-repetição
  token_hash text not null unique,
  status text not null default 'pendente' check (status in ('pendente','confirmada','expirada')),
  ip text,                                   -- só para limite/abuso; sai com a limpeza periódica
  expira_em timestamptz not null,
  criado_em timestamptz not null default now(),
  confirmado_em timestamptz
);
alter table degustacoes enable row level security;
revoke all on degustacoes from anon, authenticated;

-- 4) pedir_degustacao: grava (ou renova) o pedido PENDENTE. Não cria licença. 'ja_usada' = esse e-mail (normalizado) já confirmou.
create function pedir_degustacao(p_email text, p_norm text, p_token_hash text, p_ip text, p_expira timestamptz, p_agora timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare ex degustacoes%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('degustacao:' || p_norm, 0));
  select * into ex from degustacoes where email_normalizado = p_norm;
  if not found then
    insert into degustacoes (email, email_normalizado, token_hash, ip, expira_em, criado_em)
    values (p_email, p_norm, p_token_hash, p_ip, p_expira, p_agora);
    return 'criado';
  end if;
  if ex.status = 'confirmada' then return 'ja_usada'; end if;
  update degustacoes set email = p_email, token_hash = p_token_hash, ip = p_ip, expira_em = p_expira, criado_em = p_agora, status = 'pendente'
  where id = ex.id;
  return 'reenviado';
end $$;

-- 5) criar_degustacao: o token confirmado vira licença de teste. MESMO advisory lock por e-mail de criar_compra/criar_cortesia.
-- Resultados: criada | token_invalido | expirada | ja_usada | ja_tem_licenca (paga OU cortesia, ativa ou não: nada é criado).
create function criar_degustacao(p_token_hash text, p_dias int, p_agora timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d degustacoes%rowtype; cli uuid; lic licencas%rowtype;
begin
  select * into d from degustacoes where token_hash = p_token_hash;
  if not found then return jsonb_build_object('resultado', 'token_invalido'); end if;
  perform pg_advisory_xact_lock(hashtextextended('cliente:' || lower(trim(d.email)), 0));
  select * into d from degustacoes where id = d.id for update;
  if d.token_hash <> p_token_hash then return jsonb_build_object('resultado', 'token_invalido'); end if; -- o pedido foi renovado
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

revoke all on function pedir_degustacao, criar_degustacao from public, anon, authenticated;
grant execute on function pedir_degustacao, criar_degustacao to service_role;
