---
name: stop-recomendado
description: Desliga o modo automático da construção. Use quando o usuário disser /stop-recomendado, "para o automático", "volta para o manual".
---

Em palavras simples: é o botão de voltar ao manual, em que a obra pergunta antes de cada passo.

Grave `"ativo": false` em `~/.claude/recomendado.json` (mantenha os outros campos) e diga em uma linha:
"⏸ Automático desligado. A construção vai perguntar no próximo ponto de decisão."
