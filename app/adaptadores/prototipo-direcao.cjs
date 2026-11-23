// Direção de arte do protótipo (pedido do Luiz em 22/11/2026: "os protótipos são a alma do Atlas; UX e UI de nível
// internacional, de cair o queixo"). Vai em TODO pedido ao Claude de desenhar ou ajustar telas. É texto NOSSO (regra),
// separado do conteúdo do cliente (que continua como DADO delimitado em prototipo.cjs).
'use strict'

const DIRECAO_DE_ARTE = [
  'PADRÃO DE QUALIDADE: este protótipo é a primeira impressão do cliente. Desenhe no nível dos melhores apps do mundo (Apple, Airbnb, Linear, Nubank, Stripe): bonito, claro e surpreendente, com alta fidelidade ao sistema que será construído.',
  '',
  'Direção de arte:',
  '- Hierarquia forte: um título claro por tela, uma ação principal por tela (botão grande, na zona do polegar), o resto em segundo plano.',
  '- Grade de 8 px: espaçamentos 8/12/16/24/32. Margem lateral de 20 a 24 px. Respiro generoso; nada encostado.',
  '- Tipografia em escala: 28-34 px títulos, 17-20 subtítulos, 15-16 texto, 12-13 legendas. Pesos 400/600/700. Números alinhados (font-variant-numeric: tabular-nums).',
  '- Cor com intenção: siga o estilo/design system da obra. Destaque só onde importa; fundos neutros; contraste mínimo AA (4,5:1 no texto).',
  '- Cantos, bordas e sombras consistentes em todas as telas (o mesmo raio do estilo; sombras suaves e baixas).',
  '- Ícones em SVG de traço desenhados no próprio html (stroke 1.75-2, cantos arredondados). Nada de emoji, nada de imagem externa. Fotos: use blocos com gradiente suave e iniciais, como avatar.',
  '- Celular de verdade: largura 390 px, barra de status no topo (9:41, sinal, bateria), área segura embaixo, alvos de toque de no mínimo 44 px, barra de navegação inferior com 3 a 5 itens quando o sistema tiver várias áreas.',
  '- Detalhes que encantam: chips, badges de status com cor, barras de progresso, cartões com hierarquia interna, estados selecionados visíveis, um toque de profundidade.',
  '',
  'Conteúdo real (nunca "lorem ipsum"):',
  '- Português do Brasil, no tom do negócio do cliente, com dados de exemplo realistas DO RAMO dele: nomes brasileiros, valores em R$ (R$ 1.234,56), datas dd/mm, horários 14h30, telefones (31) 9xxxx-xxxx.',
  '- Mostre o sistema "em uso": listas com 4 a 8 itens variados, números que fazem sentido entre si, um item em destaque ou atrasado.',
  '',
  'Fluxo e telas (de 5 a 8):',
  '- Cubra a jornada principal de ponta a ponta: entrada/início, as telas centrais do negócio, um formulário ou ação importante, a confirmação de sucesso.',
  '- Inclua pelo menos um estado especial bem desenhado: lista vazia (com ilustração em SVG e uma frase convidativa) ou mensagem de sucesso.',
  '- Formulários: rótulo sempre visível, exemplo de preenchimento, erro em vermelho explicando como corrigir.',
  '',
  'NAVEGAÇÃO (o protótipo é navegável, sem script):',
  '- Cada tela tem um id em minúsculas e hífen. Para levar a outra tela use SÓ <a href="#tela-ID">…</a> (ex.: href="#tela-agenda"). Botões que navegam são <a> com cara de botão.',
  '- Toda tela precisa de saída: barra inferior ou botão de voltar (<a href="#tela-ID-anterior">). Nenhum link para fora (http), nenhum <form> que envia, nenhum script.',
  '- Na barra inferior, marque o item da tela atual como selecionado.',
  '',
  'CSS:',
  '- Cada tela traz o próprio <style> e é isolada das outras: pode repetir as mesmas classes em todas as telas (é até melhor, para ficar consistente).',
  '- Fontes: use a fonte do estilo com font-family de sistema como reserva (sem @import externo).',
  '',
  'ANTES DE RESPONDER, confira tela por tela: (1) existe uma ação principal óbvia? (2) espaçamentos e cantos iguais aos das outras telas? (3) os textos parecem do negócio do cliente? (4) todo link interno aponta para uma tela que existe? (5) nada de script, http ou imagem externa? Corrija o que falhar e só então responda.',
]

module.exports = { DIRECAO_DE_ARTE }
