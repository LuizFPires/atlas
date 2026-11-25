// M51: duas obras ao mesmo tempo — o cliente escolhe fila, ao mesmo tempo ou esta primeiro (node --test app/adaptadores/*.teste.cjs).
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarConstrucao } = require('./construcao.cjs')
const { criarModo } = require('./modo.cjs')
const { criarFila } = require('./fila-obras.cjs')
const { criarVigia } = require('./vigia.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-fila-'))
const ETAPAS = [{ n: 'M1', nome: 'Base', desc: 'Entrada' }]

function montar() {
  const raiz = tmp(); const home = tmp()
  for (const p of ['ponto', 'estoque']) fs.mkdirSync(path.join(raiz, p))
  const fila = criarFila({ raiz })
  const disparos = []
  const pausadas = []
  const c = criarConstrucao({
    raiz, home, dadosApp: tmp(), modos: criarModo({ raiz }), fila,
    claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }),
    iniciarFluxo: (args, o) => { disparos.push(o.cwd); let fim; return { parar: () => fim({ codigo: null, parado: true }), fim: new Promise((r) => { fim = r }) } },
    pausarObra: async (p) => { pausadas.push(p); c.linha.parar(p) },
  })
  return { raiz, fila, c, disparos, pausadas }
}

test('com outra obra trabalhando e sem escolha: pergunta ao cliente e não grava nada', async () => {
  const { raiz, c, disparos } = montar()
  await c.iniciar('ponto', 'Ponto', 'automatico', ETAPAS)
  await assert.rejects(c.iniciar('estoque', 'Estoque', 'automatico', ETAPAS), /outra-obra-trabalhando/)
  assert.ok(!fs.existsSync(path.join(raiz, 'estoque', 'PLAN.md')))
  assert.equal(disparos.length, 1)
  assert.deepEqual(c.trabalhando(), ['ponto'])
})

test('fila: grava o plano, não dispara e espera atrás da obra que trabalha', async () => {
  const { raiz, c, fila, disparos } = montar()
  await c.iniciar('ponto', 'Ponto', 'automatico', ETAPAS)
  await c.iniciar('estoque', 'Estoque', 'automatico', ETAPAS, 'fila')
  assert.ok(fs.existsSync(path.join(raiz, 'estoque', 'PLAN.md')))
  assert.equal(disparos.length, 1)
  assert.deepEqual(fila.ler().fila, [{ pasta: 'estoque', depoisDe: 'ponto' }])
  assert.throws(() => c.linha.religar('estoque'), /ja-rodando/) // "Tentar agora" na obra da fila não fura a fila
})

test('ao mesmo tempo: as duas obras trabalham juntas', async () => {
  const { c, fila, disparos } = montar()
  await c.iniciar('ponto', 'Ponto', 'automatico', ETAPAS)
  await c.iniciar('estoque', 'Estoque', 'automatico', ETAPAS, 'juntas')
  assert.equal(disparos.length, 2)
  assert.deepEqual(c.trabalhando().sort(), ['estoque', 'ponto'])
  assert.ok(fila.junta('ponto') && fila.junta('estoque'))
})

test('esta primeiro: a que trabalhava pausa e entra na fila atrás da nova', async () => {
  const { c, fila, pausadas } = montar()
  await c.iniciar('ponto', 'Ponto', 'automatico', ETAPAS)
  await c.iniciar('estoque', 'Estoque', 'automatico', ETAPAS, 'primeiro')
  assert.deepEqual(pausadas, ['ponto'])
  assert.deepEqual(c.trabalhando(), ['estoque'])
  assert.deepEqual(fila.ler().fila, [{ pasta: 'ponto', depoisDe: 'estoque' }])
})

test('escolha desconhecida é recusada sem gravar', async () => {
  const { raiz, c } = montar()
  await c.iniciar('ponto', 'Ponto', 'automatico', ETAPAS)
  await assert.rejects(c.iniciar('estoque', 'Estoque', 'automatico', ETAPAS, 'tudo'), /como-invalido/)
  assert.ok(!fs.existsSync(path.join(raiz, 'estoque', 'PLAN.md')))
})

test('o vigia começa sozinho a obra da fila quando a da frente fica pronta', async () => {
  const { raiz, c, fila } = montar()
  await c.iniciar('ponto', 'Ponto', 'automatico', ETAPAS)
  await c.iniciar('estoque', 'Estoque', 'automatico', ETAPAS, 'fila')
  const comecadas = []
  const v = criarVigia({ raiz, construcao: c, garantirKit: async () => {}, listar: async () => [], fila, comecarDaFila: async (p) => { comecadas.push(p) } })
  await v.rodada()
  assert.deepEqual(comecadas, []) // a da frente ainda não ficou pronta
  c.linha.parar('ponto')
  fs.writeFileSync(path.join(raiz, 'ponto', 'PLAN.md'), fs.readFileSync(path.join(raiz, 'ponto', 'PLAN.md'), 'utf8').replace(/- \[ \]/g, '- [x]'))
  await v.rodada()
  assert.deepEqual(comecadas, ['estoque'])
  assert.deepEqual(fila.ler().fila, [])
})

test('arquivo da fila estragado vira fila vazia (nunca trava a obra)', () => {
  const raiz = tmp()
  fs.writeFileSync(path.join(raiz, '.atlas-fila.json'), '{ isso não é json')
  const f = criarFila({ raiz })
  assert.deepEqual(f.ler(), { fila: [], juntas: [] })
  f.entrar('b', 'a'); f.entrar('c', 'b'); f.sair('b')
  assert.deepEqual(f.ler().fila, [{ pasta: 'c', depoisDe: 'a' }]) // quem esperava pela que saiu passa a esperar pela da frente
})
