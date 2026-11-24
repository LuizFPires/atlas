// Teste do aviso no celular (M41). Nunca trava a obra: sem credencial, sem internet ou sem os avisos ligados, só não avisa.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { criarAvisoCelular, textoDoAviso } = require('./aviso-celular.cjs')

const cofre = (g) => ({ ler: async () => (g ? JSON.stringify(g) : null) })

test('avisa pelo servidor com a credencial no cabeçalho, sem nada além de título e texto', async () => {
  const chamadas = []
  const a = criarAvisoCelular({ cofre: cofre({ token: 'tok', email: 'ana@loja.com' }), hashComputador: async () => 'h'.repeat(64), api: 'https://api.test/functions/v1/api', buscar: async (url, init) => { chamadas.push({ url, init }); return new Response('{"enviados":1}') } })
  assert.equal(await a.avisar('A obra voltou', 'A cota do Claude renovou.'), true)
  assert.equal(chamadas[0].url, 'https://api.test/functions/v1/api/celular/avisar')
  assert.equal(chamadas[0].init.headers['X-Atlas-Dispositivo'], 'tok')
  assert.deepEqual(JSON.parse(chamadas[0].init.body), { email: 'ana@loja.com', computador_hash: 'h'.repeat(64), titulo: 'A obra voltou', texto: 'A cota do Claude renovou.' })
})

test('sem credencial ou sem internet: não avisa e não quebra', async () => {
  assert.equal(await criarAvisoCelular({ cofre: cofre(null), hashComputador: async () => 'h', api: 'https://api.test', buscar: async () => { throw new Error('x') } }).avisar('a', 'b'), false)
  assert.equal(await criarAvisoCelular({ cofre: cofre({ token: 't', email: 'e' }), hashComputador: async () => 'h', api: 'https://api.test', buscar: async () => { throw new Error('offline') } }).avisar('a', 'b'), false)
})

test('os textos dos avisos (cota voltou, parou, pronta) são de leigo e levam o nome da obra', () => {
  assert.deepEqual(textoDoAviso('voltou', 'Barbearia'), { titulo: 'A obra voltou a trabalhar', texto: 'A cota do Claude renovou e a obra Barbearia voltou a trabalhar sozinha.' })
  assert.match(textoDoAviso('parou', 'Barbearia', 'Sem internet.').texto, /Barbearia parou\. Sem internet\./)
  assert.equal(textoDoAviso('pronta', 'Barbearia').titulo, 'A obra ficou pronta')
})
