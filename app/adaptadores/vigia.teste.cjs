// Teste do vigia da obra (node --test app/adaptadores/*.teste.cjs). Bug de 24/11/2026: a linha parou sem avançar e ninguém soube.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarVigia, BACKOFF_MIN, MAX_TENTATIVAS } = require('./vigia.cjs')

const MIN = 60_000
function montar({ kitFalha = null, diario = null } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-vigia-'))
  fs.mkdirSync(path.join(raiz, 'obra', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'PLAN.md'), '## Milestone 1 — Base\npeso: 1\n- [ ] a\n')
  let t = Date.UTC(2026, 10, 24, 9, 0)
  const religadas = []
  let rodando = false
  const linha = (o) => fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify({ versao: 1, ...o }))
  const construcao = { linha: { rodando: () => rodando, religar: (p) => { religadas.push(p); rodando = true; linha({ estado: 'rodando', desde: new Date(t).toISOString() }) } } }
  const garantirKit = async () => { if (kitFalha) throw new Error(kitFalha) }
  const vigia = criarVigia({ raiz, construcao, garantirKit, listar: async () => ['obra'], agora: () => new Date(t), ...(diario ? { diario } : {}) })
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

test('linha esperando a pessoa: pede NA HORA (sem gastar 3 tentativas), com a fala da linha e a conta certa', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-vigia-'))
  fs.mkdirSync(path.join(raiz, 'obra', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'PLAN.md'), '## Milestone 1 — Base\npeso: 1\n- [ ] a\n')
  const t = Date.UTC(2026, 10, 24, 9, 0)
  const avisos = []; const religadas = []
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify({ estado: 'parou', motivo: 'precisa-voce', fala: 'USUÁRIO: Ligue o GitHub na tela As contas do Atlas (botão Ligar).', fimEm: new Date(t).toISOString() }))
  const vigia = criarVigia({ raiz, construcao: { linha: { rodando: () => false, religar: (p) => religadas.push(p) } }, garantirKit: async () => {}, listar: async () => ['obra'], agora: () => new Date(t), aoPrecisar: (p, m) => avisos.push(m) })
  await vigia.rodada()
  const e = vigia.estado('obra')
  assert.equal(e.situacao, 'precisa-voce')
  assert.equal(e.conta, 'GitHub')
  assert.match(e.fala, /Ligue o GitHub/)
  assert.equal(religadas.length, 0)
  assert.equal(avisos.length, 1)
})

// Obra do Guilherme (24/11, 11:35): a linha trabalhou, abriu o pedido de revisão da M1 e encerrou o turno ("concluiu"). Ninguém
// religava: "Ninguém trabalhando agora" em 5,00%. No automático a obra segue sozinha até o fim.
function montarSeguir({ modo = 'automatico', plan = '## Milestone 1 — Base\npeso: 1\n- [ ] a\n- [ ] b\n\n## Milestone 2 — Ponto\npeso: 1\n- [ ] c\n', estado = {} } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-vigia-'))
  fs.mkdirSync(path.join(raiz, 'obra', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'PLAN.md'), plan)
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'modo.json'), JSON.stringify({ versao: 1, modo }))
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'estado.json'), JSON.stringify({ versao: 1, ...estado }))
  let t = Date.UTC(2026, 10, 24, 14, 0)
  const religadas = []
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify({ estado: 'parou', motivo: 'concluiu', desde: new Date(t - 40 * 60_000).toISOString(), fimEm: new Date(t).toISOString() }))
  const vigia = criarVigia({ raiz, construcao: { linha: { rodando: () => false, religar: (p) => religadas.push(p) } }, garantirKit: async () => {}, listar: async () => ['obra'], agora: () => new Date(t) })
  return { vigia, religadas, passar: (ms) => { t += ms } }
}

test('automático: a linha encerrou o turno com a obra por terminar → segue sozinha em 1 minuto, sem alerta', async () => {
  const m = montarSeguir()
  await m.vigia.rodada()
  assert.equal(m.religadas.length, 0)
  m.passar(60_000); await m.vigia.rodada()
  assert.equal(m.religadas.length, 1)
  assert.equal(m.vigia.estado('obra'), null)
  m.passar(60_000); await m.vigia.rodada()
  assert.equal(m.religadas.length, 1) // uma vez por fim
})

test('passo a passo: segue no meio da etapa, mas espera o OK quando a etapa acabou', async () => {
  const meio = montarSeguir({ modo: 'passo-a-passo' })
  meio.passar(60_000); await meio.vigia.rodada()
  assert.equal(meio.religadas.length, 1)
  const fimDaEtapa = montarSeguir({ modo: 'passo-a-passo', plan: '## Milestone 1 — Base\npeso: 1\n- [x] a\n- [x] b\n\n## Milestone 2 — Ponto\npeso: 1\n- [ ] c\n', estado: { aprovadaAte: 0 } })
  fimDaEtapa.passar(60_000); await fimDaEtapa.vigia.rodada()
  assert.equal(fimDaEtapa.religadas.length, 0)
  const aprovada = montarSeguir({ modo: 'passo-a-passo', plan: '## Milestone 1 — Base\npeso: 1\n- [x] a\n- [x] b\n\n## Milestone 2 — Ponto\npeso: 1\n- [ ] c\n', estado: { aprovadaAte: 1 } })
  aprovada.passar(60_000); await aprovada.vigia.rodada()
  assert.equal(aprovada.religadas.length, 1)
})

test('pausada pelo cliente: não segue', async () => {
  const m = montarSeguir({ estado: { pausada: true } })
  m.passar(5 * 60_000); await m.vigia.rodada()
  assert.equal(m.religadas.length, 0)
})

// Obra do Guilherme (24/11): a fala chegava ao painel com "**", blocos de código e cortada no meio da palavra ("Quali…").
test('a fala mostrada ao cliente vem limpa: sem marcação, sem código e cortada no fim de uma frase', () => {
  const { limparFala } = require('./vigia.cjs')
  const f = limparFala("Parei no M1 porque duas coisas precisam de você.\nOnde estamos:** Milestone 1, na branch 'feat/m1'.\n'''\ngh auth setup-git\n'''\n" + 'Mais um texto longo. '.repeat(30))
  assert.ok(!/\*\*|'''|```/.test(f), f)
  assert.ok(!/gh auth setup-git/.test(f), f)
  assert.ok(f.length <= 300)
  assert.match(f, /[.!?]$/)
})

// M41: o vigia conta no diário cada religada e a desistência (a pessoa vê o que o Atlas fez sozinho).
test('diário: cada religada sozinha e a desistência depois de 3 tentativas', async () => {
  const { criarDiario } = require('./diario.cjs')
  const diario = criarDiario()
  const m = montar({ diario })
  for (const espera of BACKOFF_MIN) { m.parou(); await m.vigia.rodada(); m.passar(espera * MIN); await m.vigia.rodada(); m.passar(20_000) }
  m.parou(); await m.vigia.rodada()
  const tx = diario.ler(path.join(m.raiz, 'obra')).map((e) => `${e.tipo}: ${e.texto}`)
  assert.deepEqual(tx.filter((x) => x.startsWith('retomada: ')), ['retomada: O Atlas religou a obra sozinho (tentativa 1 de 3)', 'retomada: O Atlas religou a obra sozinho (tentativa 2 de 3)', 'retomada: O Atlas religou a obra sozinho (tentativa 3 de 3)'])
  assert.match(tx.at(-1), /^defeito: O Atlas tentou 3 vezes e não conseguiu continuar sozinho/)
})
