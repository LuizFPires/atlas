-- Atlas · M58: a Ajuda do Atlas aceita a foto tirada no celular. O celular sobe a foto (referência, como já fazia) e deixa o pedido
-- 'foto_ajuda' com o id dela; o notebook baixa a foto e a mostra na Ajuda. Só muda a lista de tipos aceitos.
alter table celular_pedidos drop constraint if exists celular_pedidos_tipo_check;
alter table celular_pedidos add constraint celular_pedidos_tipo_check
  check (tipo in ('obra_nova','ajuste','aprovar_telas','nome','construir','pausar','continuar','foto_ajuda'));
