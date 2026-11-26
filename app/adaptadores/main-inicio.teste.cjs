// Decisão do Luiz (26/11/2026): o Atlas não abre junto com o Windows/Mac; abre só quando o cliente clica no ícone.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('main.cjs: nunca liga o "abrir junto com o computador" (e desfaz o registro antigo)', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8')
  assert.doesNotMatch(main, /openAtLogin:\s*true/)
  assert.match(main, /setLoginItemSettings\(\{\s*openAtLogin:\s*false\s*\}\)/)
})
