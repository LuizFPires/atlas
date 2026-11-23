'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarObras } = require('./obras.cjs')

const montar = () => { const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-obras-')); return { raiz, o: criarObras({ raiz }) } }
const gravar = (raiz, ...partes) => { const c = path.join(raiz, ...partes); fs.mkdirSync(path.dirname(c), { recursive: true }); fs.writeFileSync(c, 'x') }

test('situação da obra: lê só o que cada etapa deixou na pasta', async () => {
  const { raiz, o } = montar()
  fs.mkdirSync(path.join(raiz, 'so-nome'))
  assert.deepEqual(await o.situacao('so-nome'), { estilo: false, prototipo: false, marca: false, plano: false })
  gravar(raiz, 'meio', 'design-system.md'); gravar(raiz, 'meio', 'prototipo', 'versoes', 'v001', 'versao.json')
  assert.deepEqual(await o.situacao('meio'), { estilo: true, prototipo: true, marca: false, plano: false })
  gravar(raiz, 'quase', 'design-system-2.md'); gravar(raiz, 'quase', 'prototipo', 'versoes', 'v001', 'versao.json'); gravar(raiz, 'quase', 'marca', 'marca.md')
  assert.deepEqual(await o.situacao('quase'), { estilo: true, prototipo: true, marca: true, plano: false })
  gravar(raiz, 'obra', 'PLAN.md')
  assert.equal((await o.situacao('obra')).plano, true)
})

test('situação: pasta vazia de versões não conta como protótipo; pasta fora da raiz é recusada', async () => {
  const { raiz, o } = montar()
  fs.mkdirSync(path.join(raiz, 'a', 'prototipo', 'versoes'), { recursive: true })
  assert.equal((await o.situacao('a')).prototipo, false)
  await assert.rejects(() => o.situacao('../fora'))
  await assert.rejects(() => o.situacao('nao-existe'))
})
