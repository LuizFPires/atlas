// Teste do adaptador de nomes (node --test app/adaptadores/*.teste.cjs). SEM rede: DNS e transporte são simulados.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { criarNomes, pedirStatus, criarLookupSeguro, ipPublico, livreDoStatus } = require('./nomes.cjs')

test('ipPublico: recusa loopback, privados, link-local, CGNAT, ULA, mapeados e lixo; aceita públicos', () => {
  for (const ruim of ['127.0.0.1', '127.1.2.3', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::7f00:1', '2002:7f00:1::', 'localhost', '', 'a.b', '1.2.3', '0x7f.1']) assert.equal(ipPublico(ruim), false, ruim)
  for (const bom of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(ipPublico(bom), true, bom)
})

const lookupCom = (enderecos, erro = null) => criarLookupSeguro((h, o, cb) => (erro ? cb(erro) : cb(null, enderecos)))
const chamar = (lk, opcoes = {}) => new Promise((res) => lk('x.test', opcoes, (e, a, f) => res({ e, a, f })))

test('lookup seguro: bloqueia se QUALQUER endereço for privado (rebinding misto), entrega só IP validado', async () => {
  assert.equal((await chamar(lookupCom([{ address: '127.0.0.1', family: 4 }]))).e.message, 'ip-nao-publico')
  assert.equal((await chamar(lookupCom([{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]))).e.message, 'ip-nao-publico')
  assert.equal((await chamar(lookupCom([{ address: '::1', family: 6 }]))).e.message, 'ip-nao-publico')
  assert.equal((await chamar(lookupCom([]))).e.message, 'ip-nao-publico')
  assert.equal((await chamar(lookupCom(null, new Error('ENOTFOUND')))).e.message, 'ENOTFOUND')
  const ok = await chamar(lookupCom([{ address: '8.8.8.8', family: 4 }]))
  assert.deepEqual([ok.e, ok.a, ok.f], [null, '8.8.8.8', 4])
  const todos = await chamar(lookupCom([{ address: '8.8.8.8', family: 4 }]), { all: true })
  assert.deepEqual(todos.a, [{ address: '8.8.8.8', family: 4 }])
})

test('pedirStatus: host fora da allowlist e caminho estranho são recusados antes de qualquer rede', async () => {
  await assert.rejects(pedirStatus('localhost', '/x'), /host-nao-permitido/)
  await assert.rejects(pedirStatus('127.0.0.1', '/x'), /host-nao-permitido/)
  await assert.rejects(pedirStatus('169.254.169.254', '/latest/meta-data'), /host-nao-permitido/)
  await assert.rejects(pedirStatus('rdap.registro.br.evil.com', '/domain/a.com.br'), /host-nao-permitido/)
  await assert.rejects(pedirStatus('rdap.registro.br', '/domain/../../x'), /caminho-invalido/)
  await assert.rejects(pedirStatus('rdap.registro.br', 'http://x'), /caminho-invalido/)
})

test('pedirStatus: mesmo com host liberado, nome que resolve para 127.0.0.1 não conecta (lookup seguro padrão)', async () => {
  await assert.rejects(pedirStatus('localhost', '/x', { hostsPermitidos: ['localhost'], timeoutMs: 3000 }), /ip-nao-publico|ENOTFOUND|EAI_AGAIN/)
})

test('pedirStatus: 3xx devolve o status (quem chama trata como "não deu"); nunca segue Location', async () => {
  const chamadas = []
  const cliente = { request: (o, cb) => { chamadas.push(o); const req = { destroy() {}, on() { return req }, end() { setImmediate(() => cb({ statusCode: 302, headers: { location: 'https://evil.test/' } })) } }; return req } }
  const s = await pedirStatus('rdap.registro.br', '/domain/a.com.br', { cliente })
  assert.equal(s, 302)
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].agent, false)
  assert.equal(chamadas[0].port, 443)
  assert.equal(chamadas[0].protocol, 'https:')
  assert.equal(typeof chamadas[0].lookup, 'function')
  assert.equal(livreDoStatus(302), null)
})

test('conferir: 404 livre, 200 ocupado, qualquer outra coisa ou erro = null; nunca "livre" por palpite', async () => {
  const visto = []
  const respostas = { 'rdap.registro.br': 200, 'pubapi.registry.google': 404 }
  const n = criarNomes({ pedir: async (h, c) => { visto.push([h, c]); return respostas[h] } })
  const r = await n.conferir('Cadeira 1')
  assert.deepEqual(r.enderecos, [{ dominio: 'cadeira1.app', livre: true }, { dominio: 'cadeira1.com.br', livre: false }])
  assert.deepEqual(visto.sort(), [['pubapi.registry.google', '/rdap/domain/cadeira1.app'], ['rdap.registro.br', '/domain/cadeira1.com.br']].sort())
  assert.deepEqual(r.parecidos, [])
  for (const status of [500, 429, 302, 403, undefined]) {
    const x = await criarNomes({ pedir: async () => status }).conferir('Navalha')
    assert.ok(x.enderecos.every((e) => e.livre === null), String(status))
  }
  const falha = await criarNomes({ pedir: async () => { throw new Error('ECONNRESET') } }).conferir('Navalha')
  assert.ok(falha.enderecos.every((e) => e.livre === null))
})

test('conferir: nome inválido não chega à rede; host e caminho nunca vêm do cliente; cache evita repetir', async () => {
  let chamadas = 0
  const n = criarNomes({ pedir: async () => { chamadas++; return 404 } })
  await assert.rejects(n.conferir('a'), /nome-invalido/)
  await assert.rejects(n.conferir('!!!'), /nome-invalido/)
  await assert.rejects(n.conferir(''), /nome-invalido/)
  assert.equal(chamadas, 0)
  const vistos = []
  const m = criarNomes({ pedir: async (h, c) => { vistos.push(h + c); return 404 } })
  await m.conferir('evil.com/../x?y=http://169.254.169.254')
  assert.ok(vistos.every((v) => /^(pubapi\.registry\.google\/rdap\/domain\/|rdap\.registro\.br\/domain\/)[a-z0-9]+\.(app|com\.br)$/.test(v)), vistos.join())
  await n.conferir('Loja Boa'); await n.conferir('Loja Boa')
  assert.equal(chamadas, 2)
})
