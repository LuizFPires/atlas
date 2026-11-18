---
name: adotar
description: Coloca um sistema que já está em desenvolvimento na linha de produção, sem refazer nada. Faz o inventário, junta os hooks ao settings.json existente, adapta o PLAN.md ao formato do painel preservando o conteúdo e o que já foi feito, confere o GitHub e deixa o projeto pronto para /construir. Use quando o usuário disser /adotar, "usar a linha de produção neste projeto", "começar a usar o canteiro num sistema que já existe".
---

# Adotar um sistema em andamento

É como assumir uma obra que já está na metade: você não demole nada. Faz a vistoria, organiza o cronograma no seu padrão e segue a obra a partir de onde ela está.

**Regra de ouro: nada do que existe é apagado ou reescrito sem o usuário ver antes.** Toda mudança em arquivo do projeto vai num commit próprio, que pode ser desfeito.

## 1. Vistoria (só leitura)
Rode `node .claude/hooks/etapa.cjs construcao` e levante, sem abrir arquivos grandes por inteiro:
- `git status --short` e `git branch --show-current`. **Se houver alterações sem commit, pare** e pergunte ao usuário o que fazer com elas antes de mexer em qualquer coisa.
- Onde estão os documentos: `PLAN.md` ou `docs/PLAN.md`, `CLAUDE.md`, `AGENTS.md`, PRD, SPEC, CHANGELOG, protótipo (`prototipo/` ou similar).
- O estado do roteiro antigo: `.codex/roteiro.json` ou `.claude/roteiro.json`. **Ele continua valendo**, porque a `/construir` lê os mesmos arquivos.
- O formato do PLAN: `node .claude/hooks/progresso.cjs`. Se listar os milestones com o avanço certo, o formato já serve.
- Tamanho do CLAUDE.md: `wc -l CLAUDE.md` (ou `(Get-Content CLAUDE.md).Count` no Windows).

Mostre ao usuário um retrato de até 8 linhas: documentos encontrados, milestones e avanço, roteiro salvo (milestone, etapa, PR), protótipo sim ou não, tamanho do CLAUDE.md e o que precisa ser ajustado.

## 2. Hooks do painel
Se `.claude/settings.json` não tiver os hooks que chamam `evento.cjs`, **junte** o bloco `hooks` do kit ao arquivo existente, sem apagar nada do que já está lá. Se o arquivo não existir, use o do kit.
Avise: "Feche e abra o Claude Code depois da adoção para o painel começar a ver os agentes."

## 3. Cronograma no formato do painel (com aprovação)
Só se o `progresso.cjs` não reconheceu o PLAN, ou se faltarem as caixinhas das tarefas.
1. Mostre ao usuário um exemplo de **um** milestone antes e depois da conversão e pergunte se pode aplicar a todos.
2. A conversão **só mexe na forma**:
   - títulos viram `## M<n> — <título>` (o painel também aceita `## Milestone <n> — <título>`);
   - tarefas viram `- [ ]` / `- [x]`;
   - nenhum texto, critério de aceite ou decisão é removido ou reescrito.
3. **O que já foi feito vira `- [x]`**, mas só com evidência: milestone com PR mergeado (`gh pr list --state merged --search "M<n>"`), marcado como concluído no próprio PLAN ou no CHANGELOG, ou anterior ao milestone do `roteiro.json`. Na dúvida, deixe `- [ ]` e liste para o usuário confirmar.
4. Os campos `peso:`, `spec:` e `tela:` são opcionais. Acrescente `tela:` só quando a ligação com o protótipo for óbvia.
5. Commit: `docs: PLAN no formato da linha de produção`. Rode `node .claude/hooks/progresso.cjs` e mostre o avanço: é onde o prédio vai começar no painel.

## 4. Protótipo
- **Existe** → acrescente no topo do PLAN `Fonte da verdade: <pasta do protótipo>` e, no CLAUDE.md, a regra do protótipo como fonte da verdade, se ainda não houver. O `qa` passa a comparar as telas com ele.
- **Não existe** → siga sem. O `qa` compara com a SPEC e os critérios de aceite. Não proponha criar protótipo para um sistema já na metade, a não ser que o usuário peça.

## 5. CLAUDE.md enxuto (opcional, recomendado se passar de 60 linhas)
Ofereça: "Compactar o CLAUDE.md com o revisor (Recomendado: ele é lido em todo turno)". Com o sim, chame o subagente `revisor` com:
`Modo adoção: compacte só o CLAUDE.md para no máximo 60 linhas. Mova o que não for regra de todo turno para a SPEC ou para docs/, sem perder nenhuma informação. Não mexa no PLAN.`
Mostre o resumo dele e faça commit `docs: CLAUDE.md compacto`.

## 6. GitHub
Chame o subagente `despachante` com `verificar`. Em sistema já em andamento, o normal é vir `STATUS: pronto`. Se não vier, siga o que ele pedir.

## 7. Encerrar
1. Registre em `docs/aprovacoes.md`: `- AAAA-MM-DD — adoção na linha de produção (sistema em andamento, M<n>)`.
2. Commit dos arquivos novos de `docs/`.
3. Diga ao usuário, em até 5 linhas: avanço atual, próximo milestone, o que mudou, e:
   "Pronto. Feche e abra o Claude Code nesta pasta, ligue o canteiro e digite /construir para seguir de onde parou."
