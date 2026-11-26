import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Clientes } from './Clientes'
import { criarDadosFixture, validarCliente } from './dados'

test('lista, cadastra e a pessoa nova aparece na lista', async () => {
  const dados = criarDadosFixture()
  render(<Clientes dados={dados} />)
  expect(await screen.findByText('João Pereira')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Falar' }).length).toBeGreaterThanOrEqual(2)
  await userEvent.type(screen.getByLabelText(/Nome do cliente/), 'Paulo Alves')
  await userEvent.type(screen.getByLabelText(/Telefone/), '11 95555-1234')
  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
  expect(await screen.findByText('Paulo Alves')).toBeInTheDocument()
  expect(screen.getByText('(11) 95555-1234')).toBeInTheDocument()
  expect(screen.getByLabelText(/Nome do cliente/)).toHaveValue('')
})

test('valida nome, telefone e repetido', async () => {
  expect(validarCliente({ nome: 'A', telefone: '11912345678' })).toMatch(/nome/)
  expect(validarCliente({ nome: 'Ana', telefone: '123' })).toMatch(/DDD/)
  render(<Clientes dados={criarDadosFixture()} />)
  await screen.findByText('João Pereira')
  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('nome')
  await userEvent.type(screen.getByLabelText(/Nome do cliente/), 'Outro João')
  await userEvent.type(screen.getByLabelText(/Telefone/), '11912345678')
  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Já existe')
})

test('mostra o histórico de atendimentos da ficha', async () => {
  render(<Clientes dados={criarDadosFixture()} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Ver ficha de João Pereira' }))
  const ficha = await screen.findByRole('region', { name: 'Ficha de João Pereira' })
  expect(ficha.querySelectorAll('li')).toHaveLength(2)
  await userEvent.click(screen.getByRole('button', { name: 'Ver ficha de Rafael Souza' }))
  expect(await screen.findByText('Ainda não teve nenhum atendimento.')).toBeInTheDocument()
})

test('quando a porta rejeita, mostra aviso amigável', async () => {
  const dados = criarDadosFixture()
  vi.spyOn(dados, 'listarClientes').mockRejectedValue(new Error('rede'))
  render(<Clientes dados={dados} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.')
})
