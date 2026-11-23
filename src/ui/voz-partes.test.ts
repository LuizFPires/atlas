// Transcrição em partes: enquanto a pessoa fala, o Atlas já vai escrevendo os trechos prontos. Ao parar, falta só o finalzinho.
import { criarTranscricaoEmPartes, pontoDeCorte, TAXA } from './voz-partes'

const fala = (seg: number) => Float32Array.from({ length: Math.round(seg * TAXA) }, (_, i) => Math.sin(i / 3) * 0.5)
const silencio = (seg: number) => new Float32Array(Math.round(seg * TAXA))
const juntar = (...p: Float32Array[]) => { const r = new Float32Array(p.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of p) { r.set(x, o); o += x.length } return r }

test('corta no silêncio mais próximo do fim, nunca no meio de uma palavra', () => {
  const a = juntar(fala(9), silencio(0.6), fala(1.4))
  const c = pontoDeCorte(a, 0, a.length)
  expect(c / TAXA).toBeGreaterThan(9)
  expect(c / TAXA).toBeLessThan(9.6)
})

test('sem silêncio nenhum, corta no fim mesmo', () => {
  const a = fala(12)
  expect(pontoDeCorte(a, 0, a.length)).toBe(a.length)
})

test('vai transcrevendo durante a fala; ao parar, manda só o resto e junta tudo na ordem', async () => {
  const pedidos: number[] = []
  const t = { preparar: async () => {}, transcrever: async (a: Float32Array) => { pedidos.push(Math.round(a.length / TAXA)); return `parte${pedidos.length}` } }
  const p = criarTranscricaoEmPartes(t, { minSegundos: 10 })
  const ate8 = juntar(fala(8))
  await p.adiantar(ate8) // pouco ainda: não manda
  expect(pedidos).toEqual([])
  const ate14 = juntar(fala(9), silencio(0.6), fala(4.4))
  await p.adiantar(ate14)
  expect(pedidos).toHaveLength(1)
  const final = juntar(ate14, fala(3))
  expect(await p.terminar(final)).toBe('parte1 parte2')
  expect(pedidos[1]).toBeLessThanOrEqual(9)
})

test('se um trecho falhar, o resultado falha (o Atlas avisa em vez de perder metade do que foi dito)', async () => {
  let n = 0
  const t = { preparar: async () => {}, transcrever: async () => { n++; if (n === 1) throw new Error('x'); return 'ok' } }
  const p = criarTranscricaoEmPartes(t, { minSegundos: 10 })
  await p.adiantar(fala(12))
  await expect(p.terminar(fala(15))).rejects.toThrow()
})

test('fala curta (menos que um trecho): uma transcrição só, como antes', async () => {
  const pedidos: number[] = []
  const t = { preparar: async () => {}, transcrever: async (a: Float32Array) => { pedidos.push(a.length); return 'tudo' } }
  const p = criarTranscricaoEmPartes(t)
  expect(await p.terminar(fala(4))).toBe('tudo')
  expect(pedidos).toHaveLength(1)
})

// Luiz, 23/11/2026: "vai falando e o Atlas vai escrevendo, como no Claude".
describe('texto ao vivo: cada trecho vai para o campo assim que fica pronto', () => {
  test('entrega cada trecho na ordem, durante a fala; ao parar, entrega o resto e não repete nada', async () => {
    const vistos: string[] = []
    let n = 0
    const t = { preparar: async () => {}, transcrever: async () => `parte${++n}` }
    const p = criarTranscricaoEmPartes(t, { minSegundos: 6, aoPronto: (s) => vistos.push(s) })
    const a = juntar(fala(6), silencio(0.6), fala(3))
    await p.adiantar(a)
    await new Promise((ok) => setTimeout(ok, 0))
    expect(vistos).toEqual(['parte1'])
    const resto = await p.terminar(juntar(a, fala(2)))
    expect(vistos).toEqual(['parte1', 'parte2'])
    expect(resto).toBe('')
  })

  test('um trecho que termina antes do anterior espera a vez: o texto nunca sai fora de ordem', async () => {
    const vistos: string[] = []
    const atrasos = [40, 0]
    let n = 0
    const t = { preparar: async () => {}, transcrever: async () => { const i = n++; await new Promise((ok) => setTimeout(ok, atrasos[i] ?? 0)); return `parte${i + 1}` } }
    const p = criarTranscricaoEmPartes(t, { minSegundos: 6, aoPronto: (s) => vistos.push(s) })
    const a = juntar(fala(6), silencio(0.6), fala(1))
    await p.adiantar(a)
    await p.terminar(juntar(a, fala(2)))
    expect(vistos).toEqual(['parte1', 'parte2'])
  })

  test('trecho vazio (silêncio) não vira espaço sobrando no campo', async () => {
    const vistos: string[] = []
    const textos = ['  ', 'oi']
    let n = 0
    const p = criarTranscricaoEmPartes({ preparar: async () => {}, transcrever: async () => textos[n++] }, { minSegundos: 6, aoPronto: (s) => vistos.push(s) })
    const a = juntar(fala(6), silencio(0.6), fala(1))
    await p.adiantar(a)
    await p.terminar(juntar(a, fala(2)))
    expect(vistos).toEqual(['oi'])
  })
})
