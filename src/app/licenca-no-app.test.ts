import { act, renderHook } from '@testing-library/react'
import { useLicencaNoApp } from './licenca-no-app'
import type { ResumoLicenca } from './licenca-resumo'

const AGORA = '2026-11-21T15:00:00.000Z'
const teste: ResumoLicenca = { tipo: 'cortesia', origem: 'degustacao', validade_em: '2026-11-24T15:00:00.000Z', vencida: false, agora: AGORA }
const paga: ResumoLicenca = { tipo: 'paga', origem: null, validade_em: null, vencida: false, agora: AGORA }
const MIN = 60_000

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
const passar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

test('lê ao abrir e mostra o contador', async () => {
  const ler = vi.fn(async () => teste)
  const { result } = renderHook(() => useLicencaNoApp(ler))
  expect(result.current.cartao).toEqual({ estado: 'ativa' }) // antes da resposta: nada de contador
  await passar(0)
  expect(result.current.cartao).toMatchObject({ estado: 'contando', titulo: 'Faltam 3 dias' })
  expect(ler).toHaveBeenCalledTimes(1)
})

test('confere de novo a cada 10 minutos e quando a janela volta ao foco', async () => {
  const ler = vi.fn(async () => teste)
  renderHook(() => useLicencaNoApp(ler))
  await passar(0)
  await passar(10 * MIN)
  expect(ler).toHaveBeenCalledTimes(2)
  await act(async () => { window.dispatchEvent(new Event('focus')) })
  expect(ler).toHaveBeenCalledTimes(3)
})

test('esperando o pagamento: confere a cada 10 s e para assim que a licença vira paga', async () => {
  let atual: ResumoLicenca = teste
  const ler = vi.fn(async () => atual)
  const { result } = renderHook(() => useLicencaNoApp(ler))
  await passar(0)
  act(() => result.current.esperarPagamento())
  await passar(10_000)
  await passar(10_000)
  expect(ler).toHaveBeenCalledTimes(3)
  atual = paga
  await passar(10_000)
  expect(result.current.cartao).toEqual({ estado: 'ativa' })
  expect(result.current.pagou).toBe(true)
  const chamadas = ler.mock.calls.length
  await passar(60_000)
  expect(ler).toHaveBeenCalledTimes(chamadas) // parou a espera rápida
})

test('pagamento que não vem: a espera rápida desiste depois de 30 minutos', async () => {
  const ler = vi.fn(async () => teste)
  const { result } = renderHook(() => useLicencaNoApp(ler))
  await passar(0)
  act(() => result.current.esperarPagamento())
  await passar(30 * MIN)
  const chamadas = ler.mock.calls.length
  await passar(5 * MIN)
  expect(ler.mock.calls.length).toBeLessThanOrEqual(chamadas + 1) // só a conferência normal de 10 em 10 minutos
  expect(result.current.pagou).toBe(false)
})

test('servidor sem resposta depois de já ter mostrado o contador: mantém o último dado bom', async () => {
  let atual: ResumoLicenca | null = teste
  const ler = vi.fn(async () => atual)
  const { result } = renderHook(() => useLicencaNoApp(ler))
  await passar(0)
  atual = null
  await passar(10 * MIN)
  expect(result.current.cartao).toMatchObject({ estado: 'contando' })
})

test('acabou de ativar o computador: dá para pedir a leitura na hora, sem esperar os 10 minutos', async () => {
  let atual: ResumoLicenca | null = null // antes de ativar o servidor não responde
  const ler = vi.fn(async () => atual)
  const { result } = renderHook(() => useLicencaNoApp(ler))
  await passar(0)
  expect(result.current.cartao).toEqual({ estado: 'ativa' })
  atual = teste
  await act(async () => { await result.current.conferir() })
  expect(result.current.cartao).toMatchObject({ estado: 'contando', titulo: 'Faltam 3 dias' })
})
