-- Atlas M2 · o portal (authenticated) nunca lê token_hash.
-- A política cliente_le_ativacoes continua valendo (linhas); aqui restringimos as COLUNAS.
-- Colunas novas em ativacoes ficam fora do portal até serem liberadas explicitamente.
revoke select on ativacoes from authenticated, anon;
grant select (id, licenca_id, computador_hash, ativo, ativado_em, desativado_em) on ativacoes to authenticated;
