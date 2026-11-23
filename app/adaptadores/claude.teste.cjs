// Detecção do Claude do cliente (claude auth status). O Atlas só LÊ: conectado, conta e assinatura.
const test = require('node:test')
const assert = require('node:assert/strict')
const { lerEstado } = require('./claude.cjs')

test('pro e max: plano e assinatura', () => {
  assert.deepEqual(lerEstado(JSON.stringify({ loggedIn: true, email: 'a@b.com', subscriptionType: 'max' })), { conectado: true, conta: 'a@b.com', plano: 'max', assinatura: 'max' })
  assert.equal(lerEstado(JSON.stringify({ loggedIn: true, subscriptionType: 'Pro' })).plano, 'pro')
})

test('outra assinatura (ex.: Ultra) aparece no menu, sem fingir que é pro/max', () => {
  const e = lerEstado(JSON.stringify({ loggedIn: true, subscriptionType: 'ultra' }))
  assert.equal(e.assinatura, 'ultra')
  assert.equal(e.plano, undefined)
})

test('valor estranho na assinatura é ignorado', () => {
  for (const t of ['<b>x</b>', 'a'.repeat(40), '', 42]) assert.equal(lerEstado(JSON.stringify({ loggedIn: true, subscriptionType: t })).assinatura, undefined)
  assert.deepEqual(lerEstado('não é json'), { conectado: false })
  assert.deepEqual(lerEstado(JSON.stringify({ loggedIn: false })), { conectado: false })
})

// Conectar com um clique: o Atlas chama o login OFICIAL do Claude Code (o navegador abre na autorização) e não espera por ele.
const { criarClaude: criarC } = require('./claude.cjs')
test('abrirLogin roda `claude auth login --claudeai` sem esperar terminar, e não abre um segundo ao mesmo tempo', async () => {
  const chamadas = []
  let terminar
  const executar = (args, op) => { chamadas.push({ args, op }); return new Promise((r) => { terminar = r }) }
  let conectou = 0
  const c = criarC({ shell: {}, executar, aoConectar: () => { conectou++ } })
  await c.abrirLogin()
  await c.abrirLogin()
  assert.equal(chamadas.length, 1)
  assert.deepEqual(chamadas[0].args, ['auth', 'login', '--claudeai'])
  assert.ok(chamadas[0].op.timeoutMs >= 5 * 60_000)
  terminar({ codigo: 0, saida: 'Login successful', erro: '' })
  await new Promise((r) => setImmediate(r))
  assert.equal(conectou, 1)
  // Terminou: um novo clique abre de novo.
  await c.abrirLogin()
  assert.equal(chamadas.length, 2)
})

test('abrirLogin: Claude Code não instalado vira erro para a tela avisar', async () => {
  const c = criarC({ shell: {}, executar: () => Promise.reject(new Error('claude-nao-instalado')) })
  await assert.rejects(c.abrirLogin(), /claude-nao-instalado/)
})
