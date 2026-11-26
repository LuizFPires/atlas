// Teste do Retomar (node --test app/adaptadores/*.teste.cjs). Linha de produção simulada.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarRetomar } = require('./retomar.cjs')
const { criarPainel } = require('./painel.cjs')
const { criarConstrucao } = require('./construcao.cjs')
const { criarModo } = require('./modo.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-retomar-'))
const ETAPAS = [{ n: 'M1', nome: 'Base', desc: 'a' }, { n: 'M2', nome: 'Agenda', desc: 'b' }]

function montar(cota) {
  const raiz = tmp(); const home = tmp()
  const modos = criarModo({ raiz })
  let religadas = 0
  const construcao = criarConstrucao({
    raiz, home, modos, claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }),
    iniciarFluxo: () => { religadas++; let t; return { parar: () => t({ codigo: null, parado: true }), fim: new Promise((r) => { t = r }) } },
  })
  const painel = criarPainel({ raiz, home, modos, construcao, shell: {}, kitDir: path.join(raiz, 'sem-kit') })
  return { raiz, construcao, painel, retomar: criarRetomar({ raiz, painel, cota, construcao }), religadas: () => religadas }
}

test('acha a obra parada pelo PLAN; sem obra => null; obra rodando não é parada', async () => {
  const { raiz, construcao, retomar } = montar()
  assert.equal(await retomar.obraEmAndamento(), null)
  fs.mkdirSync(path.join(raiz, 'barbearia'))
  await construcao.iniciar('barbearia', 'Barbearia do Zé', 'automatico', ETAPAS)
  assert.equal(await retomar.obraEmAndamento(), null) // linha rodando agora
  construcao.encerrar()
  await new Promise((r) => setImmediate(r))
  const o = await retomar.obraEmAndamento()
  assert.equal(o.nome, 'Barbearia do Zé'); assert.equal(o.pasta, 'barbearia'); assert.equal(o.pct, 0)
  assert.deepEqual(o.etapa, { n: 1, nome: 'Base' }); assert.ok(o.paradaEm)
})

test('obra concluída (100%) não aparece', async () => {
  const { raiz, construcao, retomar } = montar()
  fs.mkdirSync(path.join(raiz, 'o'))
  await construcao.iniciar('o', 'O', 'automatico', ETAPAS)
  construcao.encerrar()
  const arq = path.join(raiz, 'o', 'PLAN.md')
  fs.writeFileSync(arq, fs.readFileSync(arq, 'utf8').replace(/\[ \]/g, '[x]'))
  assert.equal(await retomar.obraEmAndamento(), null)
})

test('continuar religa a linha e retoma pela cota só quando renovada', async () => {
  const chamadas = []
  const cota = { ler: async () => ({ esgotada: true, renovada: true }), retomar: async (p) => chamadas.push(`cota:${p}`) }
  const { raiz, construcao, retomar, religadas } = montar(cota)
  fs.mkdirSync(path.join(raiz, 'o'))
  await construcao.iniciar('o', 'O', 'automatico', ETAPAS)
  construcao.encerrar()
  await new Promise((r) => setImmediate(r))
  fs.writeFileSync(path.join(raiz, 'o', '.atlas', 'linha.json'), JSON.stringify({ estado: 'parou', motivo: 'cota' }))
  await retomar.continuar({ pasta: 'o' })
  assert.deepEqual(chamadas, ['cota:o'])
  assert.equal(religadas(), 2)
  await assert.rejects(retomar.continuar({ pasta: '../fora' }), /obra-invalida/)
})

test('paradas: todas as obras paradas, a mais recente primeiro (obraEmAndamento é a primeira delas)', async () => {
  const { raiz, construcao, retomar } = montar()
  assert.deepEqual(await retomar.paradas(), [])
  for (const p of ['velha', 'nova']) {
    fs.mkdirSync(path.join(raiz, p)); await construcao.iniciar(p, p === 'velha' ? 'Velha' : 'Nova', 'automatico', ETAPAS)
    construcao.encerrar()
    await new Promise((r) => setImmediate(r))
  }
  const antes = new Date(Date.now() - 3600_000)
  fs.utimesSync(path.join(raiz, 'velha', 'PLAN.md'), antes, antes)
  try { fs.utimesSync(path.join(raiz, 'velha', '.atlas', 'linha.json'), antes, antes) } catch { /* sem linha.json */ }
  const l = await retomar.paradas()
  assert.deepEqual(l.map((o) => o.pasta), ['nova', 'velha'])
  assert.equal((await retomar.obraEmAndamento()).pasta, 'nova')
})
