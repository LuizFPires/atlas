import { render, screen, within } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { PaginaLegal } from './Legal'
import { Markdown } from './Markdown'
import { idLegalDoCaminho } from './textos-legais'
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
