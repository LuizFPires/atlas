import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BandeiraIdioma, enderecoDoIdioma } from './BandeiraIdioma'

beforeEach(() => { document.cookie = 'atlas_idioma=; Max-Age=0; Path=/' })

test('mostra as duas bandeiras; a do idioma atual fica marcada', () => {
  render(<BandeiraIdioma idioma="en" />)
  expect(screen.getByRole('link', { name: 'English (US)' })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByRole('link', { name: 'Português (Brasil)' })).toHaveAttribute('aria-current', 'false')
})

test('clicar guarda a escolha (ela vale mais que a localização)', async () => {
  render(<BandeiraIdioma idioma="pt" />)
  const en = screen.getByRole('link', { name: 'English (US)' })
  en.addEventListener('click', (e) => e.preventDefault())
  await userEvent.click(en)
  expect(document.cookie).toContain('atlas_idioma=en')
})

test('para onde cada bandeira leva', () => {
  expect(enderecoDoIdioma('en', 'atlas-ia.app.br')).toBe('/en')
  expect(enderecoDoIdioma('pt', 'atlas-ia.app.br')).toBe('/')
  expect(enderecoDoIdioma('pt', 'www.use-atlas-ai.com')).toBe('https://atlas-ia.app.br/?idioma=pt')
  expect(enderecoDoIdioma('en', 'www.use-atlas-ai.com')).toBe('/')
})
