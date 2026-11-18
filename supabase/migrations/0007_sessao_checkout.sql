-- Atlas M4 (revisão de segurança) — o cadastro passa a ser ligado à prova da compra: o session_id do Stripe Checkout.
-- O id (cs_…) só volta ao comprador na URL de sucesso; quem apenas sabe o e-mail da compra não consegue cadastrar.
create table sessoes_checkout (
  sessao_id text primary key,
  conta_gateway_id uuid not null references contas_gateway(id) on delete cascade,
  email text not null,
  paga boolean not null default false,
  criada_em timestamptz not null default now(),
  paga_em timestamptz
);
create index on sessoes_checkout (email);
alter table sessoes_checkout enable row level security;
-- sem política: só service_role (edge functions) lê/escreve.
