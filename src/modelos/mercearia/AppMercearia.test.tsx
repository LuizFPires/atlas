import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppMercearia, LICENCA_EXEMPLO } from './AppMercearia'
import { criarGuardiaoFixture, criarGuardiaoReal } from '../../app/guardiao'
import { CHAVE_COFRE } from '../../app/ativacao-api'
import { criarPonteFixture } from '../../app/ponte'

test('licença ok: abre o cardápio com aviso no topo e marca dágua do cliente', async () => {
  render(<AppMercearia guardiao={criarGuardiaoFixture('liberado')} />)
  expect(await screen.findByRole('heading', { name: 'Estoque' })).toBeInTheDocument()
  const aviso = screen.getByRole('note')
  expect(aviso).toHaveTextContent('Lei 9.609/98')
  expect(aviso).toHaveTextContent(LICENCA_EXEMPLO.marca)
  expect(screen.getByTestId('app-mercearia').firstElementChild).toBe(aviso)
  expect(screen.getByTestId('marca-dagua')).toHaveTextContent(LICENCA_EXEMPLO.cliente)
})

test('fluxo inteiro: vende no balcão, o estoque baixa e o aviso de estoque baixo aparece', async () => {
  render(<AppMercearia guardiao={criarGuardiaoFixture('liberado')} />)
  await screen.findByRole('heading', { name: 'Estoque' })
  await userEvent.click(screen.getByRole('button', { name: 'Vender' }))
  const add = await screen.findByRole('button', { name: 'Adicionar à venda: Sabão em pó' })
  await userEvent.click(add); await userEvent.click(add)
  await userEvent.click(screen.getByRole('button', { name: 'Fechar venda' }))
  expect(await screen.findByText(/Venda fechada: R\$ 25,00/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Imprimir cupom' }))
  expect(await screen.findByText(/nada foi impresso de verdade/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Avisos' }))
  expect(await within(await screen.findByRole('list', { name: 'Estoque baixo' })).findByText('Acabou')).toBeInTheDocument()
})

test('licença inválida: bloqueia, mostra o aviso honesto e não mostra nada do negócio', async () => {
  render(<AppMercearia guardiao={criarGuardiaoFixture('licenca_invalida')} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos confirmar a licença')
  expect(screen.queryByText('Arroz 5 kg')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Estoque' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Vender' })).toBeNull()
})

test('outra empresa usando a mesma licença: bloqueia com a mensagem certa', async () => {
  render(<AppMercearia guardiao={criarGuardiaoFixture('outra_instancia')} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('empresa só')
})

test('guardião REAL (não fixture) sem ativação no cofre bloqueia o app', async () => {
  const guardiao = criarGuardiaoReal(criarPonteFixture(), { api: 'https://x.test' }, vi.fn() as unknown as typeof fetch)
  render(<AppMercearia guardiao={guardiao} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('licença')
  expect(screen.queryByText('Arroz 5 kg')).toBeNull()
})

test('guardião REAL com servidor dizendo ok:false bloqueia', async () => {
  const ponte = criarPonteFixture()
  await ponte.cofre.guardar(CHAVE_COFRE, JSON.stringify({ email: 'ze@x.com', token: 't', nome: 'Zé' }))
  const f = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 200 })) as unknown as typeof fetch
  render(<AppMercearia guardiao={criarGuardiaoReal(ponte, { api: 'https://x.test' }, f)} />)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(f).toHaveBeenCalled()
})

test('erro inesperado do guardião fecha o app', async () => {
  render(<AppMercearia guardiao={{ conferir: async () => { throw new Error('x') } }} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos confirmar')
})
