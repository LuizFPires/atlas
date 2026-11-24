// Teste do vigia da obra (node --test app/adaptadores/*.teste.cjs). Bug de 24/11/2026: a linha parou sem avançar e ninguém soube.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarVigia, BACKOFF_MIN, MAX_TENTATIVAS } = require('./vigia.cjs')

const MIN = 60_000
function montar({ kitFalha = null } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-vigia-'))
  fs.mkdirSync(path.join(raiz, 'obra', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'PLAN.md'), '## Milestone 1 — Base\npeso: 1\n- [ ] a\n')
  let t = Date.UTC(2026, 10, 24, 9, 0)
  const religadas = []
  let rodando = false
  const linha = (o) => fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify({ versao: 1, ...o }))
  const construcao = { linha: { rodando: () => rodando, religar: (p) => { religadas.push(p); rodando = true; linha({ estado: 'rodando', desde: new Date(t).toISOString() }) } } }
  const garantirKit = async () => { if (kitFalha) throw new Error(kitFalha) }
  const vigia = criarVigia({ raiz, construcao, garantirKit, listar: async () => ['obra'], agora: () => new Date(t) })
  const parou = (motivo = 'sem-avanco') => { rodando = false; linha({ estado: 'parou', motivo, codigo: 0, fimEm: new Date(t).toISOString() }) }
  return { raiz, vigia, religadas, parou, passar: (ms) => { t += ms }, ler: () => vigia.estado('obra') }
}

test('parou sem avançar: tenta de novo sozinho em 2, 5 e 15 minutos, com o kit garantido antes', async () => {
  const m = montar()
  assert.deepEqual(BACKOFF_MIN, [2, 5, 15])
  m.parou()
  await m.vigia.rodada()
  assert.equal(m.religadas.length, 0) // espera o primeiro intervalo
  assert.equal(m.ler().situacao, 'tentando')
  m.passar(2 * MIN); await m.vigia.rodada()
  assert.equal(m.religadas.length, 1)
  m.passar(20_000); m.parou(); await m.vigia.rodada()
  m.passar(5 * MIN); await m.vigia.rodada()
  assert.equal(m.religadas.length, 2)
  assert.equal(m.ler().tentativa, 2)
})

test('depois de 3 tentativas sem avanço, desiste e pede você (com o motivo)', async () => {
  const m = montar()
  for (let i = 0; i < MAX_TENTATIVAS; i++) { m.parou(); m.passar(20 * MIN); await m.vigia.rodada() }
  m.parou(); m.passar(20 * MIN); await m.vigia.rodada()
  assert.equal(m.religadas.length, MAX_TENTATIVAS)
  const e = m.ler()
  assert.equal(e.situacao, 'precisa-voce')
  assert.match(e.motivo, /não conseguiu trabalhar/)
})

test('trabalhou de verdade depois de religar: zera as tentativas', async () => {
  const m = montar()
  m.parou(); m.passar(2 * MIN); await m.vigia.rodada()
  m.passar(10 * MIN); await m.vigia.rodada() // rodando há 10 min
  assert.equal(m.ler(), null)
})

test('kit fora do ar: conta como tentativa e o motivo diz o que faltou', async () => {
  const m = montar({ kitFalha: 'kit-indisponivel' })
  m.parou(); m.passar(2 * MIN); await m.vigia.rodada()
  assert.equal(m.religadas.length, 0)
  assert.equal(m.ler().tentativa, 1)
  assert.match(m.ler().motivo, /instruções da obra/)
})

test('pausa do cliente, cota, fechou ou obra pronta: o vigia não mexe', async () => {
  for (const motivo of ['pausada', 'cota', 'fechou', 'concluiu']) {
    const m = montar()
    m.parou(motivo); m.passar(30 * MIN); await m.vigia.rodada()
    assert.equal(m.religadas.length, 0, motivo)
    assert.equal(m.ler(), null, motivo)
  }
  const m = montar()
  fs.writeFileSync(path.join(m.raiz, 'obra', 'PLAN.md'), '## Milestone 1 — Base\npeso: 1\n- [x] a\n')
  m.parou(); m.passar(30 * MIN); await m.vigia.rodada()
  assert.equal(m.religadas.length, 0)
})

test('"Tentar agora" do cliente zera e religa na hora', async () => {
  const m = montar()
  for (let i = 0; i < MAX_TENTATIVAS + 1; i++) { m.parou(); m.passar(20 * MIN); await m.vigia.rodada() }
  assert.equal(m.ler().situacao, 'precisa-voce')
  m.vigia.zerar('obra')
  assert.equal(m.ler(), null)
})

test('quando desiste, avisa o computador UMA vez (notificação do Windows), com o motivo', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-vigia-'))
  fs.mkdirSync(path.join(raiz, 'obra', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'PLAN.md'), '## Milestone 1 — Base\npeso: 1\n- [ ] a\n')
  let t = Date.UTC(2026, 10, 24, 9, 0)
  const avisos = []
  const linha = (o) => fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify(o))
  const vigia = criarVigia({ raiz, construcao: { linha: { rodando: () => false, religar: () => {} } }, garantirKit: async () => { throw new Error('claude-nao-logado') }, listar: async () => ['obra'], agora: () => new Date(t), aoPrecisar: (p, m) => avisos.push([p, m]) })
  linha({ estado: 'parou', motivo: 'sem-avanco', fimEm: new Date(t).toISOString() })
  for (let i = 0; i < 6; i++) { t += 20 * 60_000; await vigia.rodada() }
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0][0], 'obra')
  assert.match(avisos[0][1], /saiu da conta/)
})
