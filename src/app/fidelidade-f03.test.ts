// Fidelidade com o protótipo F03Claude: os textos que o cliente lê são os mesmos da tela desenhada.
import proto from '../../prototipo/F03Claude.dc.html?raw'
import { explicarPlano, TEXTO_CONVITE_MAX } from './claude-plano'

// O protótipo escreve aspas dentro de strings JS com aspas simples; o que importa é o texto.
// DIVERGÊNCIA aprovada pelo Luiz em 23/11/2026: os 6 passos do login viraram um botão só ("Conectar o Claude"). Ver PLAN.
test('os textos fixos da tela batem com o protótipo', () => {
  for (const t of ['O Claude é o construtor.', 'É ele quem faz o seu sistema. Ele trabalha com a sua assinatura do Claude, que você paga direto para a Anthropic. Agora vamos apresentar o Claude ao Atlas.', 'Não consegui fazer este passo', 'Tudo bem, acontece com todo mundo.', 'Ver este passo em vídeo (40 s)', 'Pedir ajuda ao Atlas (mande um print)', 'Criar no site do Claude ↗', 'e assinar o plano Pro ou Max. Depois volte aqui.', 'É assim que vai aparecer na sua tela:', 'Conectado! Conta', 'Continuar →']) {
    expect(proto).toContain(t)
  }
})

test('a explicação do plano Pro e o convite para o Max são os do protótipo', () => {
  const pro = explicarPlano('pro')
  expect(proto).toContain(pro.texto)
  expect(proto.toUpperCase()).toContain(pro.titulo)
  expect(proto).toContain(TEXTO_CONVITE_MAX.titulo)
  expect(proto).toContain(TEXTO_CONVITE_MAX.texto)
  expect(proto).toContain(TEXTO_CONVITE_MAX.link)
})
