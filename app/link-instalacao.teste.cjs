// node --test app/link-instalacao.teste.cjs
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { tokenDoLink, comToken } = require('./link-instalacao.cjs')

const T = 'a'.repeat(30)

test('lê o código do link aberto pelo navegador (atlas://ativar?t=...)', () => {
  assert.equal(tokenDoLink(['C:\\Atlas\\Atlas.exe', `atlas://ativar?t=${T}`]), T)
  assert.equal(tokenDoLink(['Atlas.exe', '--allow-file-access-from-files', `atlas://ativar/?t=${T}`]), T)
})

test('continua aceitando --token= na linha de comando', () => {
  assert.equal(tokenDoLink(['Atlas.exe', '--tela=F02', `--token=${T}`]), T)
})

test('nada que não seja o código puro passa', () => {
  for (const a of ['atlas://ativar', 'atlas://ativar?t=curto', `atlas://outro?t=${T}`, `https://site.test/?t=${T}`, `atlas://ativar?t=${T}%20--tela=F05`, `atlas://ativar?t=${'a'.repeat(200)}`, '--token=', '--token=com espaco e mais de vinte letras', 42, null]) {
    assert.equal(tokenDoLink(['Atlas.exe', a]), '', String(a))
  }
  assert.equal(tokenDoLink(undefined), '')
})

test('comToken troca o código antigo pelo novo, sem repetir', () => {
  assert.deepEqual(comToken(['Atlas.exe', '--tela=F02', '--token=velho'], T), ['Atlas.exe', '--tela=F02', `--token=${T}`])
  assert.deepEqual(comToken(['Atlas.exe', `atlas://ativar?t=${T}`], T), ['Atlas.exe', `--token=${T}`])
})
