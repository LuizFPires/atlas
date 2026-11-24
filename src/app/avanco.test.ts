import { textoAvanco } from './avanco'

test('avanço sempre com 2 casas no padrão brasileiro (Luiz, 24/11: o 0% parado dá ansiedade)', () => {
  expect(textoAvanco(0)).toBe('0,00')
  expect(textoAvanco(0.03)).toBe('0,03')
  expect(textoAvanco(54.2)).toBe('54,20')
  expect(textoAvanco(99.999)).toBe('99,99') // nunca arredonda para cima: 100 só quando acabou
  expect(textoAvanco(100)).toBe('100')
  expect(textoAvanco(Number.NaN)).toBe('0,00')
})
