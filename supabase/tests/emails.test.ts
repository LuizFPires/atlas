// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { montarBoasVindas } from '../functions/_shared/emails.ts'

const LINK = 'https://atlas-ia.app.br/instalar?t=abc123'
const base = { nome: 'Zé', empresa: 'Barbearia do Zé', ramo: 'barbearia', link_instalacao: LINK, expira_em: new Date('2026-11-20T15:00:00Z') }

describe('e-mail de boas-vindas em HTML (F01)', () => {
  it('segue o protótipo: título, botão e microfone como imagem da marca, passos e aviso de uso único', () => {
    const { html, assunto } = montarBoasVindas(base)
    expect(assunto).toBe('Zé, o seu Atlas chegou')
    expect(html).toContain('Zé, sua licença do Atlas está pronta.')
    expect(html).toContain('Barbearia do Zé (barbearia)')
    expect(html).toContain(`href="${LINK}"`)
    // Botão e microfone viram imagem (o lime não sobrevive como cor de CSS no modo escuro do Gmail); o rótulo fica no alt.
    expect(html).toContain('alt="Instalar o Atlas neste computador"')
    expect(html).toContain('/btn-instalar.png')
    expect(html).toContain('/marca-banner.png')
    expect(html).toContain('/mic-pino.png')
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
