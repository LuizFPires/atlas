// node --test app/pagamento.teste.cjs
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { urlOficial, HOSTS_PAGAMENTO, HOSTS_OFICIAIS } = require('./seguro-puro.cjs')
const { ROTAS } = require('./adaptadores/servidor.cjs')

test('o app só abre no navegador a página de pagamento da Stripe', () => {
  assert.deepEqual([...HOSTS_PAGAMENTO], ['checkout.stripe.com'])
  assert.equal(urlOficial('https://checkout.stripe.com/c/pay/cs_test_a1b2#fid', HOSTS_PAGAMENTO), 'https://checkout.stripe.com/c/pay/cs_test_a1b2#fid')
})

test('qualquer outro endereço é recusado, mesmo parecido', () => {
  for (const u of ['http://checkout.stripe.com/c/pay/x', 'https://checkout.stripe.com.golpe.test/pay', 'https://golpe.test/checkout.stripe.com', 'https://user:senha@checkout.stripe.com/x', 'https://checkout.stripe.com:8443/x', 'https://stripe.com/x', 'javascript:alert(1)', 'file:///C:/x', '', null]) {
    assert.throws(() => urlOficial(u, HOSTS_PAGAMENTO), /host-nao-permitido|url-invalida/, String(u))
  }
})

test('a lista de pagamento não se mistura com a dos sites oficiais', () => {
  assert.ok(!HOSTS_OFICIAIS.includes('checkout.stripe.com'))
  assert.throws(() => urlOficial('https://github.com/x', HOSTS_PAGAMENTO), /host-nao-permitido/)
})

test('a ponte do servidor aceita as rotas do contador e da compra', () => {
  assert.ok(ROTAS.includes('/licenca/resumo'))
  assert.ok(ROTAS.includes('/pagamento/checkout'))
  // 6 rotas da ativação/compra + 5 do celular (M33) + o aviso no celular (M41), testadas em servidor.teste.cjs.
  assert.equal(ROTAS.length, 12)
})
