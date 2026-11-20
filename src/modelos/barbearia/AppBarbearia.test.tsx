import { render, screen } from '@testing-library/react'
import { AppBarbearia, LICENCA_EXEMPLO } from './AppBarbearia'
import { criarGuardiaoFixture, criarGuardiaoReal } from '../../app/guardiao'
import { CHAVE_COFRE } from '../../app/ativacao-api'
import { criarPonteFixture } from '../../app/ponte'

test('licença ok: abre a agenda com aviso no topo e marca dágua do cliente', async () => {
  render(<AppBarbearia guardiao={criarGuardiaoFixture('liberado')} />)
  expect(await screen.findByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument()
  const aviso = screen.getByRole('note')
  expect(aviso).toHaveTextContent('Lei 9.609/98')
  expect(aviso).toHaveTextContent(LICENCA_EXEMPLO.marca)
  expect(screen.getByTestId('app-barbearia').firstElementChild).toBe(aviso)
  expect(screen.getByTestId('marca-dagua')).toHaveTextContent(LICENCA_EXEMPLO.cliente)
})

test('licença inválida: bloqueia, mostra o aviso honesto e não mostra nada do negócio', async () => {
  render(<AppBarbearia guardiao={criarGuardiaoFixture('licenca_invalida')} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos confirmar a licença')
  expect(screen.queryByText('João Pereira')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Agenda de hoje' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Clientes' })).toBeNull()
})

test('outra empresa usando a mesma licença: bloqueia com a mensagem certa', async () => {
  render(<AppBarbearia guardiao={criarGuardiaoFixture('outra_instancia')} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('empresa só')
})

test('guardião REAL (não fixture) sem ativação no cofre bloqueia o app', async () => {
  const guardiao = criarGuardiaoReal(criarPonteFixture(), { api: 'https://x.test' }, vi.fn() as unknown as typeof fetch)
  render(<AppBarbearia guardiao={guardiao} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('licença')
  expect(screen.queryByText('João Pereira')).toBeNull()
})

test('guardião REAL com servidor dizendo ok:false bloqueia', async () => {
  const ponte = criarPonteFixture()
  await ponte.cofre.guardar(CHAVE_COFRE, JSON.stringify({ email: 'ze@x.com', token: 't', nome: 'Zé' }))
  const f = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 200 })) as unknown as typeof fetch
  render(<AppBarbearia guardiao={criarGuardiaoReal(ponte, { api: 'https://x.test' }, f)} />)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(f).toHaveBeenCalled()
})

test('erro inesperado do guardião fecha o app', async () => {
  render(<AppBarbearia guardiao={{ conferir: async () => { throw new Error('x') } }} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos confirmar')
})
