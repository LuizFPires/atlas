-- Atlas · M32 fatia (b): personalização do app pronto da prateleira (nome, logo, duas cores), uma por licença.
-- O segmento NÃO é guardado aqui: vem da compra (pagamentos.segmento, 0023). Cores em #RRGGBB, validadas também no banco.
-- Acesso só pelo servidor (service_role); a licença é sempre descoberta pelo login, nunca pelo corpo.
create table if not exists personalizacao_app (
  licenca_id    uuid        primary key references licencas(id) on delete cascade,
  nome_negocio  text        not null check (char_length(btrim(nome_negocio)) between 1 and 60),
  logo_url      text        check (logo_url is null or (char_length(logo_url) <= 500 and logo_url ~ '^https://')),
  cor_principal text        not null check (cor_principal ~ '^#[0-9A-Fa-f]{6}$'),
  cor_apoio     text        not null check (cor_apoio ~ '^#[0-9A-Fa-f]{6}$'),
  atualizado_em timestamptz not null default now()
);
alter table personalizacao_app enable row level security;
revoke all on personalizacao_app from public, anon, authenticated;
grant select, insert, update, delete on personalizacao_app to service_role;
