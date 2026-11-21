# Contador do teste e compra de dentro do Atlas

Aprovado pelo Luiz em 21/11/2026 (adição pós-protótipo; decisão registrada no PLAN.md).

## Por quê
Quem está no teste grátis ou numa cortesia precisa ver, dentro do Atlas instalado, quanto tempo ainda tem, e poder comprar dali mesmo, sem voltar à página de vendas.

## O que o cliente vê
Na lateral do app, no lugar da linha fixa "Licença ativa · este computador":

```
TESTE GRÁTIS            (ou CORTESIA, quando foi presente do gestor)
Faltam 3 dias           (1 dia: "Falta 1 dia"; último dia: "Vence hoje")
Vence em 24/11
[ Quero o Atlas ]
```

- Licença paga: volta "Licença ativa · este computador", sem botão.
- Teste ou cortesia vencidos: "Seu teste acabou" (cortesia: "Sua cortesia acabou"), com o mesmo botão.
- Sem resposta do servidor (sem internet, app não ativado): a linha de hoje, sem contador e sem botão. Nunca um prazo inventado.

## Comprar
- O botão abre uma tela dentro do app: preço (R$ 4.800 + R$ 200/mês a partir do 2º mês), parcelas e aceite dos termos, com as mesmas regras e textos do site (`parcelas.ts`, `textos-legais.ts`). O e-mail é o da ativação, fixo.
- O app abre a página de pagamento da Stripe no navegador do cliente. O Atlas nunca vê dado de cartão.
- Depois de pagar, a Stripe devolve o cliente a `/compra/pelo-app` no site: "Pagamento confirmado. Pode voltar para o Atlas." (sem cadastro de novo, sem outro e-mail de instalação). Desistiu: `/compra/pelo-app/cancelada`, "Nada foi cobrado."
- O app percebe sozinho: enquanto espera o pagamento confere a licença a cada 10 s (por até 30 min) e, ao virar paga, troca o contador por "Licença ativa".

## Não faz parte
- Compra de app pronto (prateleira) de dentro do app.
- Tela cheia de bloqueio ao vencer (o aviso fica no cartão da lateral, visível em toda tela; o pós-obra já explica a cortesia vencida).
- Mudar preço, parcelas ou a conversão teste → compra (já existem no servidor).

## Invariantes
- Pagamento sempre na conta de gateway do Atlas configurada no site (`VITE_CONTA_ID`), como na página de vendas; nada de cartão dentro do app.
- A tela do app só abre no navegador endereço `https://checkout.stripe.com/`.
- O prazo vem do servidor, com a credencial do dispositivo; a tela não calcula validade por conta própria.
