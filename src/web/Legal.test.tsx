import { render, screen, within } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { PaginaLegal } from './Legal'
import { Markdown } from './Markdown'
import { DOCS_LEGAIS, DOCS_LEGAIS_EN, idiomaLegalDoCaminho, idLegalDoCaminho } from './textos-legais'
import { Vendas } from './Vendas'

test('as rotas /privacidade, /termos e /licenca existem; outras não', () => {
  expect(idLegalDoCaminho('/privacidade')).toBe('privacidade')
  expect(idLegalDoCaminho('/termos')).toBe('termos')
  expect(idLegalDoCaminho('/licenca')).toBe('licenca')
  expect(idLegalDoCaminho('/conta')).toBeNull()
})

test('a página da política mostra o texto de docs/legal, com tabela e os dados reais da empresa, sem placeholders', () => {
  render(<TemaProvider><PaginaLegal id="privacidade" /></TemaProvider>)
  expect(screen.getByRole('heading', { level: 1, name: 'Política de Privacidade do Atlas' })).toBeInTheDocument()
  expect(screen.getAllByRole('table').length).toBeGreaterThan(0)
  const texto = document.body.textContent ?? ''
  // Textos finalizados (19/11/2026): sem placeholders e com os dados da controladora.
  expect(texto).not.toMatch(/\[__|\[nome|\[e-mail|\[endereço|\[cidade|\[data de publ|\[pedido de registro|\[nome do gateway/)
  expect(texto).toContain('PL Participações LTDA')
  expect(texto).toContain('30.484.256/0001-82')
  expect(texto).toContain('luizfsap@gmail.com')
})

test('o rodapé da página de vendas leva aos três textos', () => {
  render(<TemaProvider><Vendas onComprar={() => {}} /></TemaProvider>)
  const rodape = screen.getByRole('contentinfo')
  expect(within(rodape).getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos')
  expect(within(rodape).getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', '/privacidade')
  expect(within(rodape).getByRole('link', { name: 'Licença do software' })).toHaveAttribute('href', '/licenca')
})

test('o Markdown nunca vira HTML: tags e scripts aparecem como texto', () => {
  const { container } = render(<Markdown texto={'# Oi <img src=x onerror=alert(1)>\n\n<script>alert(1)</script> **forte**'} />)
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('img')).toBeNull()
  expect(container.textContent).toContain('<script>alert(1)</script>')
  expect(container.querySelector('strong')?.textContent).toBe('forte')
})

describe('textos legais em inglês (M31)', () => {
  test('rotas /en/terms, /en/license e /en/privacy existem e mostram o texto em inglês, com o aviso de tradução', () => {
    expect(idLegalDoCaminho('/en/terms')).toBe('termos')
    expect(idLegalDoCaminho('/en/license')).toBe('licenca')
    expect(idLegalDoCaminho('/en/privacy')).toBe('privacidade')
    expect(idiomaLegalDoCaminho('/en/privacy')).toBe('en')
    expect(idiomaLegalDoCaminho('/privacidade')).toBe('pt')
    render(<TemaProvider><PaginaLegal id="privacidade" idioma="en" /></TemaProvider>)
    expect(screen.getByRole('heading', { level: 1, name: 'Atlas Privacy Policy' })).toBeInTheDocument()
    expect(document.body.textContent).toContain('the Portuguese original prevails')
    expect(document.body.textContent).toContain('30.484.256/0001-82')
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en')
  })

  test('o rodapé em inglês leva aos textos em inglês, sem "(in Portuguese)"', () => {
    render(<TemaProvider><Vendas idioma="en" onComprar={() => {}} /></TemaProvider>)
    const rodape = screen.getByRole('contentinfo')
    expect(within(rodape).getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/en/terms')
    expect(within(rodape).getByRole('link', { name: 'Software license' })).toHaveAttribute('href', '/en/license')
    expect(within(rodape).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/en/privacy')
    expect(rodape.textContent).not.toContain('in Portuguese')
  })

  test('mesma versão e mesmas seções nos dois idiomas (a tradução não pode ficar para trás)', () => {
    for (const id of ['termos', 'licenca', 'privacidade'] as const) {
      const pt = DOCS_LEGAIS[id].md, en = DOCS_LEGAIS_EN[id].md
      const versao = (t: string) => /(Versão|Version) (\d+\.\d+)/.exec(t)?.[2]
      expect(versao(en)).toBe(versao(pt))
      expect((en.match(/^## /gm) ?? []).length).toBe((pt.match(/^## /gm) ?? []).length)
    }
  })
})
