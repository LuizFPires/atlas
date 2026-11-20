import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppAcademia, LICENCA_EXEMPLO } from './AppAcademia'
import { criarGuardiaoFixture, criarGuardiaoReal } from '../../app/guardiao'
import { CHAVE_COFRE } from '../../app/ativacao-api'
import { criarPonteFixture } from '../../app/ponte'

const H = '2026-03-10'

test('licença ok: abre os alunos com aviso no topo e marca dágua do cliente', async () => {
  render(<AppAcademia guardiao={criarGuardiaoFixture('liberado')} hoje={H} />)
  expect(await screen.findByRole('heading', { name: 'Alunos' })).toBeInTheDocument()
  const aviso = screen.getByRole('note')
  expect(aviso).toHaveTextContent('Lei 9.609/98')
  expect(aviso).toHaveTextContent(LICENCA_EXEMPLO.marca)
  expect(screen.getByTestId('app-academia').firstElementChild).toBe(aviso)
  expect(screen.getByTestId('marca-dagua')).toHaveTextContent(LICENCA_EXEMPLO.cliente)
})

test('fluxo inteiro: escolhe o aluno, vê o treino, marca presença e registra evolução', async () => {
  render(<AppAcademia guardiao={criarGuardiaoFixture('liberado')} hoje={H} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Escolher Carla Mendes' }))
  expect(await screen.findByText('Agachamento')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Check-in' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Marcar presença: Carla Mendes' }))
  expect(await within(await screen.findByRole('list', { name: 'Treinaram hoje' })).findByText('Carla Mendes')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Evolução' }))
  await userEvent.type(await screen.findByLabelText(/Peso em kg/), '66')
  await userEvent.click(screen.getByRole('button', { name: 'Registrar evolução' }))
  expect(await within(await screen.findByRole('table')).findByText('10/03/2026')).toBeInTheDocument()
})

test('licença inválida: bloqueia, mostra o aviso honesto e não mostra nada do negócio', async () => {
  render(<AppAcademia guardiao={criarGuardiaoFixture('licenca_invalida')} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos confirmar a licença')
  expect(screen.queryByText('Carla Mendes')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Alunos' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Check-in' })).toBeNull()
})

test('outra empresa usando a mesma licença: bloqueia com a mensagem certa', async () => {
  render(<AppAcademia guardiao={criarGuardiaoFixture('outra_instancia')} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('empresa só')
})

test('guardião REAL (não fixture) sem ativação no cofre bloqueia o app', async () => {
  const guardiao = criarGuardiaoReal(criarPonteFixture(), { api: 'https://x.test' }, vi.fn() as unknown as typeof fetch)
  render(<AppAcademia guardiao={guardiao} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('licença')
  expect(screen.queryByText('Carla Mendes')).toBeNull()
})

test('guardião REAL com servidor dizendo ok:false bloqueia', async () => {
  const ponte = criarPonteFixture()
  await ponte.cofre.guardar(CHAVE_COFRE, JSON.stringify({ email: 'ze@x.com', token: 't', nome: 'Zé' }))
  const f = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 200 })) as unknown as typeof fetch
  render(<AppAcademia guardiao={criarGuardiaoReal(ponte, { api: 'https://x.test' }, f)} />)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(f).toHaveBeenCalled()
})

test('erro inesperado do guardião fecha o app', async () => {
  render(<AppAcademia guardiao={{ conferir: async () => { throw new Error('x') } }} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos confirmar')
})
