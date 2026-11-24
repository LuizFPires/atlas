'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { criarLinkCelular } = require('./link-celular.cjs')

const DOC = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><section id="tela-a">oi</section>'
const URL_OK = 'https://atlas-ia.app.br/p/' + 'A'.repeat(43)
function montar(resposta = { url: URL_OK, expira_em: '2026-11-30T03:00:00.000Z' }, status = 200) {
  const chamadas = [], abertos = []
  const l = criarLinkCelular({
    cofre: { ler: async () => JSON.stringify({ token: 'tok', email: 'ana@loja.com' }) },
    hashComputador: async () => 'h'.repeat(64), api: 'https://api.test/functions/v1/api',
    buscar: async (url, init) => { chamadas.push({ url, init }); return new Response(JSON.stringify(resposta), { status }) },
    shell: { openExternal: async (u) => abertos.push(u) },
  })
  return { l, chamadas, abertos }
}

test('publica o protótipo protegido com a credencial no cabeçalho e devolve o link do site', async () => {
  const { l, chamadas } = montar()
  assert.deepEqual(await l.publicar('Colore', DOC), { url: URL_OK, expira_em: '2026-11-30T03:00:00.000Z' })
  assert.equal(chamadas[0].url, 'https://api.test/functions/v1/api/prototipo/link')
  assert.equal(chamadas[0].init.headers['X-Atlas-Dispositivo'], 'tok')
  assert.deepEqual(JSON.parse(chamadas[0].init.body), { email: 'ana@loja.com', computador_hash: 'h'.repeat(64), nome: 'Colore', documento: DOC })
})

test('documento sem a proteção do Atlas nem sai do computador', async () => {
  const { l, chamadas } = montar()
  await assert.rejects(l.publicar('x', '<script>alert(1)</script>'), /prototipo-invalido/)
  assert.equal(chamadas.length, 0)
})

test('servidor negou ou devolveu endereço estranho: erro, nunca um link inventado', async () => {
  await assert.rejects(montar({ erro: 'negado' }, 403).l.publicar('x', DOC), /link-negado/)
  await assert.rejects(montar({ url: 'https://phishing.test/p/abc', expira_em: 'x' }).l.publicar('x', DOC), /resposta-estranha/)
})

test('WhatsApp: só abre o link que acabou de ser gerado, sempre pelo wa.me', async () => {
  const { l, abertos } = montar()
  await assert.rejects(l.abrirWhatsApp(URL_OK), /link-desconhecido/)
  await l.publicar('Colore', DOC)
  await l.abrirWhatsApp(URL_OK)
  assert.equal(abertos.length, 1)
  assert.ok(abertos[0].startsWith('https://wa.me/?text='))
  assert.ok(decodeURIComponent(abertos[0]).includes(URL_OK))
  await assert.rejects(l.abrirWhatsApp('https://phishing.test/p/abc'), /link-desconhecido/)
})

test('link do celular aceita protótipo grande (5 MB, M42)', async () => {
  const { l, chamadas } = montar()
  await l.publicar('Colore', DOC + 'x'.repeat(5_000_000))
  assert.equal(chamadas.length, 1)
})
