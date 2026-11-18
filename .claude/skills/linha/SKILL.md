---
name: linha
description: Linha de produção completa de um app, do briefing à construção, com aprovação do usuário entre as etapas. Use quando o usuário disser "novo app", "vamos construir um sistema", "começar um projeto", "/linha", ou quiser saber em que etapa o projeto está.
---

# Linha de produção

Em palavras simples: é o caminho da ideia até o app no ar, em etapas. Cada uma termina num arquivo e só avança com o "ok" do usuário (✋), como o dono vistoriando cada fase da obra.

| # | Etapa | Quem executa | Entrega | Portão |
|---|---|---|---|---|
| 1 | Briefing | Você, conversando (skill `briefing`) | `docs/briefing.md` | ✋ |
| 2 | Design | Subagente `designer` | `docs/design-system.md` | ✋ |
| 3 | Protótipo | Você, conversando (skill `prototipo`) | `prototipo/` | ✋ fonte da verdade |
| 4 | Documentação | Subagente `escritor` | PRD, SPEC, PLAN, CLAUDE | — |
| 5 | Revisão | Subagente `revisor` | documentos limpos + `docs/revisao.md` | ✋ |
| 6 | Construção | Coordenador + `implementador` por milestone (skill `construir`) | código | ✋ a cada checkpoint |
| 7 | Vistoria | Subagente `qa`, dentro da etapa 6 | aprovação de cada milestone | — |
| 8 | Entrega (habite-se) | Skill `entregar`: `vistoriador`, `implantador`, `corretor` | produção no ar e app no TestFlight/teste interno | ✋ decisões e cliques do usuário |

Regra geral: **etapa que conversa com o usuário roda aqui na sessão principal; etapa que trabalha sozinha a partir de arquivos roda em subagente.**

## Ao iniciar
1. Descubra a etapa atual pelo que existe no projeto, **nesta ordem**:
   - existe `PLAN.md` (ou `docs/PLAN.md`) com milestones → é um sistema em andamento: etapa 6 (construção). Se ele ainda não foi adotado (não existe `docs/aprovacoes.md` com "adoção"), use antes a skill `adotar`
   - existe protótipo (`prototipo/` ou outra pasta/arquivo HTML que o usuário indicar) mas não existe `docs/briefing.md` → **começar pelo protótipo** (seção abaixo)
   - sem `docs/briefing.md` → etapa 1
   - sem `docs/design-system.md` → etapa 2
   - sem `prototipo/` aprovado (ver `docs/aprovacoes.md`) → etapa 3
   - sem `PLAN.md` → etapas 4 e 5
   - com `PLAN.md` e tarefas `- [ ]` pendentes → etapa 6
   - `PLAN.md` com todas as tarefas `- [x]` e `docs/entrega.md` sem registro de produção → etapa 8 (skill `entregar`)
2. Diga ao usuário em uma linha em que etapa o projeto está e o que vem agora.
3. Atualize o painel: `node .claude/hooks/etapa.cjs <etapa>` (briefing, design, prototipo, documentacao, revisao, construcao, lancamento, entregue).

## Começar pelo protótipo (o usuário já tem só o protótipo)
O protótipo pronto vale como etapa 3 já feita. Monte para trás o que a documentação precisa, sem refazer nada:
1. **Organizar**: se o protótipo não estiver em `prototipo/`, copie-o para lá (não apague o original). Crie `prototipo/TELAS.md` listando cada tela com o arquivo e a âncora (`prototipo/index.html#tela-x`). Se as telas não tiverem âncora, acrescente `id` nas seções sem mudar mais nada.
2. **Briefing a partir do protótipo** (etapa 1, curta): leia o protótipo e preencha `docs/briefing.md` com o que ele já mostra (telas, ações, dados). Pergunte ao usuário **só o que o protótipo não responde**: para quem é, plataforma (web, celular, ambos), integrações, o que fica fora da v1 e critério de sucesso. No máximo 5 perguntas. ✋
3. **Design system extraído** (etapa 2): chame o `designer` com: "Extraia de prototipo/ o design system já usado (cores, fontes, espaçamentos, componentes) e registre em docs/design-system.md com Origem: extraído do protótipo. Não invente nada que o protótipo não use." ✋
4. **Aprovar o protótipo como fonte da verdade**: pergunte "O protótipo está aprovado do jeito que está, ou quer ajustar algo antes (skill `prototipo`)?". Com o ok, registre em `docs/aprovacoes.md`: `- AAAA-MM-DD — protótipo aprovado (fonte da verdade, trazido pelo usuário)`.
5. Siga para a skill `documentar`.

## Portões
Ao terminar uma etapa com ✋: mostre o resultado em até 5 linhas e pergunte se está aprovado. Com o "ok", registre em `docs/aprovacoes.md`:
`- AAAA-MM-DD — <etapa> aprovada`
Sem "ok", ajuste e pergunte de novo. Não avance.

## Etapa 2 — chamar o designer
Chame o subagente `designer` com o prompt: "Leia docs/briefing.md e produza docs/design-system.md." Se o usuário mencionou um design system existente, inclua o nome ou caminho no prompt.

## Etapas 4 e 5 — documentar
Use a skill `documentar`.

## Economia de contexto
- Ao fim de cada etapa aprovada, sugira ao usuário um `/clear` antes da próxima: todo o estado já está nos arquivos, e a skill `linha` sabe retomar.
- Não releia arquivos que um subagente já resumiu para você.
