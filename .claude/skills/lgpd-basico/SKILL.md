---
name: lgpd-basico
description: Capacidade das obras do cliente - o básico da LGPD no app (consentimento claro, política de privacidade, dados mínimos, exclusão de conta). Use quando a obra tiver cadastro ou coletar qualquer dado de pessoa, antes da vistoria final, ou quando alguém falar em "LGPD", "privacidade", "termos" ou "apagar minha conta".
---

# LGPD básico

Em palavras simples: pedir só o que precisa, avisar para que serve, deixar a pessoa dizer sim ou não, e apagar quando ela pedir.

Não é parecer jurídico. A política e os termos são rascunhos para o cliente mostrar a um advogado dele.

## Passos
1. **Dados mínimos**: liste cada campo que o app pede e para que serve. Campo sem motivo sai.
2. **Consentimento**: no cadastro, caixa para marcar (nunca já marcada) com link para a política e os termos. Guarde quando e o que a pessoa aceitou (data, versão do texto).
3. **Política de privacidade e termos**: crie páginas no app a partir dos modelos de `docs/legal/`, trocando o nome, o CNPJ/CPF, o e-mail de contato e do encarregado (do negócio do cliente).
4. **Exclusão de conta**: botão dentro do app que apaga a conta e os dados da pessoa (a Apple exige quando há cadastro). Confirme antes de apagar.
5. **Pedir os próprios dados**: forma simples de baixar o que o app guarda sobre ela.
6. **Cookies/analytics**: aviso e escolha, só se o app usar.
7. **Lojas**: a mesma lista alimenta os formulários de privacidade das lojas (o `corretor` usa `store/privacidade.md`).
8. O `vistoriador` confere tudo isto antes do lançamento.

## Nunca
Coletar dado "para o caso de precisar". Compartilhar dado pessoal sem avisar. Prometer atendimento humano no texto: o suporte é a Ajuda do Atlas.
