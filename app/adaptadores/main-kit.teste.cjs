// Toda porta que liga a linha da obra pelo pós-obra precisa pegar o kit antes (bug do Ponto, 26/11/2026:
// o "Corrigir e continuar" da vistoria chamava o pós-obra sem o kit e a linha recusava com "kit-faltando").
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('main.cjs: todo posobra.executar vem depois de garantirObra (kit da obra entregue antes de ligar a linha)', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8')
  const linhas = main.split(/\r?\n/).filter((l) => l.includes('posobra.executar('))
  assert.ok(linhas.length >= 4)
  for (const l of linhas) assert.match(l.slice(0, l.indexOf('posobra.executar(')), /await garantirObra\(/, l.trim().slice(0, 120))
})
