import { render, screen, within } from '@testing-library/react'
import { Avisos } from './Avisos'
import { calcularAvisos } from './regrasAvisos'
import { criarDadosFixture } from './dados'

const H = '2026-01-10'

test('regras: estoque baixo e validade próxima/vencida, ordenados do mais urgente', async () => {
  const produtos = await criarDadosFixture(H).listarProdutos()
  const a = calcularAvisos(produtos, H)
  expect(a.estoqueBaixo.map((p) => p.nome)).toEqual(['Sabão em pó', 'Leite integral 1 L'])
  expect(a.validade.map((v) => [v.produto.nome, v.dias, v.vencido])).toEqual([['Pão de forma', -1, true], ['Leite integral 1 L', 4, false]])
  // no limite: exatamente 5 em estoque não é baixo; vence em 7 dias entra, em 8 não
  expect(calcularAvisos([{ id: 'x', nome: 'X', precoCentavos: 1, quantidade: 5, validade: '2026-01-17' }], H).estoqueBaixo).toHaveLength(0)
  expect(calcularAvisos([{ id: 'x', nome: 'X', precoCentavos: 1, quantidade: 5, validade: '2026-01-17' }], H).validade).toHaveLength(1)
  expect(calcularAvisos([{ id: 'x', nome: 'X', precoCentavos: 1, quantidade: 5, validade: '2026-01-18' }], H).validade).toHaveLength(0)
})

test('a tela lista o que repor e o que retirar', async () => {
  render(<Avisos dados={criarDadosFixture(H)} hoje={H} />)
  const baixo = await screen.findByRole('list', { name: 'Estoque baixo' })
  expect(within(baixo).getByText('Sabão em pó')).toBeInTheDocument()
  expect(within(baixo).getByText('Só 3 em estoque')).toBeInTheDocument()
  const val = screen.getByRole('list', { name: 'Validade' })
  expect(within(val).getByText(/Vencido, retire da prateleira: venceu ontem/)).toBeInTheDocument()
  expect(within(val).getByText(/vence em 4 dias/)).toBeInTheDocument()
  expect(within(val).queryByText('Arroz 5 kg')).toBeNull()
})

test('estoque zerado aparece como "Acabou" e some quando repõe', async () => {
  const dados = criarDadosFixture(H)
  await dados.registrarSaida('p5', 2)
  const { unmount } = render(<Avisos dados={dados} hoje={H} />)
  expect(await screen.findByText('Acabou')).toBeInTheDocument()
  unmount()
  await dados.registrarEntrada('p5', 20)
  render(<Avisos dados={dados} hoje={H} />)
  await screen.findByRole('list', { name: 'Estoque baixo' })
  expect(screen.queryByText('Acabou')).toBeNull()
})

test('sem nada para avisar, diz que está tudo bem', async () => {
  const dados = criarDadosFixture(H)
  for (const p of await dados.listarProdutos()) await dados.removerProduto(p.id)
  render(<Avisos dados={dados} hoje={H} />)
  expect(await screen.findByText(/Está tudo com estoque bom/)).toBeInTheDocument()
  expect(screen.getByText('Nenhum produto perto de vencer.')).toBeInTheDocument()
})

test('quando a porta rejeita, mostra aviso amigável', async () => {
  const dados = criarDadosFixture(H)
  vi.spyOn(dados, 'listarProdutos').mockRejectedValue(new Error('rede'))
  render(<Avisos dados={dados} hoje={H} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar agora')
})
