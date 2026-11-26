'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarLancamento, PLANOS_SUGERIDOS } = require('./lancamento.cjs')

function raizCom(...obras) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'lanc-'))
  for (const o of obras) {
    fs.mkdirSync(path.join(raiz, o, '.atlas'), { recursive: true })
    fs.writeFileSync(path.join(raiz, o, '.atlas', 'no-ar.json'), JSON.stringify({ versao: 1, nome: `${o}ampla`, endereco: `https://${o}ampla.vercel.app` }))
  }
  return raiz
}

test('opcional: sem começar, nada muda e a obra não aparece em Lançamentos', async () => {
  const raiz = raizCom('ponto', 'estoque')
  const l = criarLancamento({ raiz })
  assert.equal((await l.estado('ponto')).comecado, false)
  assert.deepEqual(await l.listar(), [])
})

test('começar: preços sugeridos (grátis, mensal, anual) e a obra entra em Lançamentos', async () => {
  const raiz = raizCom('ponto', 'estoque')
  const l = criarLancamento({ raiz })
  const e = await l.comecar('ponto')
  assert.equal(e.comecado, true)
  assert.deepEqual(e.planos.map((p) => p.nome), ['Grátis', 'Mensal', 'Anual'])
  assert.deepEqual(PLANOS_SUGERIDOS.map((p) => p.nome), ['Grátis', 'Mensal', 'Anual'])
  const lista = await l.listar()
  assert.equal(lista.length, 1)
  assert.deepEqual({ pasta: lista[0].pasta, endereco: lista[0].endereco, fase: lista[0].fase }, { pasta: 'ponto', endereco: 'pontoampla.vercel.app', fase: 'recebimento' })
})

test('só obra no ar pode ser lançada', async () => {
  const raiz = raizCom()
  fs.mkdirSync(path.join(raiz, 'nova'))
  await assert.rejects(criarLancamento({ raiz }).comecar('nova'), /obra-fora-do-ar/)
})

test('o cliente escolhe Stripe ou Asaas, liga a conta dele e pode trocar antes de ligar; nada de chave em arquivo', async () => {
  const raiz = raizCom('ponto')
  const l = criarLancamento({ raiz })
  await l.comecar('ponto')
  await assert.rejects(l.escolherGateway('ponto', 'paypal'), /gateway-invalido/)
  await l.escolherGateway('ponto', 'stripe')
  await l.escolherGateway('ponto', 'asaas')
  let e = await l.estado('ponto')
  assert.equal(e.gateway, 'asaas')
  assert.equal(e.contaPronta, false)
  e = await l.contaPronta('ponto')
  assert.equal(e.contaPronta, true)
  assert.equal((await l.listar())[0].fase, 'pagina')
  assert.doesNotMatch(fs.readFileSync(path.join(raiz, 'ponto', '.atlas', 'lancamento.json'), 'utf8'), /sk_|secret|token/i)
})
