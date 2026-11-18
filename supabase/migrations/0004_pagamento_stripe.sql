-- Atlas M3 · S6 — pagamento e cobrança recorrente (Stripe, conta SEMPRE do cliente).
-- Nenhum segredo no banco: contas_gateway guarda só a REFERÊNCIA (nome do segredo no cofre/ambiente
-- da função), nunca a chave. Sem dados de cartão: só ids do gateway.

create table contas_gateway (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade, -- nulo até a compra ser confirmada
  conta_stripe_id text not null unique,                       -- acct_… (do cliente)
  segredo_ref text not null,                                  -- ex.: "CLIENTE1" → env STRIPE_CLIENTE1_SK / _WHSEC
  modo text not null default 'teste' check (modo in ('teste','ao_vivo')),
  criada_em timestamptz not null default now()
);

alter table licencas
  add column comprada_em timestamptz,                -- implantação paga: início dos 7 dias (CDC art. 49)
  add column avisos_atraso int not null default 0 check (avisos_atraso between 0 and 3),
  add column conta_gateway_id uuid references contas_gateway(id),
  add column gateway_cliente_ref text,               -- cus_…
  add column gateway_assinatura_ref text,            -- sub_…
  add column mensalidade_encerra_em timestamptz;     -- mensalidade cancelada: vale até aqui
create index on licencas (conta_gateway_id, gateway_cliente_ref);
create index on licencas (conta_gateway_id, gateway_assinatura_ref);

alter table pagamentos
  add column gateway_pi text,                        -- payment_intent (estorno)
  add column pago_em timestamptz;
create index on pagamentos (gateway_pi);

-- idempotência do webhook: cada evento do gateway é processado uma vez por conta
create table eventos_gateway (
  conta_gateway_id uuid not null references contas_gateway(id) on delete cascade,
  evento_id text not null,
  recebido_em timestamptz not null default now(),
  primary key (conta_gateway_id, evento_id)
);

alter table contas_gateway enable row level security;
alter table eventos_gateway enable row level security;
-- sem política: só service_role (edge functions) lê/escreve.

-- O portal (authenticated) não enxerga as referências do gateway nas licenças.
revoke select on licencas from authenticated, anon;
grant select (id, cliente_id, status, plano_valor, criada_em, pausa_prevista_em, comprada_em, mensalidade_encerra_em) on licencas to authenticated;
