import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cardapio } from './Cardapio'
import { criarDadosFixture, formatarPreco, precoParaCentavos, validarItem } from './dados'

test('preço em texto vira centavos e volta para real', () => {
  expect(precoParaCentavos('25,90')).toBe(2590)
  expect(precoParaCentavos('R$ 1.234,50')).toBe(123450)
  expect(precoParaCentavos('abc')).toBe(0)
  expect(formatarPreco(2590)).toBe('R$ 25,90')
  expect(validarItem({ nome: 'X', precoCentavos: 100, categoria: 'Prato' })).toMatch(/nome/)
  expect(validarItem({ nome: 'Arroz', precoCentavos: 0, categoria: 'Prato' })).toMatch(/preço/)
})

test('cria um item e ele aparece com o preço', async () => {
  render(<Cardapio dados={criarDadosFixture()} />)
  expect(await screen.findByText('Feijoada completa')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Falar' }).length).toBeGreaterThanOrEqual(2)
  await userEvent.type(screen.getByLabelText(/Nome do prato/), 'Caipirinha')
  await userEvent.type(screen.getByLabelText(/Preço/), '18,50')
  await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'Bebida')
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }))
  expect(await screen.findByText('Caipirinha')).toBeInTheDocument()
  expect(screen.getByText('R$ 18,50')).toBeInTheDocument()
  expect(screen.getByLabelText(/Nome do prato/)).toHaveValue('')
})

test('edita um item', async () => {
  render(<Cardapio dados={criarDadosFixture()} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Editar Suco de laranja' }))
  const preco = screen.getByLabelText(/Preço/)
  await userEvent.clear(preco)
  await userEvent.type(preco, '12')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar item' }))
  expect(await screen.findByText('R$ 12,00')).toBeInTheDocument()
})

test('marca esgotado e volta a disponível', async () => {
  render(<Cardapio dados={criarDadosFixture()} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Marcar esgotado: Suco de laranja' }))
  expect(await screen.findByRole('button', { name: 'Marcar disponível: Suco de laranja' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Marcar disponível: Suco de laranja' }))
  expect(await screen.findByRole('button', { name: 'Marcar esgotado: Suco de laranja' })).toBeInTheDocument()
})

test('remove um item e recusa nome repetido', async () => {
  render(<Cardapio dados={criarDadosFixture()} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Remover Suco de laranja' }))
  expect(screen.queryByText('Suco de laranja')).toBeNull()
  await userEvent.type(screen.getByLabelText(/Nome do prato/), 'feijoada completa')
  await userEvent.type(screen.getByLabelText(/Preço/), '10')
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Já existe')
})

test('quando a porta rejeita, mostra aviso amigável', async () => {
  const dados = criarDadosFixture()
  vi.spyOn(dados, 'listarCardapio').mockRejectedValue(new Error('rede'))
  render(<Cardapio dados={dados} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar/salvar agora. Tente de novo.')
})
