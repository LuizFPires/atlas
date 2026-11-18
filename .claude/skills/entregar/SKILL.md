---
name: entregar
description: Etapa 8 da linha de produção, a entrega (habite-se e entrega das chaves). Leva o sistema pronto até produção e até as lojas — vistoria final, deploy de produção (Supabase, Vercel, Fly.io) e envio do app Expo ao TestFlight e ao teste interno do Google Play — parando só nos cliques que são do usuário. Use quando o usuário disser /entregar, "coloca em produção", "lança o app", "sobe para a loja", "manda para o TestFlight", ou quando a /construir terminar todos os milestones.
---

# Entregar — habite-se e entrega das chaves

A obra está pronta. Agora vêm a vistoria da prefeitura, a ligação definitiva de água e luz, e o anúncio do imóvel. Você é o mestre de obras: coordena três subagentes e para nos pontos em que só o dono assina.

| Passo | Quem | Na obra |
|---|---|---|
| 1. Reconhecer a stack | Você | Ler o projeto aprovado |
| 2. Vistoria final | `vistoriador` | Habite-se |
| 3. Produção web | `implantador` | Ligação de água, luz e esgoto |
| 4. Lojas (se houver app) | `corretor` | Anúncio e papelada do imóvel |
| 5. Entrega | Você | Entrega das chaves |

## 0. Antes de começar
- `node .claude/hooks/etapa.cjs lancamento`
- `node .claude/hooks/progresso.cjs --curto`. Se houver milestones pendentes, pergunte: "Ainda faltam N milestones. Entregar mesmo assim (ex.: uma versão de teste) ou terminar antes? (Recomendado: terminar antes)".
- `node .claude/hooks/ocorrencias.cjs listar`: ocorrência aberta de Vercel, Supabase, Fly, Expo ou lojas trava a entrega; diga qual.
- `git status` limpo e na branch base atualizada. A entrega trabalha numa branch `release/<versão>` e abre PR, como qualquer milestone.

## 1. Reconhecer a stack (só leitura, barato)
Procure, sem abrir código:
| Sinal | Significa |
|---|---|
| `next.config.*` | Front Next.js |
| `vite.config.*` + `vite-plugin-pwa` | Front Vite/React, PWA |
| `vercel.json` ou `.vercel/` | Front na Vercel |
| `supabase/migrations`, `supabase/functions` | Banco e funções no Supabase |
| `fly.toml` + `Dockerfile` | Worker ou API no Fly.io |
| `apps/*/app.json` com `expo` e `eas.json` | App mobile Expo → lojas |
| `pnpm-workspace.yaml`, `turbo.json` | Monorepo (rode comandos no pacote certo) |
| `.github/workflows` | CI existente; veja se ele já faz deploy |

Mostre ao usuário em até 6 linhas: o que vai para produção, onde, e se há app para as lojas.

## 2. Decisões que só o usuário toma (pergunte de uma vez, com AskUserQuestion)
Pergunte só o que não estiver registrado em `docs/entrega.md` ou na SPEC:
- **Ambiente**: subir direto em produção ou primeiro em homologação? (Recomendado: homologação primeiro, quando já houver usuários reais.)
- **Projeto Supabase de produção**: qual (nome ou ref)? Nunca adivinhe.
- **Domínio**: qual endereço o sistema vai usar? (A configuração de DNS no registro do domínio é do usuário; o implantador diz exatamente o que cadastrar.)
- **Lojas** (se houver app): nome na loja, plataformas (iOS, Android, ambas), se as contas de desenvolvedor já existem.
Registre as respostas em `docs/entrega.md` (seção "Decisões") e faça commit.

## 3. Vistoria final
Chame o `vistoriador`: `Vistoria final. Alvo: <web|mobile|web+mobile>. Stack: <resumo do passo 1>.`
- **Reprovado** → para cada achado alto, chame um **novo** `implementador`: `Corrija para o lançamento: <achado com arquivo:linha>.` Depois, o `qa` revisa e o `vistoriador` faz nova vistoria. Duas reprovações seguidas → pare e pergunte.
- **Aprovado com ressalvas** → mostre as ressalvas e pergunte se seguem para depois do lançamento (registre em `docs/entrega.md`).

## 4. Produção web
Chame o `implantador`: `Implante em <ambiente>. Stack: <resumo>. Supabase: <ref>. Domínio: <domínio>. Variáveis do laudo: <nomes>.`
- `USUÁRIO` no relatório → mostre o passo exato e **pare até ele confirmar** (login, variável de ambiente, DNS). Depois chame o implantador de novo.
- `DECISÃO` (ex.: migration destrutiva) → pergunte. Mesmo no automático, nada destrutivo sem o usuário.
- `BLOQUEIO EXTERNO` → abra ocorrência (`ocorrencias.cjs abrir ... --acao "rodar o implantador em <ambiente> a partir do passo X"`) e siga com o que der (por exemplo, as lojas).
- Homologação aprovada pelo usuário → repita em produção.

## 5. Lojas (só se houver app mobile)
Chame o `corretor`: `Prepare e envie o app em <caminho> para <plataformas>. Nome na loja: <nome>.`
O resultado esperado é o app no **TestFlight** e no **teste interno do Google Play**. A publicação para o público é sempre do usuário.
Mostre a lista `USUÁRIO` do corretor como checklist numerado e grave em `docs/entrega.md` (seção "Lojas"). Os passos típicos dele:
1. Ter a conta Apple Developer (US$ 99/ano) e a Google Play Console (US$ 25, uma vez).
2. Fazer o primeiro build iOS interativo: `! npx eas-cli build --platform ios --profile production` (login Apple com verificação em duas etapas).
3. Criar o app no App Store Connect e no Play Console.
4. No Google Play, subir manualmente o primeiro .aab (só da primeira vez).
5. Preencher privacidade, classificação etária e prints nas lojas usando os rascunhos de `store/`.
6. Testar pelo TestFlight e pelo teste interno no celular.
7. Apertar "Enviar para revisão" e, depois de aprovado, publicar.

## 6. Entrega das chaves
1. PR da branch `release/<versão>` com `docs/entrega.md`, `store/` e os ajustes, revisado pelo `qa`, com merge depois do CI verde (mesmo roteiro da `/construir`).
2. Tag de versão: `git tag v<versão> && git push origin v<versão>`.
3. `node .claude/hooks/etapa.cjs entregue` (no painel, o prédio ganha a bandeira).
4. Resumo final em até 8 linhas: URLs de produção, versão, status nas lojas, plano de volta, pendências do usuário e ressalvas para depois.

## Próximas versões
Para uma atualização, a mesma skill serve: vistoria (só do que mudou), implantação, e o corretor com `version` nova. Mudança só de JavaScript no app pode, no futuro, usar EAS Update; hoje os apps não têm `updates` configurado, então toda mudança passa por novo build.

## Travas
- Nunca publicar para o público nas lojas, nunca pagar nem mudar plano, nunca aplicar migration destrutiva, nunca expor segredo.
- Produção só depois da vistoria aprovada.
- Tudo o que muda arquivo do projeto passa por branch, PR, `qa` e CI verde.
