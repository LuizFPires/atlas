// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { montarBoasVindas } from '../functions/_shared/emails.ts'

const LINK = 'https://atlas-ia.app.br/instalar?t=abc123'
const base = { nome: 'Zé', empresa: 'Barbearia do Zé', ramo: 'barbearia', link_instalacao: LINK, expira_em: new Date('2026-11-20T15:00:00Z') }

describe('e-mail de boas-vindas em HTML (F01)', () => {
  it('segue o protótipo: título, botão, passos, microfone em SVG e aviso de uso único', () => {
    const { html, assunto } = montarBoasVindas(base)
    expect(assunto).toBe('Zé, o seu Atlas chegou')
    expect(html).toContain('Zé, sua licença do Atlas está pronta.')
    expect(html).toContain('Barbearia do Zé (barbearia)')
    expect(html).toContain(`href="${LINK}"`)
    expect(html).toContain('Instalar o Atlas neste computador')
    expect(html).toContain('no computador onde você vai trabalhar')
    expect(html).toContain('O que vai acontecer')
    expect(html).toContain('Você não vai precisar digitar.')
    expect(html).toContain('<svg')
    expect(html).toContain('Enviar para o meu computador')
    expect(html).toContain('#C6F135')
  })
  it('sem emoji e sem promessa de atendimento humano; suporte é a Ajuda do Atlas', () => {
    const { html, texto } = montarBoasVindas(base)
    expect(html + texto).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(html + texto).not.toMatch(/whatsapp|telefone|ligue|nossa equipe|atendente/i)
    expect(texto).toContain('Ajuda do Atlas')
  })
  it('texto livre malicioso é neutralizado e escapado; só o link do botão é endereço', () => {
    const { html } = montarBoasVindas({ ...base, nome: 'Zé <script>x</script> 1234', empresa: 'Loja https://evil.test/x', ramo: 'liga em x@evil.com ou evil.com.br "><img src=x>' })
    expect(html).not.toMatch(/evil|<script|<img|@/i)
    expect(html.match(/https?:\/\//g)?.length ?? 0).toBeLessThanOrEqual(2) // botão (+ doctype não conta)
  })
  it('link que não é http(s) não vira botão', () => {
    const { html } = montarBoasVindas({ ...base, link_instalacao: 'javascript:alert(1)' })
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('Instalar o Atlas neste computador</a>')
  })
})
