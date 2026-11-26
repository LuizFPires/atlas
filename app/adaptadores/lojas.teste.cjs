'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarLojas, pacoteDoNome, chaveAscValida } = require('./lojas.cjs')

function obra() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'lojas-'))
  fs.mkdirSync(path.join(raiz, 'ponto', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'ponto', '.atlas', 'no-ar.json'), JSON.stringify({ versao: 1, nome: 'pontoampla', endereco: 'https://pontoampla.vercel.app' }))
  return raiz
}
function cofreMem() { const m = new Map(); return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => { m.set(k, v) }, _m: m } }
const P8 = '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg' + 'a'.repeat(40) + '\n-----END PRIVATE KEY-----\n'

function deps(over = {}) {
  const chamadas = []
  const cofre = cofreMem()
  cofre._m.set('atlas/dispositivo', JSON.stringify({ token: 'tok', email: 'ana@loja.com' }))
  const buscar = async (url, init) => {
    const corpo = JSON.parse(init.body)
    chamadas.push({ url, corpo, cab: init.headers })
    if (url.endsWith('/lojas/convite')) return { ok: true, json: async () => ({ codigo: 'abcdefghjk23', link: 'https://atlas.test/teste/abcdefghjk23' }) }
    if (url.endsWith('/lojas/testadores')) return { ok: true, json: async () => ({ pessoas: 9, faltam: 3, dia: 0, completo: false, nomes: [] }) }
    return { ok: false, json: async () => ({ erro: 'x' }) }
  }
  return { d: { raiz: obra(), cofre, hashComputador: async () => 'h'.repeat(64), api: 'https://api.test', buscar, ...over }, chamadas, cofre }
}

test('pacoteDoNome: o identificador do app sai do endereço (br.com.<nome>.app)', () => {
  assert.equal(pacoteDoNome('pontoampla'), 'br.com.pontoampla.app')
  assert.equal(pacoteDoNome('ponto-ampla'), 'br.com.pontoampla.app')
  assert.equal(pacoteDoNome('2ponto'), 'br.com.app2ponto.app')
})

test('escolher o caminho e marcar as contas fica salvo na obra, sem segredo', async () => {
  const { d } = deps()
  const l = criarLojas(d)
  await l.escolher('ponto', 'pessoa')
  await l.marcarConta('ponto', 'apple', true)
  const e = await l.estado('ponto')
  assert.equal(e.caminho, 'pessoa')
  assert.equal(e.contas.apple, true)
  assert.equal(e.contas.google, false)
  assert.equal(e.pacote, 'br.com.pontoampla.app')
  await assert.rejects(l.escolher('ponto', 'outro'), /caminho-invalido/)
  await assert.rejects(l.marcarConta('ponto', 'banco', true), /conta-invalida/)
})

test('chave da App Store Connect: confere o formato e guarda SÓ no cofre (nunca na obra)', async () => {
  const { d, cofre } = deps()
  const l = criarLojas(d)
  assert.equal(chaveAscValida({ keyId: 'ABC123DEF4', issuerId: '69a6de70-03db-47e3-e053-5b8c7c11a4d1', p8: P8 }), true)
  assert.equal(chaveAscValida({ keyId: 'x', issuerId: 'y', p8: 'z' }), false)
  await l.guardarChaveAsc('ponto', { keyId: 'ABC123DEF4', issuerId: '69a6de70-03db-47e3-e053-5b8c7c11a4d1', p8: P8 })
  assert.match(cofre._m.get('lojas/asc'), /BEGIN PRIVATE KEY/)
  const arquivos = fs.readdirSync(path.join(d.raiz, 'ponto', '.atlas')).map((f) => fs.readFileSync(path.join(d.raiz, 'ponto', '.atlas', f), 'utf8')).join('')
  assert.doesNotMatch(arquivos, /PRIVATE KEY/)
  assert.equal((await l.estado('ponto')).chaveAsc, true)
  await assert.rejects(l.guardarChaveAsc('ponto', { keyId: 'x', issuerId: 'y', p8: 'z' }), /chave-invalida/)
})

test('token da Expo: confere e guarda só no cofre', async () => {
  const { d, cofre } = deps()
  const l = criarLojas(d)
  await l.guardarTokenExpo('A'.repeat(40))
  assert.equal(cofre._m.get('lojas/expo'), 'A'.repeat(40))
  assert.equal((await l.estado('ponto')).contas.expo, true)
  await assert.rejects(l.guardarTokenExpo('curto demais'), /token-invalido/)
})

test('convite dos testadores: só grupo do Google; pede ao servidor com o opt-in do pacote e guarda o link', async () => {
  const { d, chamadas } = deps()
  const l = criarLojas(d)
  await assert.rejects(l.criarConvite('ponto', 'Ponto', 'https://evil.com/g'), /grupo-invalido/)
  const r = await l.criarConvite('ponto', 'Ponto', 'https://groups.google.com/g/ponto-testadores')
  assert.equal(r.link, 'https://atlas.test/teste/abcdefghjk23')
  assert.deepEqual({ ...chamadas[0].corpo, computador_hash: undefined }, { email: 'ana@loja.com', computador_hash: undefined, obra_id: 'ponto', app_nome: 'Ponto', grupo_url: 'https://groups.google.com/g/ponto-testadores', optin_url: 'https://play.google.com/apps/testing/br.com.pontoampla.app' })
  assert.equal((await l.estado('ponto')).convite.link, 'https://atlas.test/teste/abcdefghjk23')
  const t = await l.testadores('ponto')
  assert.equal(t.pessoas, 9)
})
