// Teste do cronograma da obra (M41, aprovado pelo Luiz em 24/11/2026: "os prazos por milestone previsto e realizado e a
// expectativa de data e horário de término").
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarCronograma } = require('./cronograma.cjs')

const H = 3600_000
const M = (n, peso, status, pct = 0) => ({ n, titulo: `Etapa ${n}`, peso, status, pct })

function montar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-crono-'))
  let t = Date.UTC(2026, 10, 24, 12, 0)
  const c = criarCronograma({ agora: () => new Date(t) })
  return { dir, c, passar: (ms) => { t += ms }, agora: () => t }
}

test('no começo: guarda o previsto (por peso) e não muda mais; real e esperado começam na 1ª etapa', () => {
  const { dir, c, passar } = montar()
  const v = c.atualizar(dir, [M(1, 1, 'andamento'), M(2, 3, 'pendente')], { previstoMs: 40 * H })
  assert.equal(v.etapas.length, 2)
  assert.equal(Date.parse(v.etapas[0].previsto.fim) - Date.parse(v.etapas[0].previsto.inicio), 10 * H)
  assert.equal(Date.parse(v.etapas[1].previsto.fim) - Date.parse(v.etapas[1].previsto.inicio), 30 * H)
  assert.equal(v.previstoFim, v.etapas[1].previsto.fim)
  assert.equal(v.etapas[0].status, 'andamento')
  assert.equal(v.etapas[0].real.inicio, v.inicio)
  passar(5 * H)
  const v2 = c.atualizar(dir, [M(1, 1, 'andamento'), M(2, 3, 'pendente')], { previstoMs: 99 * H })
  assert.equal(v2.previstoFim, v.previstoFim) // o previsto fica guardado
  assert.ok(fs.existsSync(path.join(dir, '.atlas', 'cronograma.json')))
})

test('etapa entregue ganha a hora real de fim; a próxima começa ali', () => {
  const { dir, c, passar } = montar()
  c.atualizar(dir, [M(1, 1, 'andamento'), M(2, 1, 'pendente')], { previstoMs: 20 * H })
  passar(7 * H)
  const v = c.atualizar(dir, [M(1, 1, 'concluido'), M(2, 1, 'andamento')], {})
  assert.equal(v.etapas[0].status, 'entregue')
  assert.equal(Date.parse(v.etapas[0].real.fim) - Date.parse(v.etapas[0].real.inicio), 7 * H)
  assert.equal(v.etapas[1].real.inicio, v.etapas[0].real.fim)
  assert.equal(v.entregues, 1)
})

test('término esperado: vem do ritmo real e é repartido entre as etapas que faltam, pelo peso e pelo que já andou', () => {
  const { dir, c, agora } = montar()
  const fim = agora() + 30 * H
  const v = c.atualizar(dir, [M(1, 2, 'concluido'), M(2, 2, 'andamento', 50), M(3, 3, 'pendente')], { previstoMs: 20 * H, terminoMs: fim })
  assert.equal(v.esperadoFim, new Date(fim).toISOString())
  // falta: 1 (metade da etapa 2) + 3 = 4 partes em 30 h → etapa 2 termina em 7,5 h
  assert.equal(Date.parse(v.etapas[1].esperado.fim) - agora(), 7.5 * H)
  assert.equal(v.etapas[2].esperado.fim, v.esperadoFim)
  assert.equal(v.etapas[0].esperado, null)
})

test('sem estimativa do ritmo ainda: esperado segue o previsto a partir de agora; etapa nova no PLAN entra no fim do previsto', () => {
  const { dir, c, passar, agora } = montar()
  c.atualizar(dir, [M(1, 1, 'andamento'), M(2, 1, 'pendente')], { previstoMs: 20 * H })
  passar(2 * H)
  const v = c.atualizar(dir, [M(1, 1, 'andamento'), M(2, 1, 'pendente'), M(3, 1, 'pendente')], {})
  assert.equal(v.etapas.length, 3)
  assert.equal(v.etapas[2].previsto.inicio, v.etapas[1].previsto.fim)
  assert.ok(Date.parse(v.esperadoFim) > agora())
})

