-- Atlas · painel admin: "Cancelamentos no mês". Até aqui a licença só guardava o status 'cancelada', sem dizer QUANDO foi pedido o cancelamento.
-- cancelada_em = o momento em que o cancelamento foi pedido/ocorreu (arrependimento, cancelar mensalidade — mesmo que a licença siga até o fim do período —
-- ou assinatura encerrada pelo gateway). Nulo = nunca cancelou ou cancelamento anterior a esta migration (não dá para saber a data: não entra na conta).
alter table licencas add column cancelada_em timestamptz;
create index licencas_cancelada_em_idx on licencas (cancelada_em) where cancelada_em is not null;
