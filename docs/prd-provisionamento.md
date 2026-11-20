# Provisionamento da prateleira — plano (meio-termo)

> M32, fatia (e). Decisão do Luiz (20/11): **meio-termo** — o Atlas automatiza o provisionamento, mas em cima da **conta de nuvem do próprio cliente**. O custo e a responsabilidade legal (uptime, LGPD) de cada app ficam com o cliente; o Atlas só cria e entrega, com a venda fácil e automática.

## 1. Em uma frase
Quando o cliente compra um app da prateleira, ele conecta as contas dele uma vez, e o Atlas monta o app sozinho: cria o código, o banco, a hospedagem e entrega o endereço pronto — tudo na conta do cliente.

## 2. O que o cliente conecta na compra (recomendação)
Uma vez, por OAuth/one-click, guiado em português simples:
- **GitHub** — onde o código do app vira obra DELE (invariante do Atlas: o código é do cliente). É o que permite "modificar depois pelo Atlas".
- **Supabase** — o banco de dados dele (clientes, vendas, agenda ficam na conta dele).
- **Vercel** — a hospedagem dele (o app no ar, instalável no celular).

> Atrito honesto: são 3 conexões. Pro leigo, o Atlas guia cada uma com "mão de dada". Dá pra reduzir no futuro (ex.: Atlas cria as contas pelo cliente), mas começa assim — é o que mantém "é tudo seu".

## 3. Fluxo do provisionamento
1. Compra (já existe) → configurador (nome/logo/cores, já existe).
2. **Conectar contas**: o cliente autoriza GitHub + Supabase + Vercel (OAuth).
3. **Atlas provisiona**, automático:
   a. cria um repositório no GitHub do cliente a partir do app-modelo (com marca d'água + aviso de licença);
   b. cria/usa um projeto Supabase do cliente e aplica as migrations do app (o schema do segmento);
   c. faz o deploy no Vercel do cliente, num endereço dele;
   d. injeta a personalização (nome, cores) e amarra o **guardião** à licença daquela compra (cofre/token no app entregue);
4. **Entrega**: a tela de entrega mostra o link real do app do cliente (substitui o estado "preparando").

## 4. Segredos e segurança (invariantes)
- Os tokens/credenciais do cliente **nunca** ficam em arquivo nem em log; passam por mecanismo seguro (supabase secrets / tokens de curta duração), com o **mínimo de escopo** necessário.
- O pagamento e a assinatura são sempre do cliente, no gateway dele (invariante) — o Atlas não intermedia dinheiro.
- Single-tenant: cada app é de uma empresa só; o guardião (já pronto) bloqueia uso compartilhado.

## 5. Construção em fatias
- **(e1) Orquestração + portas** — a lógica "dado uma compra, provisiona" com portas (interfaces) e simulação (fixture). Testável, **não precisa das suas contas** nem de credencial. Começa já.
- **(e2) Conectar contas (OAuth)** — o fluxo do cliente autorizar GitHub/Supabase/Vercel. **Precisa de você**: registrar os apps OAuth em cada provedor (eu passo o passo a passo).
- **(e3) Adaptadores reais** — um por provedor: GitHub cria repo; Supabase cria projeto + migra; Vercel deploya. Precisa dos apps OAuth da (e2).
- **(e4) Ligar de verdade** — personalização, guardião/licença e a entrega real (link do app) no lugar do fixture.

## 6. O que preciso de você
1. Confirmar as contas conectadas: **GitHub + Supabase + Vercel** (ou ajustar).
2. Depois da (e1): registrar os **apps OAuth** nesses provedores — eu te guio, clique a clique.
3. Decisões em aberto: o que acontece se o cliente **desconecta** ou **para de pagar** (o app para? fica só leitura?); e se o Atlas pode **criar as contas pelo cliente** no futuro pra reduzir atrito.

## 7. Próximo passo
Com o seu ok, começo pela **(e1)**: a orquestração com portas e simulação — construída e testada sem tocar em nenhuma conta sua ou do cliente.
