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
