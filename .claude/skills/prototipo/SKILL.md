---
name: prototipo
description: Etapa 3 da linha de produção. Constrói com o usuário um protótipo navegável de alta fidelidade em prototipo/, usando o design system aprovado. Use depois de briefing e design aprovados, ou quando o usuário pedir para prototipar telas.
---

# Protótipo navegável

O protótipo aprovado vira a **fonte da verdade** de todo o projeto. Capriche.

## Antes de começar
1. Rode `node .claude/hooks/etapa.cjs prototipo`.
2. Leia `docs/briefing.md` e `docs/design-system.md`. Só esses dois.
3. Proponha a lista de telas e o fluxo de navegação em até 8 linhas. Ajuste com o usuário antes de desenhar. (Se estiver em plan mode, este é o plano.)

## Como construir
- HTML, CSS e JS puros em `prototipo/`, sem build. Abre com duplo clique.
- Uma tela por seção, com âncora: `<section id="tela-login">`. O escritor e o QA vão citar essas âncoras.
- Use as variáveis CSS do design system. Não invente cores fora dele.
- Dados fictícios realistas (nomes, valores em R$ no padrão brasileiro, datas).
- Inclua os estados: vazio, carregando, erro, sucesso.
- Navegação funcionando entre todas as telas.
- Itere tela por tela com o usuário. Mostre, ouça, ajuste.

## Economia
- Edite trechos com `Edit`; não reescreva o arquivo inteiro a cada ajuste.
- Se o arquivo passar de ~800 linhas, separe em `prototipo/css/`, `prototipo/js/` e um HTML por grupo de telas.

## Encerrar
Quando o usuário aprovar:
1. Crie `prototipo/TELAS.md` com a lista: `- tela-login — prototipo/index.html#tela-login — descrição curta`.
2. Registre em `docs/aprovacoes.md`: `- AAAA-MM-DD — protótipo aprovado (fonte da verdade)`.
3. Sugira `/clear` e a skill `documentar`.
