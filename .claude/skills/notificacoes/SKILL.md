---
name: notificacoes
description: Capacidade das obras do cliente - avisos para os usuários finais do app (e-mail, WhatsApp, aviso no celular/PWA), com permissão e opção de parar de receber. Use quando a obra precisar lembrar, confirmar ou avisar alguém ("lembrete de horário", "avisa quando o pedido sair", "notificação push").
---

# Avisos para os usuários do app

Em palavras simples: é o recado no celular da pessoa ("seu horário é amanhã às 15h"). Útil, curto e só para quem aceitou receber.

Não confunda com as notícias da obra para o celular do **dono** (isso é o Remote Control do Claude Code, que o Atlas liga na hora de acompanhar pelo celular). Aqui são os avisos **do app do cliente** para as pessoas que usam o app.

## Passos
1. Na SPEC, liste os avisos: o que dispara, para quem, em que canal (e-mail, WhatsApp, push do PWA) e o texto.
2. Peça permissão antes de avisar (consentimento claro, por canal). Sem permissão, não envia.
3. Todo aviso tem como parar de receber (link "não quero mais receber" ou botão nas configurações).
4. Os envios saem por função no servidor (Supabase Edge Function) com a conta de envio **do cliente** (o provedor de e-mail/WhatsApp dele). Chaves ficam no cofre do provedor, em variável de ambiente; nunca em arquivo.
5. Texto curto, em português, sem jargão, com o nome do negócio do cliente.
6. Horário comercial: sem aviso de madrugada, salvo se for pedido do cliente.
7. Teste em modo fixture (um "enviador falso" que só anota o que enviaria) antes de ligar o provedor de verdade.

## Nunca
Mandar aviso a quem não deu permissão, guardar chave de provedor em arquivo, ou enviar dado pessoal que não seja necessário no texto.
