import { criarAcumulador, reamostrar } from './voz-pcm'

test('reamostra 48 kHz para 16 kHz (1/3 das amostras), mantendo o sinal', () => {
  const de = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i / 10))
  const r = reamostrar(de, 48000, 16000)
  expect(r.length).toBe(1600)
  expect(r[100]).toBeCloseTo(de[300], 1)
  expect(reamostrar(de, 16000, 16000)).toBe(de)
})

test('acumulador: guarda os pedaços na ordem e entrega tudo em 16 kHz sem refazer o que já foi convertido', () => {
  const a = criarAcumulador(48000)
  a.somar(new Float32Array(4800).fill(0.5))
  a.somar(new Float32Array(2400).fill(-0.5))
  const t = a.tudo()
  expect(t.length).toBe(2400)
  expect(t[0]).toBeCloseTo(0.5)
  expect(t[2399]).toBeCloseTo(-0.5)
})
