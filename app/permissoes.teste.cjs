'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { permissaoDoApp } = require('./permissoes.cjs')

// Achado em 26/11/2026 (Luiz, tela "Fez o protótipo em outra IA?"): "Copiar recado" dava "Não consegui copiar sozinho". O Atlas
// negava toda permissão menos o microfone, e o Chromium pede permissão para ESCREVER na área de transferência.
test('a janela do Atlas pode usar o microfone e copiar para a área de transferência; o resto continua negado', () => {
  assert.equal(permissaoDoApp('media'), true)
  assert.equal(permissaoDoApp('clipboard-sanitized-write'), true)
  for (const p of ['clipboard-read', 'geolocation', 'notifications', 'camera', 'openExternal', 'midi', '']) assert.equal(permissaoDoApp(p), false, p)
})

test('o processo principal usa a mesma regra nos dois pontos (pedido e conferência)', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8')
  assert.match(main, /setPermissionRequestHandler\(\(wc, permissao, ok, detalhes\) => ok\(permissaoDoApp\(permissao\)/)
  assert.match(main, /setPermissionCheckHandler\(\(wc, permissao, origem\) => permissaoDoApp\(permissao\)/)
})
