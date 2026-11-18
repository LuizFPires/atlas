# Design system do Atlas

Aprovado com o protótipo em 18/11/2026. Referência visual: o design system do PACE (grafite com verde-limão). Dois temas: A, escuro (padrão), e B, claro.

## Marca
- **Monograma:** `prototipo/assets/monograma-fundo-escuro.png`, para fundos escuros, e `monograma-fundo-claro.png`, para fundos claros.
- **Nome:** `prototipo/assets/nome-atlas.png`. Em fundo claro, aplicar escurecido.
- **Imagem-assinatura:** o canteiro 3D com o prédio subindo (`prototipo/assets/canteiro-3d.jpg`; no app, a cena real do `.claude/canteiro`). Não usar canteiro 2D.

## Cores
| Token | Escuro (A) | Claro (B) |
|---|---|---|
| bg | #141619 | #F2F3EE |
| card | #1E2125 | #FFFFFF |
| cardB (borda) | #2C3036 | #DADDD3 |
| card2 | #22262B | #E8EAE3 |
| text | #EDEFEA | #1B1E22 |
| mute | #B4BBB2 | #5F665C |
| mute2 | #8E968C | #6B7268 |
| lime (destaque) | #C6F135 | #B6E22E |
| onLime (texto sobre o lime) | #141619 | #1B1E22 |
| limeTxt (texto em lime) | #C6F135 | #3F5600 |
| line | #2A2E33 | #E6E8E1 |
| input | #16181B | #FFFFFF |
| soft (seleção) | #2A3A12 | #DDF59A |
| aviso | #F2B14A | #F6D28E (texto #7A4E00) |
| erro | #E5534B | #C4372D |

O menu lateral é sempre escuro (#101214, ou #1F2226 no tema claro).

## Tipografia
- **Geist:** textos e títulos. Títulos de 28 a 60 px com tracking negativo; texto de 15 a 17 px.
- **Geist Mono:** rótulos em caixa alta (12 px, espaçamento .12em) e números.

## Componentes
- **Botão de ação:** 50 a 56 px de altura, raio 12, texto em uma linha só (nowrap), largura que não encolhe.
  - Principal: lime com texto onLime.
  - Secundário: borda cardB sobre fundo transparente.
- **Bolinha de ícone:** círculo lime com ícone de traço preto (SVG, stroke 2,2). Nunca emoji dentro da bolinha.
- **Cartão:** fundo card, borda cardB, raio 16 a 20. Cartão só informativo é sempre neutro; o verde (soft + borda lime) indica seleção.
- **Chips e etapas:** pílulas de 34 a 40 px. A ativa fica em lime ou soft.
- **Microfone:** presente em toda entrada de texto. Fica vermelho (#F05A4F) e pulsando enquanto grava, com a transcrição editável depois.
- **Guia de mão dada:**
  - à esquerda, o passo atual com "PASSO X DE Y", quem faz (VOCÊ ou O ATLAS), a tradução de botões em inglês e a frase de calma;
  - à direita, uma imagem do site com o botão certo piscando e a etiqueta "👆 clique aqui";
  - embaixo, "← Voltar", "Fiz isso →" e o link "Não consegui fazer este passo", que abre a Ajuda do Atlas.
- **Ajuda do Atlas:** painel lateral de 520 px com print da tela, conversa, botões de ação e entrada com microfone.

## Tom de voz
- Português simples, como se o cliente tivesse 5 anos.
- Analogia da obra: projeto, orçamento, obra, chaves e reforma; o computador é o canteiro.
- "Fale como se estivesse com um amigo na mesa de um restaurante."
- Nunca prometer atendimento humano.
