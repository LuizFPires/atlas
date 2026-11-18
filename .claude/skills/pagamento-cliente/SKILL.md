---
name: pagamento-cliente
description: Capacidade das obras do cliente - cobrança online (Pix e cartão) sempre na conta do próprio cliente, no gateway dele, nunca passando pelo Atlas nem pelo Luiz. Use quando a obra precisar vender, cobrar sinal, assinatura ou "pagamento online".
---

# Pagamento na conta do cliente

Em palavras simples: o dinheiro da venda cai direto na conta do dono do negócio, como numa maquininha dele. O Atlas nunca toca nesse dinheiro.

**Regra que não muda:** pagamento e assinatura são sempre do cliente (gateway dele). Nada passa pelo Luiz nem pelo Atlas.

## Passos
1. Pergunte ao cliente qual gateway ele já usa ou quer usar (Stripe, Mercado Pago, Asaas...). Sugira um só; a conta é aberta por ele, no nome dele (CPF/CNPJ dele).
2. Ensine a criar a conta em passos curtos (skill `entregar` e Ajuda do Atlas ajudam). O Atlas não abre conta nem digita dado do cliente.
3. As chaves do gateway são do cliente: ficam em variável de ambiente do servidor dele (Supabase/Vercel do cliente), nunca em arquivo, repositório, log ou código de front. No front vai só a chave pública.
4. A cobrança é criada por função no servidor; o app só recebe o link ou o QR do Pix.
5. A confirmação do pagamento vem pelo webhook do gateway, com assinatura conferida. Sem assinatura válida, ignora.
6. Guarde só o necessário: id da cobrança, valor, situação. Nunca número de cartão.
7. Teste no ambiente de testes (sandbox) do gateway; só depois liga o modo de verdade, com o ok do cliente.
8. Reembolso e cancelamento: tela simples, regra escrita na política do negócio.

## Nunca
Usar uma conta do Atlas ou do Luiz para receber. Guardar chave secreta em arquivo. Ligar cobrança real sem o cliente ter visto o teste.
