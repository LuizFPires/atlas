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

  // Divergência proposital (decisão do Luiz, 22/11/2026, substitui a de 19/11): sem imagens. Banner, botão e ícones em
  // imagem faziam o Gmail tratar o e-mail como propaganda (aba Promoções). A marca vira texto lime sobre o hero escuro
  // e o botão é um link de texto sobre fundo lime. No modo escuro do Gmail o lime pode ficar mais apagado: aceito.
  it('marca e botão em texto, sem nenhuma imagem, com o hero escuro e o lime', () => {
    expect(html).not.toMatch(/<img\b/i)
    expect(html).toContain('background:#141619')
    expect(html).toContain('>ATLAS</span>')
    expect(html).toContain('>Instalar o Atlas neste computador</a>')
    expect(html).toContain('#C6F135')
  })

  it('o protótipo (fonte da verdade) tem o lime e o ícone de microfone de traço', () => {
    for (const cor of ['#141619', '#C6F135']) expect(proto).toContain(cor)
    expect(proto).toContain('<rect x="9" y="3" width="6" height="11" rx="3"/>')
  })
})
