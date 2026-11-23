import { act, renderHook, waitFor } from '@testing-library/react'
import { useVoz } from './voz'
import { estadoVoz, RECADO_NAO_ESCREVI, RECADO_SEM_MICROFONE, usarMotorDeVoz, type Gravacao, type Transcritor } from './voz-motor'

const AUDIO = new Float32Array([0.1, 0.2])
function falsos({ texto = 'quero uma agenda', falhaMic = false, falhaTexto = false } = {}) {
  const chamadas: string[] = []
  const t: Transcritor = {
    preparar: async (p) => { chamadas.push('preparar'); p(50); p(100) },
    transcrever: async (a) => { chamadas.push(`transcrever:${a.length}`); if (falhaTexto) throw new Error('x'); return texto },
  }
  const g = async (): Promise<Gravacao> => {
    if (falhaMic) throw new Error('NotAllowedError')
    chamadas.push('gravar')
    return { parar: async () => { chamadas.push('parar'); return AUDIO }, cancelar: () => chamadas.push('cancelar') }
  }
  usarMotorDeVoz(t, g, { forcar: true })
  return chamadas
}
afterEach(() => usarMotorDeVoz(null, undefined, { forcar: false }))

test('no Atlas instalado: grava até apertar de novo, transcreve no computador e entrega o texto', async () => {
  const chamadas = falsos()
  const falado: string[] = []
  const { result } = renderHook(() => useVoz((t) => falado.push(t)))
  expect(result.current.suportado).toBe(true)
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(result.current.gravando).toBe(true))
  expect(estadoVoz().fase).toBe('ouvindo')
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(falado).toEqual(['quero uma agenda']))
  expect(result.current.gravando).toBe(false)
  expect(chamadas).toContain('transcrever:2')
  expect(estadoVoz().fase).toBe('livre')
})

test('microfone bloqueado: não fica "ouvindo" de mentira, mostra o recado', async () => {
  falsos({ falhaMic: true })
  const { result } = renderHook(() => useVoz(() => {}))
  await act(async () => { result.current.alternar() })
  expect(result.current.gravando).toBe(false)
  expect(estadoVoz()).toMatchObject({ fase: 'erro', recado: RECADO_SEM_MICROFONE })
})

test('se não conseguir transcrever, avisa e não inventa texto', async () => {
  falsos({ falhaTexto: true })
  const falado: string[] = []
  const { result } = renderHook(() => useVoz((t) => falado.push(t)))
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(result.current.gravando).toBe(true))
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(estadoVoz()).toMatchObject({ fase: 'erro', recado: RECADO_NAO_ESCREVI }))
  expect(falado).toEqual([])
})

test('fala vazia (silêncio) não escreve nada no campo', async () => {
  falsos({ texto: '   ' })
  const falado: string[] = []
  const { result } = renderHook(() => useVoz((t) => falado.push(t)))
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(result.current.gravando).toBe(true))
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(estadoVoz().fase).toBe('livre'))
  expect(falado).toEqual([])
})

test('sair da tela no meio da gravação desliga o microfone', async () => {
  const chamadas = falsos()
  const { result, unmount } = renderHook(() => useVoz(() => {}))
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(result.current.gravando).toBe(true))
  unmount()
  expect(chamadas).toContain('cancelar')
})

// Luiz, 23/11/2026: "vai falando e o Atlas vai escrevendo". O texto aparece no campo ANTES de a pessoa parar de gravar.
test('enquanto a pessoa fala, o trecho já falado aparece no campo antes de parar a gravação', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    const TAXA = 16000
    const voz = Float32Array.from({ length: 7 * TAXA }, (_, i) => Math.sin(i / 3) * 0.5)
    const ateAgora = new Float32Array(voz.length + Math.round(0.6 * TAXA) + 2 * TAXA)
    ateAgora.set(voz)
    ateAgora.set(voz.subarray(0, 2 * TAXA), voz.length + Math.round(0.6 * TAXA))
    let n = 0
    const t: Transcritor = { preparar: async () => {}, transcrever: async () => (++n === 1 ? 'quero uma agenda' : 'para a barbearia') }
    usarMotorDeVoz(t, async () => ({ parar: async () => ateAgora, cancelar: () => {}, parcial: async () => ateAgora }), { forcar: true })
    const falado: string[] = []
    const { result } = renderHook(() => useVoz((x) => falado.push(x)))
    await act(async () => { result.current.alternar() })
    await waitFor(() => expect(result.current.gravando).toBe(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
    expect(result.current.gravando).toBe(true)
    expect(falado).toEqual(['quero uma agenda'])
    await act(async () => { result.current.alternar() })
    await waitFor(() => expect(falado).toEqual(['quero uma agenda', 'para a barbearia']))
  } finally { vi.useRealTimers() }
})
