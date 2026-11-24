-- Atlas · M41: avisos no celular do dono (Web Push). Só o endereço do serviço de aviso do navegador e as chaves PÚBLICAS da
-- assinatura; a chave privada VAPID fica nos segredos do Supabase. Acesso só pelo servidor (service_role).
create table if not exists celular_push (
  licenca_id uuid not null references licencas(id) on delete cascade,
  endpoint   text not null check (char_length(endpoint) <= 800 and endpoint like 'https://%'),
  p256dh     text not null check (p256dh ~ '^[A-Za-z0-9_-]{1,200}$'),
  auth       text not null check (auth ~ '^[A-Za-z0-9_-]{1,100}$'),
  criada_em  timestamptz not null default now(),
  primary key (licenca_id, endpoint)
);

alter table celular_push enable row level security;
revoke all on celular_push from public, anon, authenticated;
grant select, insert, update, delete on celular_push to service_role;
