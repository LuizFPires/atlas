-- M31 (Luiz, 26/11/2026): idioma da licença, decidido na compra (página em inglês = compra em dólar) e fixo depois.
alter table licencas add column if not exists idioma text not null default 'pt' check (idioma in ('pt', 'en'));
