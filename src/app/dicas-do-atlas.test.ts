import { dicasDaTela } from './dicas-do-atlas'

const cel = (id: string, nome: string) => ({ id, nome, html: '<div/>', aparelho: 'celular' as const })

test('tela de cadastro: a primeira dica é ver 3 jeitos antes de escolher', () => {
  const d = dicasDaTela(cel('novo-funcionario', 'Cadastrar funcionário'), [cel('novo-funcionario', 'Cadastrar funcionário')])
  expect(d[0]).toMatchObject({ tipo: 'versoes', titulo: 'Na dúvida sobre "Cadastrar funcionário"? Veja 3 jeitos antes de escolher.' })
})

test('só telas de celular: sugere o painel do escritório no computador; com computador, não', () => {
  const so = dicasDaTela(cel('inicio', 'Início'), [cel('inicio', 'Início')])
  expect(so.some((x) => /computador/.test(x.titulo))).toBe(true)
  const com = dicasDaTela(cel('inicio', 'Início'), [cel('inicio', 'Início'), { id: 'painel', nome: 'Painel', html: '', aparelho: 'computador' }])
  expect(com.some((x) => /computador/.test(x.titulo))).toBe(false)
})

test('toda tela tem dicas de pedido pronto (para a pessoa só confirmar), sem repetir', () => {
  const d = dicasDaTela(cel('agenda', 'Agenda do dia'), [cel('agenda', 'Agenda do dia')])
  expect(d.length).toBeGreaterThanOrEqual(3)
  expect(new Set(d.map((x) => x.titulo)).size).toBe(d.length)
  for (const x of d) expect(x.pedido.length).toBeGreaterThan(10)
  expect(d.some((x) => x.pedido.includes('Agenda do dia'))).toBe(true)
})
