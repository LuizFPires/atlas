---
name: documentar
description: Etapas 4 e 5 da linha de produção. Chama o subagente escritor para gerar PRD, SPEC, PLAN e CLAUDE a partir do protótipo aprovado e, em seguida, o subagente revisor para limpar e conferir. Use depois do protótipo aprovado ou quando o usuário pedir para gerar os arquivos Markdown.
---

# Documentar

Em palavras simples: o protótipo aprovado vira os papéis da obra. Você só coordena. Quem escreve e quem revisa são subagentes diferentes, para um conferir o trabalho do outro.

1. Confira que `docs/aprovacoes.md` registra o protótipo aprovado. Se não, pare e volte para a skill `prototipo`.
2. `node .claude/hooks/etapa.cjs documentacao`
3. Chame o subagente **escritor** com o prompt:
   "Gere PRD.md, SPEC.md, PLAN.md e CLAUDE.md a partir de prototipo/ (aprovado em <data de docs/aprovacoes.md>), docs/briefing.md e docs/design-system.md."
4. `node .claude/hooks/etapa.cjs revisao`
5. Chame o subagente **revisor** com o prompt:
   "Revise PRD.md, SPEC.md, PLAN.md e CLAUDE.md conforme o seu checklist."
6. Rode `node .claude/hooks/progresso.cjs` para conferir que o PLAN.md está no formato que o painel lê (deve mostrar os milestones e 0%).
7. Mostre ao usuário, em até 8 linhas: número de milestones e tarefas, tamanho do CLAUDE.md, principais correções do revisor e decisões pendentes.
8. Peça aprovação (portão ✋). Com o "ok", registre em `docs/aprovacoes.md` e sugira `/clear` seguido da skill `construir`.

Não leia os quatro arquivos inteiros você mesmo. Confie nos resumos dos subagentes; abra só o que o usuário pedir para ver.
