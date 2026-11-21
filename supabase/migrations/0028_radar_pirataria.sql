-- Atlas · Radar de pirataria (painel admin). O Radar SÓ AVISA: nada aqui pausa, bloqueia ou cancela licença; o Luiz decide.
-- Privacidade: NUNCA guarda IP. Só a UF (derivada do IP pela borda, na hora) e um id de dispositivo CURTO (8 primeiros caracteres do
-- sha256 do hash do computador: serve para reconhecer "o mesmo aparelho", não para identificá-lo nem reverter).
-- 1) radar_eventos: o que o servidor vê e o painel não consegue reconstruir sozinho (recusa de 2º computador e UF dos acessos).
--    As outras fontes já existem: trocas_computador (troca frequente) e degustacoes_dispositivos (teste grátis repetido).
-- 2) radar_baixas: "já verifiquei". Não apaga histórico: o sinal só some do painel enquanto não houver fato novo depois da baixa.
create table radar_eventos (
  id bigint generated always as identity primary key,
  licenca_id uuid not null references licencas(id) on delete cascade,
  tipo text not null check (tipo in ('instancia_recusada', 'acesso')),
  uf text check (uf is null or uf in ('AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO')),
  dispositivo text check (dispositivo is null or dispositivo ~ '^[0-9a-f]{8}$'),
  criado_em timestamptz not null default now()
);
create index radar_eventos_criado_idx on radar_eventos (criado_em);
create index radar_eventos_licenca_idx on radar_eventos (licenca_id, criado_em);
alter table radar_eventos enable row level security;
revoke all on radar_eventos from public, anon, authenticated;
grant select, insert, delete on radar_eventos to service_role;

create table radar_baixas (
  sinal_id text primary key check (char_length(sinal_id) between 3 and 160),
  resolvida_por text not null,
  resolvida_em timestamptz not null
);
alter table radar_baixas enable row level security;
revoke all on radar_baixas from public, anon, authenticated;
grant select, insert, update on radar_baixas to service_role;
