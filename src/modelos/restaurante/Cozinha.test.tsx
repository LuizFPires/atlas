import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cozinha } from './Cozinha'
import { criarComandaFixture, textoDaComanda } from './comanda'
import { criarDadosFixture } from './dados'

test('lista só os pedidos na cozinha, com os itens a preparar', async () => {
  render(<Cozinha dados={criarDadosFixture()} />)
  const mesa4 = await screen.findByRole('region', { name: 'Preparar Mesa 4' })
  expect(mesa4).toHaveTextContent('2x Feijoada completa')
  expect(mesa4).toHaveTextContent('2x Suco de laranja')
  expect(screen.queryByText('Mesa 7')).toBeNull()
})

test('marcar pronto tira o pedido da fila e muda o status', async () => {
  const dados = criarDadosFixture()
  render(<Cozinha dados={dados} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Marcar pronto: Mesa 4' }))
  expect(await screen.findByText(/Nenhum pedido na cozinha/)).toBeInTheDocument()
  expect((await dados.listarPedidos()).find((p) => p.id === 'p1')?.status).toBe('pronto')
})

test('a comanda é só uma porta fixture: prepara o texto e avisa que não imprimiu de verdade', async () => {
  const dados = criarDadosFixture()
  const comanda = criarComandaFixture()
  render(<Cozinha dados={dados} comanda={comanda} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Imprimir comanda: Mesa 4' }))
  expect(await screen.findByRole('status')).toHaveTextContent('ainda não sai na impressora de verdade')
  expect(comanda.impressas[0]).toBe(textoDaComanda((await dados.listarPedidos())[0]))
  expect(comanda.impressas[0]).toContain('2x Feijoada completa')
})

test('quando a porta rejeita, mostra aviso amigável', async () => {
  const dados = criarDadosFixture()
  vi.spyOn(dados, 'listarPedidos').mockRejectedValue(new Error('rede'))
  render(<Cozinha dados={dados} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.')
})
