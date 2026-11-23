import { render, screen } from '@testing-library/react'
import { CelularPreview, escalaDoCelular } from './Prototipo'

test('a tela é desenhada no tamanho real de um telefone (390 × 844), nunca espremida na largura da moldura', () => {
  render(<CelularPreview html="<h1>Oi</h1>" titulo="Tela Início no celular" />)
  const tela = screen.getByTitle('Tela Início no celular')
  expect(tela.style.width).toBe('390px')
  expect(tela.style.height).toBe('844px')
})

test('a escala faz o telefone inteiro caber na moldura (sem rolagem de lado), sem nunca aumentar', () => {
  expect(escalaDoCelular(218, 496)).toBeCloseTo(218 / 390, 3) // notebook pequeno: limitado pela largura
  expect(escalaDoCelular(400, 500)).toBeCloseTo(500 / 844, 3) // moldura larga e baixa: limitado pela altura
  expect(escalaDoCelular(800, 2000)).toBe(1) // tela enorme: tamanho real, sem esticar
  expect(escalaDoCelular(0, 0)).toBe(1) // ainda sem medida: não some
})
