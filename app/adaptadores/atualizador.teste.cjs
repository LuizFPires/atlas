'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { criarAtualizador } = require('./atualizador.cjs')

const EXE = Buffer.from('MZ instalador novo do Atlas')
const SHA = crypto.createHash('sha512').update(EXE).digest('base64')
const cofre = (v = JSON.stringify({ token: 'tok', email: 'ana@loja.com' })) => ({ ler: async () => v })

function montar({ resposta = { atualizar: true, versao: '0.1.42', sha512: SHA, tamanho: EXE.length, url: 'https://s.supabase.co/assinado' }, exe = EXE, guardado, status = 200 } = {}) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-atu-'))
  const chamadas = []
  const execs = []
  const buscar = async (url, init = {}) => {
    chamadas.push({ url, init })
    if (url.endsWith('/atualizacao')) return new Response(JSON.stringify(resposta), { status })
    return new Response(exe, { status: 200 })
  }
  const a = criarAtualizador({ versaoAtual: '0.1.0', cofre: cofre(guardado), hashComputador: async () => 'h'.repeat(64), api: 'https://api.test/functions/v1/api', buscar, pasta, executar: (cmd, args) => execs.push({ cmd, args }) })
  return { a, pasta, chamadas, execs }
}

test('versão nova: pergunta com a credencial no cabeçalho, baixa, confere a impressão digital e deixa pronta', async () => {
  const { a, chamadas, pasta } = montar()
  const r = await a.verificarEBaixar()
  assert.deepEqual(r, { estado: 'baixada', versao: '0.1.42' })
  assert.equal(chamadas[0].init.headers['X-Atlas-Dispositivo'], 'tok')
  assert.deepEqual(JSON.parse(chamadas[0].init.body), { email: 'ana@loja.com', computador_hash: 'h'.repeat(64), versao: '0.1.0' })
  assert.equal(a.pronta().versao, '0.1.42')
  assert.ok(fs.readFileSync(a.pronta().caminho).equals(EXE))
  assert.ok(a.pronta().caminho.startsWith(pasta))
})

test('arquivo adulterado (impressão digital diferente) é jogado fora e nada fica pronto', async () => {
  const { a, pasta } = montar({ exe: Buffer.from('MZ arquivo trocado no meio do caminho') })
  const r = await a.verificarEBaixar()
  assert.equal(r.estado, 'erro')
  assert.equal(a.pronta(), null)
  assert.deepEqual(fs.readdirSync(pasta).filter((n) => n.endsWith('.exe') || n.endsWith('.part')), [])
})

test('ao fechar o Atlas com uma versão pronta: instala em silêncio; sem versão pronta não faz nada', async () => {
  const { a, execs } = montar()
  assert.equal(a.instalarAoSair(), false)
  await a.verificarEBaixar()
  assert.equal(a.instalarAoSair(), true)
  assert.equal(execs.length, 1)
  assert.deepEqual(execs[0].args, ['/S'])
  assert.equal(a.instalarAoSair(), false, 'instala uma vez só')
})

test('já atualizado, sem ativação no cofre ou servidor negando: nada é baixado', async () => {
  for (const caso of [{ resposta: { atualizar: false } }, { guardado: null }, { status: 403, resposta: { erro: 'negado' } }]) {
    const { a, chamadas } = montar(caso)
    const r = await a.verificarEBaixar()
    assert.notEqual(r.estado, 'baixada')
    assert.ok(chamadas.every((c) => c.url.endsWith('/atualizacao')))
    assert.equal(a.pronta(), null)
  }
})

test('resposta estranha do servidor (endereço http, versão mais velha, tamanho diferente) não baixa nem instala', async () => {
  for (const resposta of [
    { atualizar: true, versao: '0.1.42', sha512: SHA, tamanho: EXE.length, url: 'http://inseguro/x' },
    { atualizar: true, versao: '0.0.9', sha512: SHA, tamanho: EXE.length, url: 'https://s/x' },
    { atualizar: true, versao: '0.1.42', sha512: SHA, tamanho: EXE.length + 1, url: 'https://s/x' },
  ]) {
    const { a } = montar({ resposta })
    assert.notEqual((await a.verificarEBaixar()).estado, 'baixada')
    assert.equal(a.pronta(), null)
  }
})

test('a versão pronta sobrevive a reabrir o Atlas; depois de instalada, a sobra é limpa', async () => {
  const m = montar()
  await m.a.verificarEBaixar()
  const reaberto = criarAtualizador({ versaoAtual: '0.1.0', cofre: cofre(), hashComputador: async () => 'h', api: 'https://api.test', buscar: async () => { throw new Error('offline') }, pasta: m.pasta, executar: () => {} })
  assert.equal(reaberto.pronta().versao, '0.1.42')
  const jaNova = criarAtualizador({ versaoAtual: '0.1.42', cofre: cofre(), hashComputador: async () => 'h', api: 'https://api.test', buscar: async () => { throw new Error('offline') }, pasta: m.pasta, executar: () => {} })
  assert.equal(jaNova.pronta(), null)
  assert.deepEqual(fs.readdirSync(m.pasta), [])
})
