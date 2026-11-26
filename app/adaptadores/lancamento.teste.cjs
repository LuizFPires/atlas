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
    // Por padrão, obras feitas para vender (a ideia confirmou); o teste do M64 reescreve a de uso interno.
    fs.mkdirSync(path.join(raiz, o, 'prototipo'), { recursive: true })
    fs.writeFileSync(path.join(raiz, o, 'prototipo', 'relato.md'), `${o}\n\n## Para vender a outras empresas (confirmado pelo cliente)`)
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

// M64: obra feita para vender já nasce pronta; a de uso interno passa antes por uma obra de adaptação (com aviso).
test('obra para vender (marcada na ideia): começa direto; uso interno: avisa e só começa pedindo a adaptação à linha', async () => {
  const raiz = raizCom('ponto', 'estoque')
  fs.mkdirSync(path.join(raiz, 'ponto', 'prototipo'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'estoque', 'prototipo', 'relato.md'), 'controle do estoque da minha loja')
  const pedidos = []
  const l = criarLancamento({ raiz, pedirConstrucao: async (pasta, texto) => { pedidos.push({ pasta, texto }) } })
  assert.equal((await l.estado('ponto')).paraVender, true)
  assert.equal((await l.comecar('ponto')).comecado, true)
  assert.equal(pedidos.length, 0)
  assert.equal((await l.estado('estoque')).paraVender, false)
  await assert.rejects(l.comecar('estoque'), /precisa-adaptar/)
  const e = await l.comecar('estoque', { adaptar: true })
  assert.equal(e.comecado, true)
  assert.equal(e.adaptacao, 'pedida')
  assert.equal(pedidos[0].pasta, 'estoque')
  assert.match(pedidos[0].texto, /várias empresas/)
  assert.match(pedidos[0].texto, /dados de hoje/)
})
