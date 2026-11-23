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

test('"Atualizar agora": com versão pronta fecha o Atlas (a instalação roda ao sair); sem versão pronta não fecha nada', async () => {
  const { a, execs } = montar()
  let saiu = 0
  assert.equal(a.instalarAgora(() => { saiu++ }), false)
  assert.equal(saiu, 0)
  await a.verificarEBaixar()
  assert.equal(a.instalarAgora(() => { saiu++; a.instalarAoSair() }), true)
  assert.equal(saiu, 1)
  assert.deepEqual(execs.map((e) => e.args), [['/S']], 'o instalador roda uma vez só, ao sair')
})

// Guilherme, 23/11/2026: abriu o Atlas às 11h30 e a versão das 13h só seria procurada às 17h30 (de 6 em 6 horas).
test('com o Atlas aberto, procura versão nova de 2 em 2 minutos e logo 10 s depois de abrir (Luiz: "20 minutos é muito")', () => {
  const { INTERVALO_CONFERENCIA_MS, PRIMEIRA_CONFERENCIA_MS } = require('./atualizador.cjs')
  assert.equal(INTERVALO_CONFERENCIA_MS, 2 * 60_000)
  assert.equal(PRIMEIRA_CONFERENCIA_MS, 10_000)
})

test('diz por que não atualizou: rota inexistente no servidor (404) ≠ licença negada (401/403) ≠ sem internet', async () => {
  const casos = [
    [{ status: 404, resposta: { erro: 'nao-encontrado' } }, 'servidor-sem-rota'],
    [{ status: 401, resposta: { erro: 'negado' } }, 'sem-licenca'],
    [{ status: 403, resposta: { erro: 'negado' } }, 'sem-licenca'],
    [{ status: 500, resposta: { erro: 'x' } }, 'erro-servidor'],
    [{ resposta: { atualizar: false } }, 'atual'],
  ]
  for (const [caso, esperado] of casos) {
    const { a } = montar(caso)
    assert.equal((await a.verificarEBaixar()).estado, esperado, JSON.stringify(caso))
  }
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-atu-'))
  const semRede = criarAtualizador({ versaoAtual: '0.1.0', cofre: cofre(), hashComputador: async () => 'h', api: 'https://api.test/x', buscar: async () => { throw new TypeError('fetch failed') }, pasta, executar: () => {} })
  assert.equal((await semRede.verificarEBaixar()).estado, 'sem-rede')
})

test('guarda a última conferência (estado e quando), para a tela mostrar', async () => {
  const { a } = montar({ resposta: { atualizar: false } })
  assert.equal(a.ultima(), null)
  await a.verificarEBaixar()
  const u = a.ultima()
  assert.equal(u.estado, 'atual')
  assert.equal(u.versaoAtual, '0.1.0')
  assert.ok(Math.abs(Date.now() - u.quando) < 5000)
})

test('servidor responde "sem versão" por falta de configuração/arquivo: não é "atualizado", é problema do servidor', async () => {
  for (const motivo of ['sem-configuracao', 'sem-manifesto', 'sem-link']) {
    const { a } = montar({ resposta: { atualizar: false, motivo } })
    assert.deepEqual(await a.verificarEBaixar(), { estado: 'servidor-sem-versao', motivo })
  }
  const { a } = montar({ resposta: { atualizar: false, motivo: 'atual' } })
  assert.equal((await a.verificarEBaixar()).estado, 'atual')
})

test('enquanto baixa, diz quanto já veio (para a barra de progresso com tempo previsto)', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-atu-'))
  const metade = EXE.subarray(0, 10), resto = EXE.subarray(10)
  let soltar
  const segura = new Promise((ok) => { soltar = ok })
  const corpo = new ReadableStream({
    async start(c) { c.enqueue(metade); await segura; c.enqueue(resto); c.close() },
  })
  const buscar = async (url) => url.endsWith('/atualizacao')
    ? new Response(JSON.stringify({ atualizar: true, versao: '0.1.42', sha512: SHA, tamanho: EXE.length, url: 'https://s/a' }))
    : new Response(corpo)
  const a = criarAtualizador({ versaoAtual: '0.1.0', cofre: cofre(), hashComputador: async () => 'h', api: 'https://api.test/x', buscar, pasta, executar: () => {} })
  assert.equal(a.andamento(), null)
  const fim = a.verificarEBaixar()
  for (let i = 0; i < 50 && !a.andamento()?.baixados; i++) await new Promise((r) => setTimeout(r, 5))
  const meio = a.andamento()
  assert.equal(meio.versao, '0.1.42')
  assert.equal(meio.baixados, 10)
  assert.equal(meio.total, EXE.length)
  assert.ok(typeof meio.inicio === 'number')
  soltar()
  assert.equal((await fim).estado, 'baixada')
  assert.equal(a.andamento(), null, 'terminou: some a barra (aparece o botão)')
})
