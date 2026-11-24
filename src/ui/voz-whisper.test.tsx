import { act, renderHook, waitFor } from '@testing-library/react'
import { useVoz } from './voz'
import { estadoVoz, RECADO_NAO_ENTENDI, RECADO_NAO_ESCREVI, RECADO_SEM_MICROFONE, RECADO_SEM_SOM, usarMotorDeVoz, type Gravacao, type Transcritor } from './voz-motor'

const AUDIO = new Float32Array([0.1, 0.2])
function falsos({ texto = 'quero uma agenda', falhaMic = false, falhaTexto = false, audio = AUDIO } = {}) {
  const chamadas: string[] = []
  const t: Transcritor = {
    preparar: async (p) => { chamadas.push('preparar'); p(50); p(100) },
    transcrever: async (a) => { chamadas.push(`transcrever:${a.length}`); if (falhaTexto) throw new Error('x'); return texto },
  }
  const g = async (): Promise<Gravacao> => {
    if (falhaMic) throw new Error('NotAllowedError')
    chamadas.push('gravar')
    return { parar: async () => { chamadas.push('parar'); return audio }, cancelar: () => chamadas.push('cancelar') }
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

test('o Whisper não escreveu nada: não põe nada no campo e avisa com calma (antes sumia calado)', async () => {
  falsos({ texto: '   ' })
  const falado: string[] = []
  const { result } = renderHook(() => useVoz((t) => falado.push(t)))
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(result.current.gravando).toBe(true))
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(estadoVoz()).toMatchObject({ fase: 'erro', recado: RECADO_NAO_ENTENDI }))
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

// Luiz, 23/11/2026: "essa transcrição tem que estar bem rápida, sem delay na fala". Um Whisper pequeno escreve um rascunho
// ao vivo (a cada ~1 s) do trecho ainda não confirmado; o Whisper bom confirma e o texto vai para o campo.
test('rascunho ao vivo: o trecho que ainda não foi confirmado aparece em ~1 s, pelo modelo rápido', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    const TAXA = 16000
    const ateAgora = Float32Array.from({ length: 2 * TAXA }, (_, i) => Math.sin(i / 3) * 0.5)
    const bom: Transcritor = { preparar: async () => {}, transcrever: async () => 'texto bom' }
    const rapidos: number[] = []
    const rapido: Transcritor = { preparar: async () => {}, transcrever: async (a) => { rapidos.push(a.length); return 'quero uma agen' } }
    usarMotorDeVoz(bom, async () => ({ parar: async () => ateAgora, cancelar: () => {}, parcial: async () => ateAgora }), { forcar: true, rapido })
    const { result } = renderHook(() => useVoz(() => {}))
    await act(async () => { result.current.alternar() })
    await waitFor(() => expect(result.current.gravando).toBe(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(1300) })
    expect(estadoVoz()).toMatchObject({ fase: 'ouvindo', rascunho: 'quero uma agen' })
    expect(rapidos[0]).toBe(2 * TAXA) // só o trecho ainda não confirmado (aqui, tudo)
    await act(async () => { result.current.alternar() })
    await waitFor(() => expect(estadoVoz().fase).toBe('livre'))
    expect(estadoVoz().rascunho).toBeUndefined()
  } finally { vi.useRealTimers() }
})


// Luiz, 24/11/2026: "não está funcionando a função de ouvir e transcrever": o aviso sumia sem escrever nada e sem dizer por quê.
test('o microfone mandou só silêncio: diz isso (não some calado) e não chama o Whisper', async () => {
  const chamadas = falsos({ audio: new Float32Array(16000) })
  const falado: string[] = []
  const { result } = renderHook(() => useVoz((t) => falado.push(t)))
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(result.current.gravando).toBe(true))
  await act(async () => { result.current.alternar() })
  await waitFor(() => expect(estadoVoz()).toMatchObject({ fase: 'erro', recado: RECADO_SEM_SOM }))
  expect(falado).toEqual([])
  expect(chamadas.some((c) => c.startsWith('transcrever'))).toBe(false)
})

