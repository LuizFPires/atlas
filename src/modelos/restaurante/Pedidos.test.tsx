import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pedidos } from './Pedidos'
import { criarDadosFixture, totalDoPedido } from './dados'

test('abre pedido, soma o total e manda para a cozinha', async () => {
  render(<Pedidos dados={criarDadosFixture()} />)
  await screen.findByText('Mesa 4')
  expect(screen.getByTestId('total-p1')).toHaveTextContent('R$ 108,00')
  await userEvent.type(screen.getByLabelText(/Mesa ou nome do cliente/), 'Mesa 9')
  await userEvent.click(screen.getByRole('button', { name: 'Abrir pedido' }))
  const pedido = await screen.findByRole('region', { name: 'Pedido Mesa 9' })
  expect(within(pedido).getByText('Ainda sem itens.')).toBeInTheDocument()
  await userEvent.selectOptions(within(pedido).getByLabelText('Item para o pedido Mesa 9'), 'i2')
  await userEvent.click(within(pedido).getByRole('button', { name: 'Adicionar ao pedido Mesa 9' }))
  await userEvent.click(within(pedido).getByRole('button', { name: 'Adicionar ao pedido Mesa 9' }))
  await userEvent.selectOptions(within(pedido).getByLabelText('Item para o pedido Mesa 9'), 'i4')
  await userEvent.click(within(pedido).getByRole('button', { name: 'Adicionar ao pedido Mesa 9' }))
  expect(await within(pedido).findByText(/2x Feijoada completa/)).toBeInTheDocument()
  expect(within(pedido).getByText('R$ 99,00')).toBeInTheDocument()
  await userEvent.click(within(pedido).getByRole('button', { name: 'Mandar para a cozinha: Mesa 9' }))
  expect(await within(pedido).findByText('Na cozinha', { selector: '[data-testid^="status-"]' })).toBeInTheDocument()
  expect(within(pedido).queryByRole('button', { name: /Adicionar ao pedido/ })).toBeNull()
})

test('item esgotado não aparece para escolher e pedido vazio não vai para a cozinha', async () => {
  const dados = criarDadosFixture()
  await dados.definirDisponivel('i4', false)
  const novo = await dados.abrirPedido('Balcão')
  if (!novo.ok) throw new Error('x')
  render(<Pedidos dados={dados} />)
  const pedido = await screen.findByRole('region', { name: 'Pedido Balcão' })
  expect(within(pedido).queryByRole('option', { name: /Suco de laranja/ })).toBeNull()
  await userEvent.click(within(pedido).getByRole('button', { name: 'Mandar para a cozinha: Balcão' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('pelo menos um item')
})

test('o status só anda para a frente e o preço da linha não muda com o cardápio', async () => {
  const dados = criarDadosFixture()
  const r = await dados.mudarStatus('p2', 'pronto')
  expect(r.ok).toBe(false)
  await dados.editarItem('i1', { nome: 'Bolinho de bacalhau', precoCentavos: 9900, categoria: 'Entrada' })
  const p2 = (await dados.listarPedidos()).find((p) => p.id === 'p2')!
  expect(totalDoPedido(p2)).toBe(2800)
})

test('quando a porta rejeita, mostra aviso amigável', async () => {
  const dados = criarDadosFixture()
  vi.spyOn(dados, 'listarPedidos').mockRejectedValue(new Error('rede'))
  render(<Pedidos dados={dados} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.')
})
