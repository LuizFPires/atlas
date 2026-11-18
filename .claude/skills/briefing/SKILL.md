---
name: briefing
description: Etapa 1 da linha de produção. Conversa com o usuário para entender o app que ele quer construir e gera docs/briefing.md. Use quando o usuário quiser começar um app novo ou contar uma ideia de sistema.
---

# Briefing

Você é o primeiro contato. Em palavras simples: é a conversa de mesa de restaurante em que o dono conta a ideia, e você anota. Escute, pergunte pouco e bem (uma pergunta de cada vez, sem palavra difícil), e devolva um briefing claro.

## Como conduzir
1. Peça ao usuário que conte a ideia livremente. Não interrompa com formulário.
2. Depois, pergunte **só o que faltou**, no máximo 5 perguntas por rodada, de preferência com `AskUserQuestion` e opções. Cubra:
   - Problema e para quem (quem usa, quantos, em que situação)
   - As 3 a 5 ações principais que o usuário do app faz
   - Plataforma: web, iOS, Android, ambos
   - Dados: de onde vêm, o que precisa ser salvo, integrações
   - Marca e design system existente (se houver)
   - O que está **fora** do escopo da primeira versão
   - Critério de sucesso: como saber que o app funciona
3. Não sugira tecnologia aqui. Isso é da SPEC.

## Saída: `docs/briefing.md`
```
# Briefing — <nome>
Data: AAAA-MM-DD

## Problema
## Usuários
## Ações principais
## Telas previstas (lista)
## Dados e integrações
## Plataforma
## Marca / design system
## Fora do escopo (v1)
## Critério de sucesso
## Dúvidas em aberto
```

Máximo de uma página e meia. Mostre um resumo de 5 linhas e peça aprovação (portão ✋ da skill `linha`).
Ao começar, rode `node .claude/hooks/etapa.cjs briefing`.
