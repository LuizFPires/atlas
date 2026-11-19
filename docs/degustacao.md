# Degustação (teste grátis de 5 dias)

Como funciona: a pessoa pede pela página de vendas, confirma o e-mail pelo link e ganha uma licença de teste
(`tipo='cortesia'`, `validade_em = agora + dias`, `plano_valor 0`, sem gateway). Passou o prazo, o `/verificar` barra
(`cortesia_expirada`). O gestor liga e desliga no painel (aba Visão geral, "Teste grátis"); nasce DESLIGADA.

Rotas públicas (POST): `/degustacao/estado`, `/degustacao/pedir`, `/degustacao/confirmar`. Rota admin: `/admin/degustacao`.
Banco: migration `0016_degustacao.sql` (`config_degustacao`, `degustacoes`, `dominios_bloqueados`, RPCs `pedir_degustacao` e `criar_degustacao`,
esta com o mesmo lock `'cliente:'||lower(trim(email))` de `criar_compra` e `criar_cortesia`).
Correções em `0017_degustacao_corrige_revisao.sql`, `0018_degustacao_um_por_computador.sql` (cria `licencas.origem`) e `0019_degustacao_ledger_dispositivo.sql` (ledger de dispositivo, conversão zera origem, trava na troca de PC).
Locks: o pedido e a confirmação pegam `'degustacao:'||email_hash` e depois `'cliente:'||email`; `excluir_conta` pega `'conta:'||id`, depois os `'degustacao:'||hash` das degustações do cliente (em ordem de hash). Ninguém pega `conta:` depois de `degustacao:`/`cliente:`, então não há ciclo.

## Freios (anti-abuso)
- Sem clicar no link do e-mail, nenhuma licença nasce (token de uso único, só o hash no banco, vale 48 h).
- 1 degustação por e-mail normalizado: ponto final do domínio sai (`a@gmail.com.` = `a@gmail.com`), `+tag` sai em TODOS os domínios, pontos do local só no gmail/googlemail.
- Domínios descartáveis recusados: lista base em `supabase/functions/_shared/dominios-descartaveis.ts` + tabela `dominios_bloqueados` (editável sem deploy; o bloco C alimenta).
- Limite por IP no pedido (5/h), por e-mail (3/h) e na confirmação (20 a cada 15 min).
- 1 computador por licença: o teste usa o mesmo caminho de ativação (`ativacoes`, índice único de 1 ativo).
- 1 degustação por computador (0018 + 0019): a licença do teste nasce com `origem='degustacao'`. A trava vale SÓ para `tipo='cortesia' E origem='degustacao'` (compra e cortesia manual nunca entram, mesmo com origem suja). Ela roda na ativação (`confirmarAtivacao`) e na troca de computador pelo portal (`trocarComputador` e, em defesa em profundidade, a RPC `trocar_computador`), sempre ANTES de gastar o código; responde 409 `ja_testou_neste_computador`.
- Ledger de dispositivo (0019, `degustacoes_dispositivos`): guarda só `dispositivo_hmac` (HMAC-SHA256 do `computador_hash` com `ATLAS_SEGREDO`, domínio `dispositivo:`, calculado na borda), `licenca_id` (sem FK; só deixa o MESMO teste voltar ao seu computador) e a data. A checagem olha o ledger, não `ativacoes`. `excluir_conta` NÃO apaga o ledger: é marcador pseudônimo, sem e-mail, nome ou hash cru, mantido por prevenção a fraude (legítimo interesse, LGPD art. 7º IX e 10); quem apaga a conta continua barrado no mesmo computador. RLS ligada, acesso só por service_role (RPCs `security definer`).
- Conversão teste -> compra: `criar_compra` (SQL e `memoria.criarCompra`) zera `origem` ao virar `tipo='paga'`; a compra nunca é barrada pela trava.
- Limites: ativações simultâneas de dois testes no mesmo computador são desempatadas pelo `unique` do ledger (o segundo recebe 409); em base com dados antigos não há backfill do ledger (hoje a base é vazia).
- Backfill da 0018 (limitação): marcou `origem='degustacao'` em cortesias cujo e-mail tem degustação confirmada. Não há ligação licença-degustação além do e-mail, mas na prática é seguro: `criar_degustacao` recusa quem já tem licença (`ja_tem_licenca`), então uma degustação confirmada só existe para o e-mail cuja licença nasceu dela. Cortesia manual que depois pediu degustação não é marcada.

## Limites honestos
- Quem tem e-mails novos de provedores diferentes (não descartáveis) e uma máquina nova ainda consegue outro teste. O freio é custo, não impossibilidade.
- O custo é limitado: o processamento é o login Claude do próprio usuário; o Atlas não paga por token do teste.
- Domínios próprios (alguém com domínio e catch-all) passam; só o bloco C/lista editável reduz isso.
- IP atrás de CGNAT/rede compartilhada pode esbarrar no limite por IP (mensagem pede para esperar).
- O IP fica em `degustacoes.ip` só para abuso. Migration 0017: a rota de serviço `POST /degustacao/limpar-ips` (cron diário do deploy, com o segredo de serviço) zera o ip com mais de 30 dias; `excluir_conta` zera e-mail e ip, invalida o token e mantém só o hash HMAC-SHA256 do e-mail normalizado (quem apaga a conta não ganha outro teste; o HMAC com o segredo do servidor impede confirmar um e-mail só olhando a tabela).

- Se `gerarLink` falhar depois de criar a licença (na confirmação), o token do e-mail já foi consumido; a pessoa ainda entra pelo fluxo normal de ativação por código (peça o link/código). Aceito.
- Re-pedir gira o token (o link anterior morre). Limitado pelo rate limit de 3/h por e-mail; é o comportamento normal de reenvio. Aceito.
- 409 ja_tem_conta/ja_usou_degustacao revela que o e-mail existe. Limitado por IP e por e-mail, risco baixo num teste de consumidor; resposta genérica pioraria a UX. Aceito.
- O dedup usa HMAC-SHA256 com ATLAS_SEGREDO (`degustacao:`+e-mail normalizado). Trocar o segredo zera o anti-repetição das linhas antigas.
- A conta existente é buscada pelo e-mail digitado e pelo normalizado; uma conta antiga guardada com outra variante de gmail (pontos/+tag) que não bata com nenhum dos dois não é achada.

## Pendente de deploy
- Agendar o cron de `/degustacao/limpar-ips`.
- Aplicar as migrations 0016, 0017 e 0018; definir `ATLAS_DEGUSTACAO_URL` (padrão `https://atlas-ia.app.br/degustacao`), `RESEND_API_KEY` e `ATLAS_EMAIL_FROM` reais (hoje só testado com enviador de fixture).
- Confirmar a URL real da página de instalação (a página do link leva a `/instalar?t=<token>`; hoje a rota `/instalar` não existe no site, só o padrão de `ATLAS_INSTALAR_URL`).
- Liberar o CORS: a origem do site já é a de `ATLAS_WEB_ORIGEM`.
