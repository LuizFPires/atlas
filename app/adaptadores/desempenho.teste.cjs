'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { calcularDesempenho, PADRAO } = require('./desempenho.cjs')

const H = 3600_000
const T0 = Date.parse('2026-11-26T19:00:00-03:00')
const iso = (ms) => new Date(ms).toISOString()
const etapas = (feitas, pctAtual, total = 10) => Array.from({ length: total }, (_, i) => ({ n: i + 1, peso: 1, status: i < feitas ? 'concluido' : 'falta', pct: i < feitas ? 100 : i === feitas ? pctAtual : 0 }))
// Um turno a cada 10 min, de `de` até `ate`, gastando `porH` por hora.
const turnos = (de, ate, porH) => { const out = []; for (let t = de + 10 * 60_000; t <= ate; t += 10 * 60_000) out.push({ inicio: iso(t - 10 * 60_000), fim: iso(t), custoUsd: porH / 6, duracaoMs: 9 * 60_000 }); return out }
const base = (o = {}) => ({ inicio: iso(T0), previstoFim: iso(T0 + 20 * H), etapas: etapas(0, 0), consumo: [], pausas: [], plano: 'pro', agora: new Date(T0), ...o })

test('sem nada medido: orçamento e cota são estimativa inicial, e mesmo assim projeta término e pausas', () => {
  const d = calcularDesempenho(base())
  assert.equal(d.estimativaInicial, true)
  assert.equal(d.cotaAprendida, false)
  assert.equal(d.realizadoPct, 0)
  assert.ok(Date.parse(d.terminoProjetado) > T0)
  assert.ok(d.pausasPrevistas.length >= 1)
  assert.equal(d.serie.previsto[0].v, 0)
  assert.equal(d.serie.previsto[d.serie.previsto.length - 1].v, 100)
})

test('orçamento fixado na 1ª etapa entregue (vem guardado), consumo e previsto até agora em %', () => {
  const agora = T0 + 4 * H
  const d = calcularDesempenho(base({ agora: new Date(agora), etapas: etapas(2, 0), consumo: turnos(T0, agora, 5), orcamentoGuardado: 100 }))
  assert.equal(d.estimativaInicial, false)
  assert.equal(d.orcamento, 100)
  assert.ok(Math.abs(d.realizadoPct - 20) < 0.01) // gastou 20 de 100
  assert.ok(d.previstoAgoraPct > 0 && d.previstoAgoraPct < 20)
  assert.ok(Math.abs(d.ritmo) < 0.01) // 20% do físico com 20% do orçamento: no previsto
})

test('gastando mais do que o físico andou: ritmo positivo, mais pausas da cota e término projetado depois', () => {
  const agora = T0 + 4 * H
  const igual = calcularDesempenho(base({ agora: new Date(agora), etapas: etapas(2, 0), consumo: turnos(T0, agora, 5), orcamentoGuardado: 100 }))
  const caro = calcularDesempenho(base({ agora: new Date(agora), etapas: etapas(2, 0), consumo: turnos(T0, agora, 6), orcamentoGuardado: 100 }))
  assert.ok(caro.ritmo > 0.15)
  assert.ok(Date.parse(caro.terminoProjetado) > Date.parse(igual.terminoProjetado))
})

test('a cota é aprendida pelas pausas que já aconteceram (o que foi gasto na janela antes de parar)', () => {
  const agora = T0 + 9 * H
  const consumo = [...turnos(T0, T0 + 3 * H, 4), ...turnos(T0 + 5 * H, agora, 4)] // gastou 12 em 3 h e parou por cota
  const d = calcularDesempenho(base({ agora: new Date(agora), etapas: etapas(3, 50), consumo, pausas: [{ inicio: iso(T0 + 3 * H), fim: iso(T0 + 5 * H) }], orcamentoGuardado: 60 }))
  assert.equal(d.cotaAprendida, true)
  assert.ok(Math.abs(d.cota - 12) < 0.01)
  // faltam ~35,5 de consumo a 4/h, com 12 por janela de 5 h: várias pausas até o fim
  assert.ok(d.pausasPrevistas.length >= 2)
  assert.ok(Date.parse(d.pausasPrevistas[0].inicio) >= agora)
  assert.ok(d.pausasPrevistas.every((p) => Date.parse(p.fim) > Date.parse(p.inicio)))
})

test('Ultra (sem o limite de 5 h): nenhuma pausa prevista', () => {
  const agora = T0 + 4 * H
  const d = calcularDesempenho(base({ agora: new Date(agora), etapas: etapas(2, 0), consumo: turnos(T0, agora, 5), orcamentoGuardado: 100, plano: 'ultra' }))
  assert.equal(d.pausasPrevistas.length, 0)
  assert.equal(d.cota, null)
})

test('o Max tem 5 vezes a cota do Pro', () => {
  assert.equal(PADRAO.cota.max, PADRAO.cota.pro * 5)
})

test('obra parada agora pela cota: a projeção recomeça quando a janela renova', () => {
  const agora = T0 + 4 * H
  const d = calcularDesempenho(base({ agora: new Date(agora), etapas: etapas(2, 0), consumo: turnos(T0, T0 + 3 * H, 5), orcamentoGuardado: 100, pausas: [{ inicio: iso(T0 + 3 * H), fim: null }] }))
  assert.ok(Date.parse(d.pausasPrevistas[0].inicio) <= agora)
  assert.ok(Date.parse(d.pausasPrevistas[0].fim) >= T0 + 5 * H)
})

test('séries curtas para o gráfico (no máximo 200 pontos cada) e o realizado só cresce', () => {
  const agora = T0 + 60 * H
  const d = calcularDesempenho(base({ agora: new Date(agora), previstoFim: iso(T0 + 80 * H), etapas: etapas(5, 0), consumo: turnos(T0, agora, 1), orcamentoGuardado: 200, plano: 'ultra' }))
  assert.ok(d.serie.realizado.length <= 200)
  for (let i = 1; i < d.serie.realizado.length; i++) assert.ok(d.serie.realizado[i].v >= d.serie.realizado[i - 1].v)
})

test('o que foi gasto antes de a construção começar (protótipo, nome) não entra', () => {
  const d = calcularDesempenho(base({ agora: new Date(T0 + H), consumo: [{ fim: iso(T0 - H), custoUsd: 50, duracaoMs: 1 }], orcamentoGuardado: 100 }))
  assert.equal(d.realizadoPct, 0)
})
