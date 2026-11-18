import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { telaInicial as telaDoInstalador } from '../../instalador/passos.ts'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { useImpedirSono } from './sono'
import { flag, telaInicial } from './tela'

const casos: [string[], boolean][] = [[[], false], [[], true], [['--tela=F02'], true], [['--tela=F12'], false], [['--x', '--tela=F05'], false]]

test('a tela inicial segue exatamente a regra do instalador (M8)', () => {
  for (const [argv, ativado] of casos) expect(telaInicial(argv, ativado)).toBe(telaDoInstalador(argv, ativado))
  expect(telaInicial([])).toBe('F02')
  expect(telaInicial([], true)).toBe('F05')
})

test('flag lê --nome=valor', () => {
  expect(flag(['--tela=F02', '--token=abc=='], 'token')).toBe('abc==')
  expect(flag(['--tela=F02'], 'token')).toBe('')
})

const montar = (ponte: ReturnType<typeof criarPonteFixture>) =>
  render(<TemaProvider><AppDesktop ponte={ponte} api={{ pedirCodigo: async () => ({ ok: true }), confirmar: async () => ({ ok: true, nome: 'Zé' }) }} /></TemaProvider>)

test('computador sem ativação abre na ativação (F02)', async () => {
  montar(criarPonteFixture())
  expect(await screen.findByRole('heading', { name: /Vamos ativar o seu Atlas/ })).toBeInTheDocument()
})

test('computador já ativado abre em Minhas obras (F05)', async () => {
  montar(criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) })))
  expect(await screen.findByRole('heading', { name: /Bem-vindo ao Atlas/ })).toBeInTheDocument()
})

test('--tela=F02 manda, mesmo já ativado', async () => {
  montar(criarPonteFixture(['--tela=F02'], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't' }) })))
  expect(await screen.findByRole('heading', { name: /Vamos ativar/ })).toBeInTheDocument()
})

test('impede o computador de dormir enquanto ativo e solta ao sair', async () => {
  const impedirSono = vi.fn(async () => {})
  const { rerender, unmount } = renderHook(({ a }) => useImpedirSono({ impedirSono }, a), { initialProps: { a: false } })
  expect(impedirSono).not.toHaveBeenCalled()
  rerender({ a: true })
  await waitFor(() => expect(impedirSono).toHaveBeenLastCalledWith(true))
  unmount()
  expect(impedirSono).toHaveBeenLastCalledWith(false)
})
