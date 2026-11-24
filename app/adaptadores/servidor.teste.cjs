// node --test app/adaptadores/servidor.teste.cjs
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { criarServidor, ROTAS } = require('./servidor.cjs')

const API = 'https://servidor.test/functions/v1/api'
function montar(resposta = { status: 200, corpo: '{"ok":true}' }, api = API) {
  const pedidos = []
  const buscar = async (url, init) => { pedidos.push({ url, init }); return new Response(resposta.corpo, { status: resposta.status }) }
  return { s: criarServidor({ api, buscar }), pedidos }
}

test('repassa a chamada ao servidor do Atlas e devolve status e corpo', async () => {
  const { s, pedidos } = montar({ status: 429, corpo: '{"mensagem":"Espere."}' })
  const r = await s.postar('/ativar/solicitar-codigo', { email: 'ana@loja.com' }, {})
  assert.deepEqual(r, { status: 429, corpo: '{"mensagem":"Espere."}' })
  assert.equal(pedidos[0].url, `${API}/ativar/solicitar-codigo`)
  assert.equal(pedidos[0].init.method, 'POST')
  assert.equal(pedidos[0].init.redirect, 'error')
  assert.equal(pedidos[0].init.body, '{"email":"ana@loja.com"}')
  assert.equal(pedidos[0].init.headers['Content-Type'], 'application/json')
})

test('só o cabeçalho do dispositivo passa; qualquer outro é descartado', async () => {
  const { s, pedidos } = montar()
  await s.postar('/verificar', { email: 'a@b.com' }, { 'X-Atlas-Dispositivo': 'tok-1', Authorization: 'Bearer x', Cookie: 'a=b', Host: 'outro.test' })
  assert.deepEqual(pedidos[0].init.headers, { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': 'tok-1' })
})

test('só as rotas da lista; a tela não escolhe outro endereço', async () => {
  const { s, pedidos } = montar()
  for (const rota of ['/admin/cortesia', '/ativar/confirmar/../../admin', 'https://outro.test/x', '//outro.test/x', '/verificar?x=1', '', null, 42]) {
    await assert.rejects(() => s.postar(rota, {}, {}), /rota-nao-permitida/)
  }
  assert.equal(pedidos.length, 0)
  assert.ok(ROTAS.includes('/ativar/solicitar-codigo') && ROTAS.includes('/ativar/confirmar') && ROTAS.includes('/verificar'))
  assert.ok(ROTAS.includes('/ativar/solicitar-codigo-link')) // código automático pelo link do e-mail (22/11/2026)
})

test('corpo precisa ser um objeto simples e pequeno', async () => {
  const { s, pedidos } = montar()
  await assert.rejects(() => s.postar('/verificar', 'texto', {}), /corpo-invalido/)
  await assert.rejects(() => s.postar('/verificar', [1, 2], {}), /corpo-invalido/)
  await assert.rejects(() => s.postar('/verificar', { x: 'a'.repeat(20_001) }, {}), /corpo-invalido/)
  assert.equal(pedidos.length, 0)
})

test('sem endereço https do servidor, falha fechada', async () => {
  for (const api of [null, '', 'http://servidor.test/api', 'https://user:senha@servidor.test/api', 'nada']) {
    const { s, pedidos } = montar(undefined, api)
    await assert.rejects(() => s.postar('/verificar', {}, {}), /servidor-indisponivel/)
    assert.equal(pedidos.length, 0)
  }
})

test('rede fora vira sem-conexao; resposta grande demais é cortada', async () => {
  const cai = criarServidor({ api: API, buscar: async () => { throw new Error('ECONNRESET') } })
  await assert.rejects(() => cai.postar('/verificar', {}, {}), /sem-conexao/)
  const { s } = montar({ status: 200, corpo: 'x'.repeat(50_000) })
  assert.equal((await s.postar('/verificar', {}, {})).corpo.length, 20_000)
})

test('M33: as rotas do celular passam, com limites próprios para as telas e as fotos', async () => {
  for (const r of ['/celular/sinal', '/celular/resposta', '/celular/projeto', '/celular/referencia', '/status-obras/publicar']) assert.ok(ROTAS.includes(r), r)
  const grande = 'x'.repeat(3_500_000)
  const s = criarServidor({ api: 'https://api.test', buscar: async () => new Response(grande, { status: 200 }) })
  // As telas (até 1,5 MB) sobem; o mesmo tamanho em outra rota é recusado.
  await s.postar('/celular/projeto', { documento: 'd'.repeat(1_500_000) }, {})
  await assert.rejects(s.postar('/verificar', { documento: 'd'.repeat(1_500_000) }, {}), /corpo-invalido/)
  // A foto de referência (até ~2,8 MB em base64) desce inteira; nas outras rotas a resposta continua cortada.
  assert.equal((await s.postar('/celular/referencia', {}, {})).corpo.length, 3_000_000)
  assert.equal((await s.postar('/celular/sinal', {}, {})).corpo.length, 300_000)
  assert.equal((await s.postar('/verificar', {}, {})).corpo.length, 20_000)
})

// M42 (24/11/2026): o protótipo cresce além de 40 telas; o celular aceita até 10 MB (prototipo-link.ts). Antes, aqui, o corpo
// parava em 1,6 MB e as telas de um protótipo grande nunca chegavam ao celular.
test('protótipo grande (5 MB) sobe para o celular; e o aviso do celular (M41) é uma rota permitida', async () => {
  const { s } = montar({ status: 200, corpo: '{}' })
  await s.postar('/celular/projeto', { documento: 'd'.repeat(5_000_000) }, {})
  await s.postar('/celular/avisar', { titulo: 'A obra voltou', texto: 'x' }, {})
})
