import { act, renderHook } from '@testing-library/react'
import { useVoz } from './voz'

class Rec {
  static todas: Rec[] = []
  lang = ''; continuous = false; interimResults = false
  onresult: ((e: unknown) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e?: { error?: string }) => void) | null = null
  iniciou = 0; parou = 0
  constructor() { Rec.todas.push(this) }
  start() { this.iniciou++ }
  stop() { this.parou++; this.onend?.() }
}
const w = window as unknown as { SpeechRecognition?: unknown }
beforeEach(() => { Rec.todas = []; w.SpeechRecognition = Rec })
afterEach(() => { delete w.SpeechRecognition })

test('fica ouvindo mesmo quando a pessoa faz pausa: o navegador encerra e o Atlas religa sozinho', () => {
  const { result } = renderHook(() => useVoz(() => {}))
  act(() => result.current.alternar())
  expect(Rec.todas[0].continuous).toBe(true)
  act(() => { Rec.todas[0].onend?.() }) // silêncio: o navegador encerrou por conta própria
  expect(result.current.gravando).toBe(true)
  const iniciosDepois = Rec.todas.reduce((n, r) => n + r.iniciou, 0)
  expect(iniciosDepois).toBe(2)
})

test('pausa sem fala ("no-speech") também não desliga', () => {
  const { result } = renderHook(() => useVoz(() => {}))
  act(() => result.current.alternar())
  act(() => { Rec.todas[0].onerror?.({ error: 'no-speech' }); Rec.todas[0].onend?.() })
  expect(result.current.gravando).toBe(true)
})

test('só para quando a pessoa aperta de novo', () => {
  const { result } = renderHook(() => useVoz(() => {}))
  act(() => result.current.alternar())
  act(() => result.current.alternar())
  expect(result.current.gravando).toBe(false)
  expect(Rec.todas.reduce((n, r) => n + r.iniciou, 0)).toBe(1)
})

test('microfone bloqueado ("not-allowed") desliga e não fica tentando', () => {
  const { result } = renderHook(() => useVoz(() => {}))
  act(() => result.current.alternar())
  act(() => { Rec.todas[0].onerror?.({ error: 'not-allowed' }); Rec.todas[0].onend?.() })
  expect(result.current.gravando).toBe(false)
  expect(Rec.todas.reduce((n, r) => n + r.iniciou, 0)).toBe(1)
})
