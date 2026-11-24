import { render, screen } from '@testing-library/react'
import { Canteiro3D } from './Canteiro3D'

test('sem canteiro vivo mostra a imagem 3D, nunca 2D', () => {
  render(<Canteiro3D endereco={null} pct={40} />)
  expect(screen.getByRole('img', { name: /Canteiro em 3D/ })).toBeInTheDocument()
  expect(document.querySelector('iframe')).toBeNull()
  expect(screen.getByText('CANTEIRO 3D · ARRASTE PARA GIRAR')).toBeInTheDocument()
})

test('com canteiro vivo embute a cena real em 3D num iframe com sandbox', () => {
  render(<Canteiro3D endereco="http://127.0.0.1:4747/?obra=abc" pct={40} />)
  const f = screen.getByTitle(/Canteiro em 3D/)
  expect(f.getAttribute('src')).toBe('http://127.0.0.1:4747/?obra=abc&modo=3d&baloes=0')
  expect(f.getAttribute('sandbox')).not.toMatch(/top-navigation|forms|popups/)
})

test('endereço fora do servidor local cai na imagem', () => {
  render(<Canteiro3D endereco="https://evil.example/x" pct={0} />)
  expect(document.querySelector('iframe')).toBeNull()
})
