-- Atlas M3 — correções da revisão de segurança do pagamento.
-- (1) Pagamento passa a ser chaveado por (conta do cliente, referência do gateway): referências de contas
--     diferentes nunca se cruzam (estorno/fatura de uma conta não toca a outra).
-- (2) URL de retorno do Checkout vem do servidor (base por conta), nunca da requisição (open redirect).

alter table pagamentos add column conta_gateway_id uuid references contas_gateway(id);
update pagamentos p set conta_gateway_id = l.conta_gateway_id from licencas l where l.id = p.licenca_id;
alter table pagamentos drop constraint if exists pagamentos_gateway_ref_key;
alter table pagamentos add constraint pagamentos_conta_ref_key unique (conta_gateway_id, gateway_ref);
create index on pagamentos (conta_gateway_id, gateway_pi);

-- Origem https do site do cliente (sem caminho, query ou fragmento). Nula = Checkout recusado.
alter table contas_gateway
  add column base_retorno text check (base_retorno is null or base_retorno ~ '^https://[^/?#@\s]+$');
