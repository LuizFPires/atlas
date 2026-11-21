import { act, renderHook } from '@testing-library/react'
import { useTokenDoLink } from './link-instalacao'

const T = 'a'.repeat(30)

test('começa com o código que veio na abertura do app (--token=)', () => {
  const { result } = renderHook(() => useTokenDoLink({ argv: ['--tela=F02', `--token=${T}`] }))
  expect(result.current).toBe(T)
})

test('app já aberto: o código chega depois, quando o cliente clica em "Liberar o Atlas" na página', () => {
  let avisar: (t: string) => void = () => {}
  const ponte = { argv: ['--tela=F02'], aoReceberLink: (fn: (t: string) => void) => { avisar = fn } }
  const { result } = renderHook(() => useTokenDoLink(ponte))
  expect(result.current).toBe('')
  act(() => avisar(T))
  expect(result.current).toBe(T)
})

test('código fora do formato é ignorado', () => {
  let avisar: (t: string) => void = () => {}
  const { result } = renderHook(() => useTokenDoLink({ argv: [], aoReceberLink: (fn: (t: string) => void) => { avisar = fn } }))
  act(() => avisar('curto'))
  expect(result.current).toBe('')
})
