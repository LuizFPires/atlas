'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarModelo, MODELOS, RECOMENDADO } = require('./modelo.cjs')
const { criarDisparo } = require('./projeto-comum.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-modelo-'))

test('sem escolha guardada: o recomendado (Opus 5.5)', () => {
  const m = criarModelo({ pasta: tmp() })
  assert.equal(RECOMENDADO, 'claude-opus-5-5')
  assert.equal(m.ler(), 'claude-opus-5-5')
  assert.deepEqual(m.args(), ['--model', 'claude-opus-5-5'])
  assert.ok(MODELOS.some((x) => x.id === 'claude-sonnet-5-5'))
})

test('a escolha fica guardada (vale depois de reabrir) e só aceita modelos da lista', () => {
  const pasta = tmp()
  criarModelo({ pasta }).gravar('claude-sonnet-5-5')
  assert.equal(criarModelo({ pasta }).ler(), 'claude-sonnet-5-5')
  assert.throws(() => criarModelo({ pasta }).gravar('--dangerously-skip-permissions'), /modelo-invalido/)
  fs.writeFileSync(path.join(pasta, 'modelo.json'), '{"modelo":"qualquer-coisa"}')
  assert.equal(criarModelo({ pasta }).ler(), 'claude-opus-5-5', 'arquivo adulterado volta ao recomendado')
})

test('o Claude do protótipo, do estilo e dos nomes roda no modelo escolhido', async () => {
  const raiz = tmp(); fs.mkdirSync(path.join(raiz, 'obra'))
  const chamadas = []
  const m = criarModelo({ pasta: tmp() })
  m.gravar('claude-sonnet-5-5')
  const d = criarDisparo({ raiz, dadosApp: tmp(), claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }), modelo: () => m.args(),
    executar: async (args) => { chamadas.push(args); return { codigo: 0, saida: JSON.stringify({ result: '{}' }), erro: '' } } })
  await d.perguntar('obra', 'oi')
  const a = chamadas[0]
  assert.equal(a[a.indexOf('--model') + 1], 'claude-sonnet-5-5')
})

test('economia (Luiz, 24/11/2026): a construção da obra só usa o Opus no plano Max; no Pro (ou sem saber o plano), vai de Sonnet', () => {
  const m = criarModelo({ pasta: tmp() })
  assert.deepEqual(m.argsDaLinha('max'), ['--model', 'claude-opus-5-5'])
  assert.deepEqual(m.argsDaLinha('pro'), ['--model', 'claude-sonnet-5-5'])
  assert.deepEqual(m.argsDaLinha(null), ['--model', 'claude-sonnet-5-5'])
  m.gravar('claude-haiku-5-5')
  assert.deepEqual(m.argsDaLinha('pro'), ['--model', 'claude-haiku-5-5'], 'escolha mais econômica fica')
  assert.match(MODELOS.find((x) => x.id === 'claude-opus-5-5').explica, /Max/)
})
