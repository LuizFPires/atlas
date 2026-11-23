// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { montarBoasVindas, montarConfirmacaoDegustacao, montarCortesia } from '../functions/_shared/emails.ts'

const LINK = 'https://atlas-ia.app.br/instalar?t=abc123'
const base = { nome: 'Zé', empresa: 'Barbearia do Zé', ramo: 'barbearia', link_instalacao: LINK, expira_em: new Date('2026-11-20T15:00:00Z') }

describe('e-mail de boas-vindas em HTML (F01)', () => {
  it('segue o protótipo: título, botão em texto, passos e aviso de uso único', () => {
    const { html, assunto } = montarBoasVindas(base)
    expect(assunto).toBe('Zé, o seu Atlas chegou')
    expect(html).toContain('Zé, sua licença do Atlas está pronta.')
    expect(html).toContain('Barbearia do Zé (barbearia)')
    expect(html).toContain(`href="${LINK}"`)
    // Botão em texto e marca escrita (sem imagem): decisão de 22/11/2026 para o e-mail cair na Principal.
    expect(html).toContain('>Instalar o Atlas neste computador</a>')
    expect(html).toContain('no computador onde você vai trabalhar')
    expect(html).toContain('O que vai acontecer')
    expect(html).toContain('Você não vai precisar digitar.')
    expect(html).toContain('Enviar para o meu computador')
  })
  it('sem emoji e sem promessa de atendimento humano; suporte é a Ajuda do Atlas', () => {
    const { html, texto } = montarBoasVindas(base)
    expect(html + texto).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(html + texto).not.toMatch(/whatsapp|telefone|ligue|nossa equipe|atendente/i)
    expect(texto).toContain('Ajuda do Atlas')
  })
  it('texto livre malicioso é neutralizado e escapado; nenhum endereço vem do texto do cliente', () => {
    const { html } = montarBoasVindas({ ...base, nome: 'Zé <script>x</script> 1234', empresa: 'Loja https://evil.test/x', ramo: 'liga em x@evil.com ou evil.com.br "><img src=x>' })
    expect(html).not.toMatch(/evil/i) // domínios e e-mail do texto do cliente foram removidos
    expect(html).not.toContain('<script') // nada de script injetado
    expect(html).not.toContain('<img src=x') // a tag do texto malicioso foi escapada, não vira <img> de verdade
    // Os únicos endereços são os nossos: o link do botão (atlas-ia.app.br) e as imagens da marca (atlas-ia-plum.vercel.app).
    const urls = html.match(/https?:\/\/[^"'()\s]+/g) ?? []
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every((u) => u.startsWith('https://atlas-ia'))).toBe(true)
  })
  it('link que não é http(s) não vira botão', () => {
    const { html } = montarBoasVindas({ ...base, link_instalacao: 'javascript:alert(1)' })
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('Instalar o Atlas neste computador</a>')
  })
})

describe('aviso da tela azul do Windows (instalador ainda sem assinatura)', () => {
  const cortesia = montarCortesia({ validade_em: new Date('2026-12-05T20:00:00Z'), link: LINK, link_expira_em: new Date('2026-11-23T12:00:00Z') })
  it.each([['boas-vindas', montarBoasVindas(base)], ['cortesia', cortesia]])('%s: avisa antes, no HTML e no texto, com os dois cliques', (_nome, m) => {
    for (const corpo of [m.html, m.texto]) {
      expect(corpo).toContain('O Windows protegeu o computador')
      expect(corpo).toContain('Mais informações')
      expect(corpo).toContain('Executar assim mesmo')
    }
    expect(m.html).toContain('O Windows vai pedir uma confirmação')
  })
})

describe('aviso de que o Atlas só funciona com uma assinatura do Claude', () => {
  const cortesia = montarCortesia({ validade_em: new Date('2026-12-05T20:00:00Z'), link: LINK, link_expira_em: new Date('2026-11-23T12:00:00Z') })
  const teste = montarConfirmacaoDegustacao({ dias: 5, link: 'https://atlas-ia.app.br/degustacao?t=abc', expira_em: new Date('2026-11-23T12:00:00Z') })
  it.each([['boas-vindas', montarBoasVindas(base)], ['cortesia', cortesia], ['confirmação do teste grátis', teste]])('%s: diz, no HTML e no texto, que precisa do Claude, que é pago à parte e que plano maior anda mais rápido', (_nome, m) => {
    for (const corpo of [m.html, m.texto]) {
      expect(corpo).toContain('O Atlas só funciona com uma assinatura do Claude')
      expect(corpo).toContain('paga direto à Anthropic, à parte do Atlas')
      expect(corpo).toContain('Quanto maior o plano, mais rápido a obra anda')
      expect(corpo).not.toMatch(/plano (Pro|Max)\b/)
    }
  })
})

// Pedido do Luiz (22/11/2026): com o mesmo assunto, o Gmail juntava cada cortesia nova à conversa antiga e ela "não chegava".
test('cortesia: a validade vai no assunto, para cada presente chegar como e-mail separado', () => {
  const a = montarCortesia({ validade_em: new Date('2026-12-05T20:00:00Z'), link: LINK, link_expira_em: new Date('2026-11-23T12:00:00Z') })
  const b = montarCortesia({ validade_em: new Date('2026-11-24T02:59:59Z'), link: LINK, link_expira_em: new Date('2026-11-23T12:00:00Z') })
  expect(a.assunto).toBe('Seu acesso ao Atlas está liberado (até 05/12)')
  expect(b.assunto).toBe('Seu acesso ao Atlas está liberado (até 23/11)') // fim do dia em Brasília
  expect(a.assunto).not.toMatch(/ganhou|presente|grátis/i) // palavras que puxam o e-mail para a aba Promoções
  expect(a.assunto).not.toBe(b.assunto)
})

describe('e-mails de acesso com cara de aviso de sistema (para cair na Principal, não em Promoções)', () => {
  const montados = () => [
    montarBoasVindas(base),
    montarCortesia({ link: LINK, validade_em: new Date('2026-11-30T12:00:00Z'), link_expira_em: new Date('2026-11-24T12:00:00Z') }),
    montarConfirmacaoDegustacao({ dias: 7, expira_em: new Date('2026-11-24T12:00:00Z'), link: LINK }),
  ]
  it('nenhuma imagem: nem banner, nem botão, nem ícone (o Gmail lê imagem grande como newsletter)', () => {
    for (const m of montados()) expect(m.html).not.toMatch(/<img\b/i)
  })
  it('o botão é um link de texto, com o rótulo visível', () => {
    const [bv, cort, deg] = montados()
    expect(bv.html).toMatch(new RegExp(`<a href="${LINK.replace(/[?.]/g, '\\$&')}"[^>]*>[^<]*Instalar o Atlas neste computador`))
    expect(cort.html).toContain('>Instalar o Atlas neste computador</a>')
    expect(deg.html).toContain('>Liberar o meu teste</a>')
  })
  it('sem palavras de promoção no assunto, no corpo e no texto', () => {
    for (const m of montados()) expect(`${m.assunto} ${m.html} ${m.texto}`).not.toMatch(/ganhou|presente|grátis|gratuit|oferta|promo/i)
  })
})
