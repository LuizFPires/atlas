// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs'

// Luiz, 24/11/2026: no iPhone, o Atlas na Tela de Início aparecia com um "A" genérico. O iPhone não usa o ícone do manifesto:
// ele pede o apple-touch-icon (180 × 180, sem transparência). Tem de ser a logomarca verde no fundo preto.
test('o iPhone recebe o ícone do Atlas (apple-touch-icon) e o nome "Atlas"', () => {
  const html = readFileSync('index.html', 'utf8')
  expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
  expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Atlas" />')
  const png = readFileSync('public/apple-touch-icon.png')
  expect(png.readUInt32BE(16)).toBe(180) // largura
  expect(png.readUInt32BE(20)).toBe(180) // altura
  expect(existsSync('public/icon-512.png')).toBe(true)
})
