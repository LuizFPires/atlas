// Teste do modo da obra (node --test app/adaptadores/*.teste.cjs). Fora do gate do CI; usa pasta temporária.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarModo, gravarRecomendadoGlobal } = require('./modo.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-modo-'))

test('grava e lê o modo; troca depois', async () => {
  const raiz = tmp(); fs.mkdirSync(path.join(raiz, 'obra-1'))
  const m = criarModo({ raiz })
  assert.equal(await m.ler('obra-1'), null)
  await m.gravar('obra-1', 'passo-a-passo')
  assert.equal(await m.ler('obra-1'), 'passo-a-passo')
  await m.gravar('obra-1', 'automatico')
  assert.equal(await m.ler('obra-1'), 'automatico')
  const j = JSON.parse(fs.readFileSync(path.join(raiz, 'obra-1', '.atlas', 'modo.json'), 'utf8'))
  assert.equal(j.versao, 1)
  assert.ok(!fs.readdirSync(path.join(raiz, 'obra-1', '.atlas')).some((n) => n.endsWith('.tmp')))
})

test('recusa modo, pasta e caminho inválidos', async () => {
  const raiz = tmp(); fs.mkdirSync(path.join(raiz, 'obra-1'))
  const m = criarModo({ raiz })
  await assert.rejects(m.gravar('obra-1', 'qualquer'), /modo-invalido/)
  await assert.rejects(m.gravar('../fora', 'automatico'), /obra-invalida/)
  await assert.rejects(m.gravar('nao-existe', 'automatico'), /obra-inexistente/)
})

test('arquivo estragado vira null', async () => {
  const raiz = tmp(); fs.mkdirSync(path.join(raiz, 'o', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'o', '.atlas', 'modo.json'), '{lixo')
  assert.equal(await criarModo({ raiz }).ler('o'), null)
})

test('recomendado.json global: automatico => ativo true; passo a passo => false; preserva campos', () => {
  const home = tmp()
  assert.equal(gravarRecomendadoGlobal('automatico', { home }).ativo, true)
  const arq = path.join(home, '.claude', 'recomendado.json')
  fs.writeFileSync(arq, JSON.stringify({ ativo: true, desde: 'x', ate: 'M12', checkpoint: 5 }))
  const r = gravarRecomendadoGlobal('passo-a-passo', { home })
  assert.equal(r.ativo, false); assert.equal(r.ate, 'M12'); assert.equal(r.checkpoint, 5)
  assert.equal(JSON.parse(fs.readFileSync(arq, 'utf8')).ativo, false)
})
