import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRestaurante, LICENCA_EXEMPLO } from './AppRestaurante'
import { criarGuardiaoFixture, criarGuardiaoReal } from '../../app/guardiao'
import { CHAVE_COFRE } from '../../app/ativacao-api'
import { criarPonteFixture } from '../../app/ponte'

test('licença ok: abre o cardápio com aviso no topo e marca dágua do cliente', async () => {
  render(<AppRestaurante guardiao={criarGuardiaoFixture('liberado')} />)
  expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
  const aviso = screen.getByRole('note')
  expect(aviso).toHaveTextContent('Lei 9.609/98')
  expect(aviso).toHaveTextContent(LICENCA_EXEMPLO.marca)
  expect(screen.getByTestId('app-restaurante').firstElementChild).toBe(aviso)
  expect(screen.getByTestId('marca-dagua')).toHaveTextContent(LICENCA_EXEMPLO.cliente)
})

test('fluxo inteiro: pedido vai para a cozinha e a cozinha marca pronto', async () => {
  render(<AppRestaurante guardiao={criarGuardiaoFixture('liberado')} />)
  await screen.findByRole('heading', { name: 'Cardápio' })
  await userEvent.click(screen.getByRole('button', { name: 'Pedidos' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Mandar para a cozinha: Mesa 7' }))
  await userEvent.click(screen.getByRole('button', { name: 'Cozinha' }))
  expect(await screen.findByRole('region', { name: 'Preparar Mesa 7' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Marcar pronto: Mesa 7' }))
  expect(screen.queryByRole('region', { name: 'Preparar Mesa 7' })).toBeNull()
})

test('licença inválida: bloqueia, mostra o aviso honesto e não mostra nada do negócio', async () => {
  render(<AppRestaurante guardiao={criarGuardiaoFixture('licenca_invalida')} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos confirmar a licença')
  expect(screen.queryByText('Feijoada completa')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Cardápio' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Cozinha' })).toBeNull()
})

test('outra empresa usando a mesma licença: bloqueia com a mensagem certa', async () => {
  render(<AppRestaurante guardiao={criarGuardiaoFixture('outra_instancia')} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('empresa só')
})

test('guardião REAL (não fixture) sem ativação no cofre bloqueia o app', async () => {
  const guardiao = criarGuardiaoReal(criarPonteFixture(), { api: 'https://x.test' }, vi.fn() as unknown as typeof fetch)
  render(<AppRestaurante guardiao={guardiao} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('licença')
  expect(screen.queryByText('Feijoada completa')).toBeNull()
})

test('guardião REAL com servidor dizendo ok:false bloqueia', async () => {
  const ponte = criarPonteFixture()
  await ponte.cofre.guardar(CHAVE_COFRE, JSON.stringify({ email: 'ze@x.com', token: 't', nome: 'Zé' }))
  const f = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 200 })) as unknown as typeof fetch
  render(<AppRestaurante guardiao={criarGuardiaoReal(ponte, { api: 'https://x.test' }, f)} />)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(f).toHaveBeenCalled()
})

test('erro inesperado do guardião fecha o app', async () => {
  render(<AppRestaurante guardiao={{ conferir: async () => { throw new Error('x') } }} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos confirmar')
})
