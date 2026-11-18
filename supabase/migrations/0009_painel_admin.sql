-- Atlas M7 · painel do administrador (F16).
-- Auditoria das ações do admin e "resolvida" nas ocorrências. A identidade do admin NÃO vive no banco:
-- é uma allowlist de e-mails confirmados no Supabase Auth (ATLAS_ADMIN_EMAILS, só no ambiente do servidor).
-- ocorrencias_admin segue com RLS ligado e SEM política: só service_role (edge function) lê/escreve; cliente nenhum enxerga.

alter table ocorrencias_admin
  add column autor text,            -- e-mail do admin que fez a ação (nulo = o sistema)
  add column resolvida_por text,    -- e-mail do admin que deu baixa
  add column resolvida_em timestamptz;

create index ocorrencias_abertas_idx on ocorrencias_admin (criada_em desc) where not resolvida;

-- Garantia explícita: nada disso é legível por anon/authenticated (portal do cliente).
revoke all on ocorrencias_admin from anon, authenticated;
revoke all on entregas_kit from anon, authenticated;
