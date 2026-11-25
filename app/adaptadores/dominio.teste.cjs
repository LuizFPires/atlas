'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarDominio, dominioValido, PASSOS_DOMINIO } = require('./dominio.cjs')

function obra({ noAr = true } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-'))
  const cwd = path.join(raiz, 'ponto')
  fs.mkdirSync(path.join(cwd, '.atlas'), { recursive: true })
  if (noAr) fs.writeFileSync(path.join(cwd, '.atlas', 'no-ar.json'), JSON.stringify({ versao: 1, nome: 'pontoampla', endereco: 'https://pontoampla.vercel.app' }))
  return { raiz, cwd }
}

const CONFIG = { misconfigured: true, recommendedIPv4: [{ rank: 1, value: ['76.76.21.21'] }], recommendedCNAME: [{ rank: 1, value: 'cname.vercel-dns-017.com.' }] }
const INFO = { domain: { name: 'pontoampla.com.br', intendedNameservers: ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'] } }

function deps(over = {}) {
  const chamadas = { vercel: [], avisos: [], abrir: [] }
  const dns = { mx: [], ns: ['a.dns.br', 'b.dns.br'], a: [], cname: [] }
  const base = {
    vercel: async (args) => {
      chamadas.vercel.push(args)
      if (args[0] === 'api' && String(args[1]).startsWith('/v6/domains/')) return { codigo: 0, saida: JSON.stringify(CONFIG) }
      if (args[0] === 'api' && String(args[1]).startsWith('/v5/domains/')) return { codigo: 0, saida: JSON.stringify(INFO) }
      return { codigo: 0, saida: '' }
    },
    rdap: async () => 200,
    resolvedor: () => ({
      resolveMx: async () => dns.mx, resolveNs: async () => dns.ns,
      resolve4: async () => dns.a, resolveCname: async () => dns.cname,
    }),
    sondar: async () => ({ status: 200 }),
    avisar: async (t, x) => { chamadas.avisos.push(t + ' | ' + x) },
    esperar: async () => {},
    intervaloMs: 1,
    tentativas: 5,
  }
  return { d: { ...base, ...over }, chamadas, dns }
}

test('dominioValido: só domínios do Registro.br, sem esquema nem caminho', () => {
  assert.equal(dominioValido('pontoampla.com.br'), true)
  assert.equal(dominioValido('minhaloja.app.br'), true)
  assert.equal(dominioValido('PontoAmpla.com.br'), false)
  assert.equal(dominioValido('https://pontoampla.com.br'), false)
  assert.equal(dominioValido('pontoampla.com'), false)
  assert.equal(dominioValido('a..com.br'), false)
  assert.equal(dominioValido('-x.com.br'), false)
})

test('conferir: nome livre no Registro.br vira "livre" (para abrir a compra)', async () => {
  const { raiz } = obra()
  const { d } = deps({ rdap: async () => 404 })
  const r = await criarDominio({ raiz, ...d }).conferir('ponto', 'pontoampla.com.br')
  assert.equal(r.situacao, 'livre')
})

test('conferir: registrado, com e-mail no domínio (MX)', async () => {
  const { raiz } = obra()
  const { d, dns } = deps()
  dns.mx = [{ exchange: 'mx.zoho.com', priority: 10 }]
  const r = await criarDominio({ raiz, ...d }).conferir('ponto', 'pontoampla.com.br')
  assert.deepEqual({ situacao: r.situacao, temEmail: r.temEmail, registrador: r.registrador }, { situacao: 'registrado', temEmail: true, registrador: 'Registro.br' })
})

test('conferir: RDAP fora do ar = incerto, nunca livre por palpite', async () => {
  const { raiz } = obra()
  const { d } = deps({ rdap: async () => { throw new Error('timeout') } })
  const r = await criarDominio({ raiz, ...d }).conferir('ponto', 'pontoampla.com.br')
  assert.equal(r.situacao, 'incerto')
})

test('ligar sem e-mail: liga na Vercel ANTES (domínio e www) e pede a troca dos servidores DNS', async () => {
  const { raiz, cwd } = obra()
  const { d, chamadas } = deps()
  const dom = criarDominio({ raiz, ...d })
  const e = await dom.ligar('ponto', 'pontoampla.com.br')
  assert.deepEqual(chamadas.vercel[0], ['domains', 'add', 'pontoampla.com.br', 'pontoampla'])
  assert.deepEqual(chamadas.vercel[1], ['domains', 'add', 'www.pontoampla.com.br', 'pontoampla'])
  assert.equal(e.modo, 'servidores')
  assert.deepEqual(e.servidores, ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'])
  assert.equal(e.passos[0].estado, 'feito')
  const salvo = JSON.parse(fs.readFileSync(path.join(cwd, '.atlas', 'dominio.json'), 'utf8'))
  assert.equal(salvo.dominio, 'pontoampla.com.br')
  assert.doesNotMatch(JSON.stringify(salvo), /token|senha/i)
})

test('ligar com e-mail: não troca os servidores; mostra só os registros que faltam (lidos da Vercel na hora)', async () => {
  const { raiz } = obra()
  const { d, dns } = deps()
  dns.mx = [{ exchange: 'mx.zoho.com', priority: 10 }]
  const e = await criarDominio({ raiz, ...d }).ligar('ponto', 'pontoampla.com.br')
  assert.equal(e.modo, 'registros')
  assert.deepEqual(e.registros, [{ tipo: 'A', nome: '@', valor: '76.76.21.21' }, { tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns-017.com' }])
})

test('ligar: obra que ainda não está no ar não liga domínio', async () => {
  const { raiz } = obra({ noAr: false })
  const { d } = deps()
  await assert.rejects(criarDominio({ raiz, ...d }).ligar('ponto', 'pontoampla.com.br'), /obra-fora-do-ar/)
})

test('ligar: Vercel recusou = erro honesto, nada salvo', async () => {
  const { raiz, cwd } = obra()
  const { d } = deps({ vercel: async () => ({ codigo: 1, saida: 'Error: domain is owned by another team' }) })
  await assert.rejects(criarDominio({ raiz, ...d }).ligar('ponto', 'pontoampla.com.br'), /vercel-dominio/)
  assert.equal(fs.existsSync(path.join(cwd, '.atlas', 'dominio.json')), false)
})

test('vigiar: espera a troca, depois o cadeado, e avisa no celular uma vez', async () => {
  const { raiz } = obra()
  const { d, chamadas, dns } = deps()
  let rodada = 0
  d.esperar = async () => { rodada++; if (rodada === 2) dns.ns = ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'] }
  let sondas = 0
  d.sondar = async () => { sondas++; if (sondas < 2) throw new Error('tls'); return { status: 200 } }
  const dom = criarDominio({ raiz, ...d })
  await dom.ligar('ponto', 'pontoampla.com.br')
  await dom._esperar('ponto')
  const e = dom.estado('ponto')
  assert.equal(e.fase, 'noar')
  assert.equal(e.endereco, 'https://pontoampla.com.br')
  assert.ok(e.passos.every((p) => p.estado === 'feito'))
  assert.equal(chamadas.avisos.length, 1)
  assert.match(chamadas.avisos[0], /pontoampla\.com\.br/)
})

test('vigiar com e-mail: confere o A e o CNAME', async () => {
  const { raiz } = obra()
  const { d, dns } = deps()
  dns.mx = [{ exchange: 'mx.zoho.com', priority: 10 }]
  d.esperar = async () => { dns.a = ['76.76.21.21']; dns.cname = ['cname.vercel-dns-017.com.'] }
  const dom = criarDominio({ raiz, ...d })
  await dom.ligar('ponto', 'pontoampla.com.br')
  await dom._esperar('ponto')
  assert.equal(dom.estado('ponto').fase, 'noar')
})

test('vigiar: passou do tempo sem a troca = "demorando", sem aviso de pronto', async () => {
  const { raiz } = obra()
  const { d, chamadas } = deps({ tentativas: 3 })
  const dom = criarDominio({ raiz, ...d })
  await dom.ligar('ponto', 'pontoampla.com.br')
  await dom._esperar('ponto')
  assert.equal(dom.estado('ponto').fase, 'demorando')
  assert.equal(chamadas.avisos.length, 0)
})

test('estado depois de reabrir o Atlas: lê o arquivo e volta a vigiar sozinho', async () => {
  const { raiz } = obra()
  const { d, dns } = deps()
  d.esperar = async () => { dns.ns = ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'] }
  const primeiro = criarDominio({ raiz, ...d, esperar: () => new Promise(() => {}) })
  await primeiro.ligar('ponto', 'pontoampla.com.br')
  const reaberto = criarDominio({ raiz, ...d })
  assert.equal(reaberto.estado('ponto').fase, 'esperando')
  reaberto.retomar(['ponto'])
  await reaberto._esperar('ponto')
  assert.equal(reaberto.estado('ponto').fase, 'noar')
})

test('PASSOS_DOMINIO segue o protótipo (4 passos)', () => {
  assert.deepEqual(PASSOS_DOMINIO, ['ligado', 'troca', 'internet', 'cadeado'])
})

test('sondarDominio: só o domínio .br do cliente, na raiz, por https', async () => {
  const { sondarDominio } = require('./no-ar-rede.cjs')
  const pedidos = []
  const enviar = async (o) => { pedidos.push(o); return { status: 200 } }
  await sondarDominio('pontoampla.com.br', { enviar })
  assert.deepEqual([pedidos[0].host, pedidos[0].caminho], ['pontoampla.com.br', '/'])
  await assert.rejects(sondarDominio('169.254.169.254', { enviar }), /dominio-invalido/)
  await assert.rejects(sondarDominio('evil.com/x', { enviar }), /dominio-invalido/)
})
