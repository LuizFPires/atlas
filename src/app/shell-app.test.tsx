import userEvent from '@testing-library/user-event'
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

test('com obra em andamento a tela inicial é Retomar (F12); sem ela, Obras (F05); a flag e a ativação mandam primeiro (M21)', () => {
  expect(telaInicial([], true, true)).toBe('F12')
  expect(telaInicial([], true, false)).toBe('F05')
  expect(telaInicial([], false, true)).toBe('F02')
  expect(telaInicial(['--tela=F05'], true, true)).toBe('F05')
  for (const [argv, ativado] of casos) for (const obra of [false, true]) expect(telaInicial(argv, ativado, obra)).toBe(telaDoInstalador(argv, ativado, obra))
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
  expect(await screen.findByRole('heading', { name: /Tudo pronto, Zé/ })).toBeInTheDocument()
})

// O instalador reabre o Atlas com --tela=F02 também depois de cada atualização silenciosa (atlas-install.nsh).
// Já ativado, a flag é ignorada: abre em Minhas obras (decisão de 23/11/2026; antes caía na ativação).
test('--tela=F02 num computador já ativado (reabertura depois de atualizar): abre em Minhas obras', async () => {
  montar(criarPonteFixture(['--tela=F02', '--instalador=Atlas-0.1.42.exe'], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't' }) })))
  expect(await screen.findByRole('link', { name: 'Minhas obras' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('heading', { name: /Vamos ativar/ })).not.toBeInTheDocument()
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

const ativado = () => criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) }))

test('em Minhas obras, "Já tenho um protótipo" leva à tela F06c (trazer o protótipo) e dá para voltar', async () => {
  montar(ativado())
  await userEvent.click(await screen.findByRole('button', { name: 'Já tenho um protótipo' }))
  expect(screen.getByRole('heading', { name: /Fez o protótipo em outra IA/ })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Voltar/ }))
  expect(screen.getByRole('heading', { name: /Tudo pronto, Zé/ })).toBeInTheDocument()
})
