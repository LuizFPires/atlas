-- Atlas · LGPD técnica (1/2) — consentimento: aceite da Política de Privacidade e dos Termos de Uso.
-- Registra QUAL versão dos textos o comprador aceitou, QUANDO, e para qual e-mail (a compra ainda não tem cliente nesse momento).
-- Só o servidor (service_role) escreve: o cliente nunca grava o próprio aceite direto no banco.
-- Prova do aceite: não guardamos IP nem navegador, só o mínimo (e-mail, versão, quando, de onde veio).
create table consentimentos (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  cliente_id uuid references clientes(id) on delete set null,
  versao_termos text not null check (versao_termos ~ '^[0-9A-Za-z._-]{1,20}$'),
  origem text not null check (origem in ('checkout')),
  aceito_em timestamptz not null default now()
);
create index on consentimentos (email);
create index on consentimentos (cliente_id);
alter table consentimentos enable row level security;
-- sem política para anon/authenticated: só service_role.
revoke all on consentimentos from anon, authenticated;
