-- Atlas M4 — cadastro pós-pagamento (F00b): as 4 respostas ficam em clientes (nome_tratamento, empresa, ramo).
-- cadastro_em marca que o cadastro já foi feito: o POST /cadastro só vale uma vez por cliente
-- (quem souber o e-mail da compra não consegue trocar o destino do acesso depois).
alter table clientes add column cadastro_em timestamptz;
