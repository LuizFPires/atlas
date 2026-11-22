import { ESTIMATIVA_AGENDAMENTO, lidosNaConversa, estimarTokens } from './tokens'

// Conta da página de vendas (pedido do Luiz, 22/11/2026): honesta, com premissas à vista e números que dá para refazer.
test('numa conversa, cada troca relê tudo o que já foi dito: o total cresce como bola de neve', () => {
  expect(lidosNaConversa({ base: 0, trocas: 3, porTroca: 10 })).toBe(10 + 20 + 30)
  expect(lidosNaConversa({ base: 5, trocas: 2, porTroca: 10 })).toBe(15 + 25)
})

test('app de agendamento em 8 etapas: Claude sozinho lê cerca de 22 milhões; o Atlas, cerca de 8 milhões', () => {
  const e = estimarTokens(ESTIMATIVA_AGENDAMENTO)
  expect(e.sozinho).toBe(22_380_000)
  expect(e.atlas).toBe(8_064_000)
  expect(e.economiaPct).toBe(64)
})

test('o Atlas economiza mesmo contando as três revisões por etapa (qa, segurança e desempenho)', () => {
  const semRevisao = estimarTokens({ ...ESTIMATIVA_AGENDAMENTO, revisores: 0 })
  const comRevisao = estimarTokens(ESTIMATIVA_AGENDAMENTO)
  expect(ESTIMATIVA_AGENDAMENTO.revisores).toBe(3)
  expect(comRevisao.atlas).toBeGreaterThan(semRevisao.atlas)
  expect(comRevisao.atlas).toBeLessThan(comRevisao.sozinho)
})
