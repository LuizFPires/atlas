---
name: canteiro
description: Abre o painel visual do canteiro de obras, que mostra os agentes trabalhando, o prédio subindo e o avanço de 0 a 100%. Use quando o usuário disser /canteiro, "abre o canteiro", "abre o painel", "quero ver a obra".
---

O painel é um programa separado que só lê arquivos. Ele não usa tokens.

1. Rode em segundo plano: `node .claude/canteiro/server.cjs` (porta 4747; outra porta: `node .claude/canteiro/server.cjs 4800`).
2. Diga ao usuário em uma linha: "Canteiro no ar em http://localhost:4747". Se houver navegador disponível, abra o endereço.
3. Para ver como fica sem projeto real: http://localhost:4747/?demo
4. O painel abre em 3D. Se o computador não tiver aceleração gráfica, ele cai sozinho para o 2D; há um botão 3D/2D no canto.

**Várias obras ao mesmo tempo**: existe um só painel para todos os projetos do computador. Se a porta 4747 já estiver em uso por outro canteiro, o comando só avisa e registra este projeto na carteira: não é preciso outro painel. Diga ao usuário: "O canteiro já está no ar em http://localhost:4747; esta obra aparece na carteira."

Não leia `.canteiro/eventos.jsonl` na conversa: é o registro do painel e só gastaria contexto.
