// @vitest-environment node
// M5 item 4 — fidelidade com prototipo/F01Email.dc.html: os textos fixos do protótipo têm de estar no e-mail.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { montarBoasVindas } from '../functions/_shared/emails.ts'

const proto = readFileSync(new URL('../../prototipo/F01Email.dc.html', import.meta.url), 'utf8')
const { html } = montarBoasVindas({ nome: 'Zé', empresa: 'Barbearia do Zé', ramo: 'barbearia', link_instalacao: 'https://atlas-ia.app.br/instalar?t=x', expira_em: new Date('2026-11-20T15:00:00Z') })
const plano = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ')

describe('fidelidade ao protótipo F01Email', () => {
  it.each([
    'sua licença do Atlas está pronta.',
    'no computador onde você vai trabalhar',
    'Instalar o Atlas neste computador',
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
  it('usa as cores e o ícone do protótipo (hero #141619, lime #C6F135, microfone em SVG de traço)', () => {
    for (const cor of ['#141619', '#C6F135', '#F2F3EE', '#3E443C']) {
      expect(proto).toContain(cor)
      expect(html).toContain(cor)
    }
    expect(proto).toContain('<rect x="9" y="3" width="6" height="11" rx="3"/>')
    expect(html).toContain('<rect x="9" y="3" width="6" height="11" rx="3"/>')
  })
})
