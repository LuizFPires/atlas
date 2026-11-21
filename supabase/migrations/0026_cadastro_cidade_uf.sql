-- Atlas · mapa de clientes por cidade (painel admin). O cadastro pós-pagamento passa a guardar a cidade e a UF que o PRÓPRIO cliente informou.
-- Nunca guarda IP. Colunas nuláveis: cadastros antigos (sem cidade/UF) continuam valendo e contam só como "sem estado".
-- LGPD: ao excluir a conta (clientes.excluido_em preenchido) cidade e UF são apagadas por gatilho, sem mexer na função excluir_conta.
alter table clientes
  add column cidade text check (cidade is null or char_length(btrim(cidade)) between 2 and 80),
  add column uf text check (uf is null or uf in ('AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'));

create function clientes_limpa_local_ao_excluir() returns trigger language plpgsql as $$
begin
  if new.excluido_em is not null and old.excluido_em is null then
    new.cidade := null;
    new.uf := null;
  end if;
  return new;
end $$;

create trigger clientes_limpa_local before update on clientes
  for each row execute function clientes_limpa_local_ao_excluir();
