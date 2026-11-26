import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Estoque } from './Estoque'
import { criarDadosFixture, formatarPreco, precoParaCentavos, validarProduto } from './dados'

const base = { nome: 'Feijão', precoCentavos: 800, quantidade: 5, validade: '' }

test('validação: preço > 0 e quantidade >= 0', () => {
  expect(validarProduto({ ...base, precoCentavos: 0 })).toMatch(/preço/)
  expect(validarProduto({ ...base, quantidade: -1 })).toMatch(/quantidade/)
  expect(validarProduto({ ...base, nome: 'X' })).toMatch(/nome/)
  expect(validarProduto({ ...base, validade: '2026-13-40' })).toMatch(/validade/)
  expect(validarProduto({ ...base, quantidade: 0 })).toBeNull()
  expect(precoParaCentavos('R$ 1.234,50')).toBe(123450)
  expect(formatarPreco(450)).toBe('R$ 4,50')
})

test('cria um produto e ele aparece com preço e quantidade', async () => {
  render(<Estoque dados={criarDadosFixture('2026-01-10')} />)
  expect(await screen.findByText('Arroz 5 kg')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Falar' }).length).toBeGreaterThanOrEqual(2)
  await userEvent.type(screen.getByLabelText(/Nome do produto/), 'Feijão preto')
  await userEvent.type(screen.getByLabelText(/Preço/), '8,50')
  await userEvent.clear(within(screen.getByRole('form', { name: 'Novo produto' })).getByLabelText(/^Quantidade/))
  await userEvent.type(within(screen.getByRole('form', { name: 'Novo produto' })).getByLabelText(/^Quantidade/), '7')
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar produto' }))
  const item = (await screen.findByText('Feijão preto')).closest('li') as HTMLElement
  expect(within(item).getByText('R$ 8,50')).toBeInTheDocument()
  expect(within(item).getByText('7')).toBeInTheDocument()
})

test('edita um produto', async () => {
  render(<Estoque dados={criarDadosFixture('2026-01-10')} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Editar Café 500 g' }))
  const preco = screen.getByLabelText(/Preço/)
  await userEvent.clear(preco)
  await userEvent.type(preco, '20')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))
  expect(await screen.findByText('R$ 20,00')).toBeInTheDocument()
})

test('entrada soma e saída subtrai, sem passar do que tem', async () => {
  render(<Estoque dados={criarDadosFixture('2026-01-10')} />)
  const li = (await screen.findByText('Sabão em pó')).closest('li') as HTMLElement // tem 2
  const campo = within(li).getByLabelText(/Quantidade para ajustar/)
  await userEvent.clear(campo); await userEvent.type(campo, '5')
  await userEvent.click(within(li).getByRole('button', { name: 'Entrada: Sabão em pó' }))
  expect(await within(li).findByText('7')).toBeInTheDocument()
  await userEvent.click(within(li).getByRole('button', { name: 'Saída: Sabão em pó' }))
  expect(await within(li).findByText('2')).toBeInTheDocument()
  await userEvent.clear(campo); await userEvent.type(campo, '9')
  await userEvent.click(within(li).getByRole('button', { name: 'Saída: Sabão em pó' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Só tem 2')
  expect(within(li).getByText('2')).toBeInTheDocument()
})

test('remove um produto e recusa nome repetido e preço zero', async () => {
  render(<Estoque dados={criarDadosFixture('2026-01-10')} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Remover Sabão em pó' }))
  expect(screen.queryByText('Sabão em pó')).toBeNull()
  await userEvent.type(screen.getByLabelText(/Nome do produto/), 'arroz 5 kg')
  await userEvent.type(screen.getByLabelText(/Preço/), '10')
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar produto' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Já existe')
  await userEvent.clear(screen.getByLabelText(/Nome do produto/))
  await userEvent.type(screen.getByLabelText(/Nome do produto/), 'Sal')
  await userEvent.clear(screen.getByLabelText(/Preço/))
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar produto' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('preço')
})

test('quando a porta rejeita, mostra aviso amigável', async () => {
  const dados = criarDadosFixture()
  vi.spyOn(dados, 'listarProdutos').mockRejectedValue(new Error('rede'))
  render(<Estoque dados={dados} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.')
})
