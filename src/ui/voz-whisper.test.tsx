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
