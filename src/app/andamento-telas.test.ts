import { andamentoDoDesenho } from './andamento-telas'

// Luiz, 23/11/2026: "Leva uns 8 minutos" fixo, e o relógio já em 10:49 com a barra cheia. Agora a conta usa as telas de verdade.
test('antes do mapa: não promete minutos e fica nas primeiras etapas', () => {
  const a = andamentoDoDesenho({ segundos: 40, total: 0, prontas: 0, segundosAteMapa: null })
  expect(a.etapa).toBeLessThanOrEqual(1)
  expect(a.pct).toBeLessThanOrEqual(10)
  expect(a.nota).toMatch(/Montando o mapa de telas/)
  expect(a.nota).not.toMatch(/minuto/)
})

test('com telas prontas: a barra segue as telas e o tempo sai da velocidade real', () => {
  // mapa saiu aos 60 s; 4 de 12 telas prontas aos 300 s → 60 s por tela → faltam 8 × 60 s + conferência ≈ 9 minutos
  const a = andamentoDoDesenho({ segundos: 300, total: 12, prontas: 4, segundosAteMapa: 60 })
  expect(a.etapa).toBe(2)
  expect(a.pct).toBeGreaterThan(30)
  expect(a.pct).toBeLessThan(50)
  expect(a.nota).toBe('Faltam 8 de 12 telas · mais ou menos 9 minutos.')
})

test('mapa pronto e nenhuma tela ainda: estimativa pela média e diz quantas telas são', () => {
  const a = andamentoDoDesenho({ segundos: 70, total: 10, prontas: 0, segundosAteMapa: 60 })
  expect(a.nota).toMatch(/^Faltam 10 de 10 telas · mais ou menos \d+ minutos\.$/)
})

test('falta pouco: fala "menos de 1 minuto", nunca "0 minutos"', () => {
  const a = andamentoDoDesenho({ segundos: 600, total: 10, prontas: 9, segundosAteMapa: 60 })
  expect(a.nota).toBe('Falta 1 de 10 telas · mais ou menos 2 minutos.')
  const b = andamentoDoDesenho({ segundos: 2000, total: 30, prontas: 29, segundosAteMapa: 1 })
  expect(b.nota).not.toMatch(/ 0 minuto/)
})

test('todas desenhadas: última etapa, barra quase cheia e sem prometer tempo', () => {
  const a = andamentoDoDesenho({ segundos: 650, total: 12, prontas: 12, segundosAteMapa: 60 })
  expect(a.etapa).toBe(4)
  expect(a.pct).toBeGreaterThanOrEqual(95)
  expect(a.pct).toBeLessThan(100)
  expect(a.nota).toBe('Todas as 12 telas desenhadas. Quase lá: o Claude está conferindo tudo.')
})
