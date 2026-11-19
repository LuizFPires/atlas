# Degustação (teste grátis de 5 dias)

Como funciona: a pessoa pede pela página de vendas, confirma o e-mail pelo link e ganha uma licença de teste
(`tipo='cortesia'`, `validade_em = agora + dias`, `plano_valor 0`, sem gateway). Passou o prazo, o `/verificar` barra
(`cortesia_expirada`). O gestor liga e desliga no painel (aba Visão geral, "Teste grátis"); nasce DESLIGADA.

Rotas públicas (POST): `/degustacao/estado`, `/degustacao/pedir`, `/degustacao/confirmar`. Rota admin: `/admin/degustacao`.
Banco: migration `0016_degustacao.sql` (`config_degustacao`, `degustacoes`, `dominios_bloqueados`, RPCs `pedir_degustacao` e `criar_degustacao`,
esta com o mesmo lock `'cliente:'||lower(trim(email))` de `criar_compra` e `criar_cortesia`).

## Freios (anti-abuso)
- Sem clicar no link do e-mail, nenhuma licença nasce (token de uso único, só o hash no banco, vale 48 h).
- 1 degustação por e-mail normalizado (gmail/googlemail: sem pontos e sem `+tag`).
- Domínios descartáveis recusados: lista base em `supabase/functions/_shared/dominios-descartaveis.ts` + tabela `dominios_bloqueados` (editável sem deploy; o bloco C alimenta).
- Limite por IP no pedido (5/h), por e-mail (3/h) e na confirmação (20 a cada 15 min).
- 1 computador por licença: o teste usa o mesmo caminho de ativação (`ativacoes`, índice único de 1 ativo).

## Limites honestos
- Quem tem e-mails novos de provedores diferentes (não descartáveis) e uma máquina nova ainda consegue outro teste. O freio é custo, não impossibilidade.
- O custo é limitado: o processamento é o login Claude do próprio usuário; o Atlas não paga por token do teste.
- Domínios próprios (alguém com domínio e catch-all) passam; só o bloco C/lista editável reduz isso.
- IP atrás de CGNAT/rede compartilhada pode esbarrar no limite por IP (mensagem pede para esperar).
- O IP fica em `degustacoes.ip` só para abuso. Migration 0017: a rota de serviço `POST /degustacao/limpar-ips` (cron diário do deploy, com o segredo de serviço) zera o ip com mais de 30 dias; `excluir_conta` zera e-mail e ip, invalida o token e mantém só o hash sha256 do e-mail normalizado (quem apaga a conta não ganha outro teste; hash sem segredo é adivinhável por quem já sabe o e-mail, limite aceito).

- Re-pedir gira o token (o link anterior morre). Limitado pelo rate limit de 3/h por e-mail; é o comportamento normal de reenvio. Aceito.
- 409 ja_tem_conta/ja_usou_degustacao revela que o e-mail existe. Limitado por IP e por e-mail, risco baixo num teste de consumidor; resposta genérica pioraria a UX. Aceito.
- O dedup usa HMAC-SHA256 com ATLAS_SEGREDO (`degustacao:`+e-mail normalizado). Trocar o segredo zera o anti-repetição das linhas antigas.
- A conta existente é buscada pelo e-mail digitado e pelo normalizado; uma conta antiga guardada com outra variante de gmail (pontos/+tag) que não bata com nenhum dos dois não é achada.

## Pendente de deploy
- Agendar o cron de `/degustacao/limpar-ips`.
- Aplicar as migrations 0016 e 0017; definir `ATLAS_DEGUSTACAO_URL` (padrão `https://atlas-ia.app.br/degustacao`), `RESEND_API_KEY` e `ATLAS_EMAIL_FROM` reais (hoje só testado com enviador de fixture).
- Confirmar a URL real da página de instalação (a página do link leva a `/instalar?t=<token>`; hoje a rota `/instalar` não existe no site, só o padrão de `ATLAS_INSTALAR_URL`).
- Liberar o CORS: a origem do site já é a de `ATLAS_WEB_ORIGEM`.
