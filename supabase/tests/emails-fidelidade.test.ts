// @vitest-environment node
// M5 item 4 — fidelidade com prototipo/F01Email.dc.html: os textos fixos do protótipo têm de estar no e-mail.
import { describe, expect, it } from 'vitest'
import proto from '../../prototipo/F01Email.dc.html?raw'
import { montarBoasVindas } from '../functions/_shared/emails.ts'

const { html } = montarBoasVindas({ nome: 'Zé', empresa: 'Barbearia do Zé', ramo: 'barbearia', link_instalacao: 'https://atlas-ia.app.br/instalar?t=x', expira_em: new Date('2026-11-20T15:00:00Z') })
const plano = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ')

describe('fidelidade ao protótipo F01Email', () => {
  // Textos do corpo (não os que viraram imagem) têm de estar no e-mail e no protótipo.
  it.each([
    'sua licença do Atlas está pronta.',
    'no computador onde você vai trabalhar',
    'O que vai acontecer',
    '1. O instalador pede um código que chega neste e-mail.',
    '2. Você conecta a sua conta do Claude.',
    '3. O Atlas te ajuda a abrir as contas que o seu sistema vai usar.',
    'Você não vai precisar digitar.',
    'No Atlas, tudo pode ser falado.',
    'amigo na mesa de um restaurante',
    'Abriu no celular? Toque em "Enviar para o meu computador".',
  ])('mantém o texto: %s', (frase) => {
    expect(plano(proto)).toContain(frase)
    expect(plano(html)).toContain(frase)
  })

  // Divergência proposital (pedido do Luiz, 19/11/2026): tudo o que é lime (marca no topo, botão e bolinha do
  // microfone) vira IMAGEM. O Gmail não inverte imagem; já cor de CSS ele escurece/clareia no modo escuro,
  // transformando o lime em verde-musgo e clareando o texto escuro. Então a fidelidade da marca é verificada
  // pelas imagens entregues, não mais por cor em CSS. O protótipo segue sendo a fonte da verdade do visual.
  it('entrega a marca por imagem (topo, botão e microfone) e mantém o hero escuro', () => {
    // Faixa do topo = uma imagem só (fundo escuro + logo embutidos), sobre o hero #141619.
    expect(html).toContain('/marca-banner.png')
    expect(html).toContain('background:#141619')
    // Botão = imagem clicável; o rótulo fica no alt (equivalente acessível).
    expect(html).toContain('/btn-instalar.png')
    expect(html).toContain('alt="Instalar o Atlas neste computador"')
    // Bolinha do microfone = imagem (círculo lime + ícone escuro).
    expect(html).toContain('/mic-pino.png')
  })

  it('o protótipo (fonte da verdade) tem o lime e o ícone de microfone de traço', () => {
    for (const cor of ['#141619', '#C6F135']) expect(proto).toContain(cor)
    expect(proto).toContain('<rect x="9" y="3" width="6" height="11" rx="3"/>')
  })
})