test('pausas de cota entram no cronograma e a diferença separa quanto foi pausa', () => {
  const { dir, c, passar, agora } = montar()
  c.atualizar(dir, [M(1, 1, 'andamento')], { previstoMs: 10 * H })
  const ini = new Date(agora() + H).toISOString(); const fim = new Date(agora() + 4 * H).toISOString()
  passar(6 * H)
  const v = c.atualizar(dir, [M(1, 1, 'andamento')], { terminoMs: agora() + 10 * H, pausas: [{ inicio: ini, fim }] })
  assert.deepEqual(v.pausas, [{ inicio: ini, fim }])
  assert.equal(v.diferencaMs, 6 * H)
  assert.equal(v.pausaMs, 3 * H)
})

test('arquivo estragado: recomeça sem quebrar', () => {
  const { dir, c } = montar()
  fs.mkdirSync(path.join(dir, '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.atlas', 'cronograma.json'), '{lixo')
  const v = c.atualizar(dir, [M(1, 1, 'andamento')], { previstoMs: 5 * H })
  assert.equal(v.etapas.length, 1)
})

test('nasce desde o começo de verdade: com o histórico da obra, o início e as entregas antigas ficam nas horas certas', () => {
  const { dir, c, agora } = montar()
  const ontem = new Date(agora() - 20 * H).toISOString()
  const entrega1 = new Date(agora() - 15 * H).toISOString()
  const v = c.atualizar(dir, [M(1, 1, 'concluido'), M(2, 1, 'concluido'), M(3, 1, 'andamento', 20)], { previstoMs: 30 * H, historico: { inicio: ontem, entregas: { 1: entrega1 } } })
  assert.equal(v.inicio, ontem)
  assert.equal(v.etapas[0].real.fim, entrega1)
  assert.equal(v.etapas[0].real.antes, undefined)
  assert.equal(v.etapas[1].real.antes, true, 'entrega sem hora conhecida: marcada como feita antes de medir')
  assert.equal(Date.parse(v.etapas[0].previsto.inicio), Date.parse(ontem))
})

test('cronograma criado tarde (versão antiga) é consertado uma vez com o histórico', () => {
  const { dir, c, agora, passar } = montar()
  c.atualizar(dir, [M(1, 1, 'concluido'), M(2, 1, 'andamento')], { previstoMs: 20 * H }) // criado agora, já com a 1 entregue
  const arq = path.join(dir, '.atlas', 'cronograma.json')
  const velho = JSON.parse(fs.readFileSync(arq, 'utf8')); delete velho.historico; fs.writeFileSync(arq, JSON.stringify(velho)) // como a versão antiga gravava
  const criado = agora()
  passar(H)
  const ontem = new Date(criado - 10 * H).toISOString()
  const entrega1 = new Date(criado - 6 * H).toISOString()
  const v = c.atualizar(dir, [M(1, 1, 'concluido'), M(2, 1, 'andamento')], { previstoMs: 20 * H, historico: { inicio: ontem, entregas: { 1: entrega1 } } })
  assert.equal(v.inicio, ontem)
  assert.equal(v.etapas[0].real.fim, entrega1)
  assert.equal(v.etapas[1].real.inicio, entrega1, 'a etapa seguinte começa quando a anterior foi entregue')
  // não conserta de novo (histórico diferente depois não mexe)
  const v2 = c.atualizar(dir, [M(1, 1, 'concluido'), M(2, 1, 'andamento')], { previstoMs: 20 * H, historico: { inicio: new Date(criado - 30 * H).toISOString(), entregas: {} } })
  assert.equal(v2.inicio, ontem)
})
