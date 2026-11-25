import { predioSvg } from './predio'

test('prédio subindo tem grua; pronto perde a grua e ganha a bandeira', () => {
  const subindo = predioSvg({ andares: 8, prontos: 3 })
  expect(subindo).toContain('#E0B83C')
  const pronto = predioSvg({ andares: 8, prontos: 8 })
  expect(pronto).not.toContain('#E0B83C')
  expect(pronto).toContain('fill="#C6F135"/>')
})
