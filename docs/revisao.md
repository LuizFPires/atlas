# Revisão da linha de produção — Atlas (2026-11-18)

Uma linha por mudança.

## Duplicidade (item 1)
- SPEC S21: removida a cópia integral de docs/design-system.md (tabela de cores, tipografia, componentes, tom de voz); substituída por referência à fonte única + o que é específico do produto (componentes compartilhados web/app, temas, imagem-assinatura).
- CLAUDE.md: seção "Decisões pendentes" deixou de listar as 4 decisões (já estão em PRD §8); virou referência curta a PRD §8.

## CLAUDE.md compacto (item 2)
- CLAUDE.md passou de 40 para 37 linhas (limite 60) após cortar a lista de decisões duplicada.

## Cobertura do protótipo (item 3)
- Conferido: todas as telas de produto têm milestone. Nenhuma faltando, nenhum milestone criado.
- Main/OpcaoA/OpcaoB/OpcaoC são "direções visuais" (identidade), não telas de produto — sem milestone, correto.
- 4 telas secundárias compartilham milestone com a tela irmã via tarefa (F00bCadastro→M4, F06NovaObra→M13, F11Ocorrencia→M20, F13bPublicando→M22); mantidas juntas porque separar geraria milestones com menos de 3 tarefas (item 5).

## Formato do PLAN (item 4)
- Conferido: todos os 26 milestones têm `## Milestone N — título`, `peso:`, `spec:`, `tela:`, tarefas `- [ ]` e `Notas:`. Sem correção.

## Tamanho dos milestones (item 5)
- Conferido: todos entre 3 e 8 tarefas. Sem divisão nem fusão.

## Tarefas verificáveis (item 6)
- Conferido: tarefas concretas e verificáveis. Sem reescrita.

## Coerência (item 7)
- Conferido: PRD → SPEC → PLAN consistentes. Milestones sem `tela:` (M2, M3, M8, M26) são backend/infra/kit, corretamente sem tela de protótipo.

## Fonte da verdade (item 8)
- Confirmado: regra presente em CLAUDE.md ("## Fonte da verdade"). Sem correção.
