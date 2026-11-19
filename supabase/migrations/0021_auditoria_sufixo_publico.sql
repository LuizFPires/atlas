-- Atlas · bloco C, correção de segurança sobre a 0020: a varredura não sugere sufixo público (com.br) nem pai de provedor, e só conta testes confirmados.
-- Lista de sufixos = SUFIXOS_PUBLICOS de _shared/auditoria.ts (mude nos dois lugares).

-- A varredura (revisão: domínio só conta testes CONFIRMADOS e nunca sugere sufixo público). Devolve quantos alertas NOVOS abriu. Alerta igual ainda aberto (mesma chave) não é repetido.
create or replace function auditar_degustacao(p_agora timestamptz, p_desde timestamptz)
returns int language plpgsql security definer set search_path = public as $$
declare total int := 0; n int; r record;
begin
  perform pg_advisory_xact_lock(hashtextextended('auditoria:degustacao', 0)); -- duas varreduras ao mesmo tempo não se atropelam

  -- 1) Domínio ainda NÃO bloqueado com muitos e-mails diferentes pedindo (candidato a descartável). Provedores grandes ficam de fora.
  for r in
    select split_part(email, '@', 2) as dominio, count(distinct email_hash) as qtd
      from degustacoes
     where ultimo_pedido_em >= p_desde and status = 'confirmada' and email is not null and position('@' in email) > 0
     group by 1
    having count(distinct email_hash) >= 5
  loop
    continue when r.dominio = '' or r.dominio = any (array['gmail.com','googlemail.com','hotmail.com','outlook.com','live.com','msn.com','yahoo.com','yahoo.com.br','icloud.com','me.com','uol.com.br','bol.com.br','terra.com.br','globo.com','globomail.com','ig.com.br','oi.com.br','r7.com','protonmail.com','proton.me']);
    -- nunca sugere sufixo público (com.br, co.uk...) nem domínio "pai" de provedor comum: bloquear derrubaria gente de verdade
    continue when r.dominio = any (array['com.br','net.br','org.br','gov.br','edu.br','mil.br','art.br','blog.br','eco.br','eng.br','adv.br','med.br','psc.br','ind.br','inf.br','jus.br','leg.br','mp.br','tv.br','wiki.br','co.uk','org.uk','ac.uk','gov.uk','me.uk','com.au','net.au','org.au','co.nz','co.za','co.jp','ne.jp','or.jp','co.in','com.ar','com.mx','com.pt','com.co','com.cn','com.tr','co.kr','com.ve','com.uy','com.py','com.pe','com.bo','com.ec','com.cl','com','net','org','edu','gov','mil','int','info','biz','io','co','app','dev','xyz','online','site','top','club','shop','store','tech','cloud','email','br','uk','us','ai','me','tv','cc','pt','ar','mx','github.io','vercel.app','netlify.app','herokuapp.com','blogspot.com','web.app','pages.dev','workers.dev','appspot.com']) or r.dominio ~ '^(com|net|org|gov|edu|mil|co|ac|or|ne|go|nom|ltd|plc)\.[a-z]{2}$' or r.dominio !~ '\.';
    continue when exists (select 1 from unnest(array['gmail.com','googlemail.com','hotmail.com','outlook.com','live.com','msn.com','yahoo.com','yahoo.com.br','icloud.com','me.com','uol.com.br','bol.com.br','terra.com.br','globo.com','globomail.com','ig.com.br','oi.com.br','r7.com','protonmail.com','proton.me']) p where p like '%.' || r.dominio);
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

revoke all on function auditar_degustacao from public, anon, authenticated;
grant execute on function auditar_degustacao to service_role;
