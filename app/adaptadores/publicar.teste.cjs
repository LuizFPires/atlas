// Teste da publicação (node --test app/adaptadores/*.teste.cjs). Sem rede, sem Electron, sem Vercel: tudo simulado.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const { criarPublicar, enderecoOficial, dominioValido, registroDnsValido, enderecoDoSistema, registrosDaConfigVercel, pedirJson, SITES_OFICIAIS, HOSTS_OFICIAIS } = require('./publicar.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-pub-'))
const cofreCom = (c = {}) => ({ ler: async (k) => (Object.hasOwn(c, k) ? c[k] : null) })

function montar(extra = {}) {
  const raiz = tmp()
  fs.mkdirSync(path.join(raiz, 'obra'))
  const abertos = []
  const shell = { openExternal: async (u) => abertos.push(u) }
  const pub = criarPublicar({ raiz, shell, cofre: cofreCom(), ...extra })
  return { raiz, abertos, pub }
}

function carregarTs(entrada) {
  const ts = require('typescript')
  const cache = new Map()
  const carregar = (arquivo) => {
    if (cache.has(arquivo)) return cache.get(arquivo).exports
    const js = ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const m = { exports: {} }
    cache.set(arquivo, m)
    const req = (spec) => (spec.startsWith('.') ? carregar(path.resolve(path.dirname(arquivo), `${spec}.ts`)) : require(spec))
    require('node:vm').compileFunction(js, ['exports', 'require', 'module'])(m.exports, req, m)
    return m.exports
  }
  return carregar(entrada)
}

test('PARIDADE: listas e validadores == TypeScript', (t) => {
  let TS, ED
  try {
    TS = carregarTs(path.join(__dirname, '..', '..', 'src', 'app', 'ponte-publicar.ts'))
    ED = carregarTs(path.join(__dirname, '..', '..', 'src', 'app', 'entrega-dados.ts'))
  } catch (e) { t.skip(`typescript indisponível: ${e.message}`); return }
  assert.deepEqual({ ...TS.SITES_OFICIAIS }, { ...SITES_OFICIAIS })
  assert.deepEqual([...TS.HOSTS_OFICIAIS], [...HOSTS_OFICIAIS])
  for (const u of ['https://registro.br/', 'http://registro.br/', 'https://registro.br:8443/', 'https://u@registro.br/', 'https://registro.br.evil.com/', 'https://evilregistro.br/', 'https://www.registro.br/', 'https://127.0.0.1/', 'javascript:alert(1)', 'lixo']) assert.equal(enderecoOficial(u), TS.enderecoOficial(u), u)
  for (const d of ['a.com.br', 'A.com.br', 'a.com', 'a..com.br', '-a.com.br', 'a.com.br/x', 'a.com.br:80', '1.2.3.4', 'meu-site.com.br', 'x'.repeat(64) + '.com.br']) assert.equal(dominioValido(d), TS.dominioValido(d), d)
  const regs = [{ tipo: 'A', nome: '@', valor: '76.76.21.21' }, { tipo: 'A', nome: '@', valor: '127.0.0.1' }, { tipo: 'A', nome: '@', valor: '10.0.0.1' }, { tipo: 'A', nome: 'www', valor: '1.1.1.1' }, { tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' }, { tipo: 'CNAME', nome: 'www', valor: 'localhost' }, { tipo: 'CNAME', nome: 'w w', valor: 'a.b.com' }, { tipo: 'MX', nome: '@', valor: 'a.b.com' }, { tipo: 'A', nome: '@', valor: '999.1.1.1' }]
  for (const r of regs) assert.equal(registroDnsValido(r), TS.registroDnsValido(r), JSON.stringify(r))
  for (const e of ['x.vercel.app', 'https://x.vercel.app', 'http://x.vercel.app/', 'x.vercel.app:81', 'https://u:p@x.vercel.app', 'meusite.com.br', 'www.meusite.com.br', 'x.vercel.app/a', 'https://evil.com', '127.0.0.1', 'x.vercel.app?a=1', 'javascript:alert(1)', 'a b.com.br']) assert.equal(enderecoDoSistema(e), ED.enderecoDoSistema(e), e)
})

test('abrirSite: só o NOME do destino; URL fixa; nada de URL vinda de dado', async () => {
  const { pub, abertos } = montar()
  await pub.abrirSite('registro')
  await pub.abrirSite('google-console')
  await pub.abrirSite('registro', 'meusite.com.br')
  assert.deepEqual(abertos, ['https://registro.br/', 'https://play.google.com/console/signup', 'https://registro.br/'])
  for (const d of ['https://evil.example', 'registro.br', '__proto__', 'constructor', '', undefined, 3]) await assert.rejects(pub.abrirSite(d), /destino-invalido/)
  for (const dom of ['meusite.com', 'https://evil.com.br', 'a.com.br/x', '1.2.3.4']) await assert.rejects(pub.abrirSite('registro', dom), /dominio-invalido/)
  assert.equal(abertos.length, 3)
})

test('nomeLivre: 404 livre, 200 ocupado, o resto incerto; domínio inválido nem consulta', async () => {
  const consultas = []
  const resp = { 'a.com.br': 404, 'b.com.br': 200, 'c.com.br': 429, 'd.com.br': 301 }
  const { pub } = montar({ pedirRdap: async (c) => { consultas.push(c); const s = resp[c.split('/').pop()]; if (s === undefined) throw new Error('timeout'); return s } })
  assert.equal(await pub.nomeLivre('a.com.br'), 'livre')
  assert.equal(await pub.nomeLivre('b.com.br'), 'ocupado')
  assert.equal(await pub.nomeLivre('c.com.br'), 'incerto')
  assert.equal(await pub.nomeLivre('d.com.br'), 'incerto') // redirect nunca vira livre
  assert.equal(await pub.nomeLivre('e.com.br'), 'incerto') // falha/timeout
  const antes = consultas.length
  for (const x of ['127.0.0.1', 'a.com', 'a.com.br/../x', 'http://a.com.br', '', undefined]) assert.equal(await pub.nomeLivre(x), 'incerto')
  assert.equal(consultas.length, antes, 'domínio inválido não pode gerar consulta')
  assert.ok(consultas.every((c) => /^\/domain\/[a-z0-9-]+\.com\.br$/.test(c)))
})

test('lerDns: precisa do token do cofre; só registros válidos; nunca valores de exemplo', async () => {
  const cfg = { recommendedIPv4: [{ rank: 2, value: ['10.0.0.1'] }, { rank: 1, value: ['76.76.21.21'] }], recommendedCNAME: [{ rank: 1, value: 'cname.vercel-dns.com.' }] }
  let visto
  const pedirVercel = async (host, caminho, o) => { visto = { host, caminho, o }; return cfg }
  const sem = montar({ pedirVercel })
  await assert.rejects(sem.pub.lerDns('meusite.com.br'), /sem-token-vercel/)
  assert.equal(visto, undefined)
  const com = montar({ pedirVercel, cofre: cofreCom({ 'vercel/token': 'tok-vercel' }) })
  assert.deepEqual(await com.pub.lerDns('meusite.com.br'), [{ tipo: 'A', nome: '@', valor: '76.76.21.21' }, { tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' }])
  assert.equal(visto.host, 'api.vercel.com'); assert.equal(visto.caminho, '/v6/domains/meusite.com.br/config'); assert.equal(visto.o.token, 'tok-vercel')
  await assert.rejects(com.pub.lerDns('https://evil.com'), /dominio-invalido/)
  // resposta com IP privado / estranha => lança (nunca devolve lixo)
  for (const ruim of [{ recommendedIPv4: [{ rank: 1, value: ['127.0.0.1'] }] }, {}, null, 'x']) {
    const m = montar({ pedirVercel: async () => ruim, cofre: cofreCom({ 'vercel/token': 't' }) })
    await assert.rejects(m.pub.lerDns('meusite.com.br'), /dns-indisponivel/)
  }
  await assert.rejects(montar({ pedirVercel: async () => { throw new Error('timeout') }, cofre: cofreCom({ 'vercel/token': 't' }) }).pub.lerDns('meusite.com.br'), /dns-indisponivel/)
  assert.deepEqual(registrosDaConfigVercel({ recommendedCNAME: [{ rank: 1, value: 'localhost' }] }), [])
})

test('pedirJson: host fora da lista, caminho estranho e redirect são recusados antes/sem seguir', async () => {
  await assert.rejects(pedirJson('evil.example', '/v6/x', { token: 't' }), /host-nao-permitido/)
  await assert.rejects(pedirJson('api.vercel.com', '/v6/../x', { token: 't' }), /caminho-invalido/)
  await assert.rejects(pedirJson('api.vercel.com', 'http://x', { token: 't' }), /caminho-invalido/)
  const cliente = (status, corpo) => ({ request: (opts, cb) => {
    const req = new EventEmitter(); req.end = () => setImmediate(() => { const res = new EventEmitter(); res.statusCode = status; res.setEncoding = () => {}; cb(res); if (corpo !== undefined) { res.emit('data', corpo); res.emit('end') } }); req.destroy = () => {}
    assert.equal(opts.host, 'api.vercel.com'); assert.equal(opts.port, 443); assert.equal(opts.protocol, 'https:'); assert.equal(opts.headers.Authorization, 'Bearer t')
    return req
  } })
  await assert.rejects(pedirJson('api.vercel.com', '/v6/x', { token: 't', cliente: cliente(302) }), /resposta-inesperada/)
  await assert.rejects(pedirJson('api.vercel.com', '/v6/x', { token: 't', cliente: cliente(200, 'nao json') }), /resposta-inesperada/)
  await assert.rejects(pedirJson('api.vercel.com', '/v6/x', { token: 't', cliente: cliente(200, 'x'.repeat(200)), maxCorpo: 50 }), /resposta-grande/)
  assert.deepEqual(await pedirJson('api.vercel.com', '/v6/x', { token: 't', cliente: cliente(200, '{"a":1}') }), { a: 1 })
})

test('dnsNoAr: confere todos os registros no DNS público; erro/estranho => false', async () => {
  const regs = [{ tipo: 'A', nome: '@', valor: '76.76.21.21' }, { tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' }]
  const consultado = []
  const dns = (a, c) => () => ({ resolve4: async (d) => { consultado.push(d); if (a instanceof Error) throw a; return a }, resolveCname: async (d) => { consultado.push(d); if (c instanceof Error) throw c; return c } })
  assert.equal(await montar({ resolvedor: dns(['76.76.21.21'], ['cname.vercel-dns.com.']) }).pub.dnsNoAr('meusite.com.br', regs), true)
  assert.deepEqual(consultado, ['meusite.com.br', 'www.meusite.com.br'])
  assert.equal(await montar({ resolvedor: dns(['1.2.3.4'], ['cname.vercel-dns.com']) }).pub.dnsNoAr('meusite.com.br', regs), false)
  assert.equal(await montar({ resolvedor: dns(['76.76.21.21'], ['outro.com']) }).pub.dnsNoAr('meusite.com.br', regs), false)
  assert.equal(await montar({ resolvedor: dns(new Error('ETIMEOUT'), []) }).pub.dnsNoAr('meusite.com.br', regs), false)
  assert.equal(await montar({ resolvedor: dns('lixo', 'lixo') }).pub.dnsNoAr('meusite.com.br', regs), false)
  const n = consultado.length
  const m = montar({ resolvedor: dns(['76.76.21.21'], ['cname.vercel-dns.com']) })
  assert.equal(await m.pub.dnsNoAr('127.0.0.1', regs), false)
  assert.equal(await m.pub.dnsNoAr('meusite.com.br', []), false)
  assert.equal(await m.pub.dnsNoAr('meusite.com.br', [{ tipo: 'A', nome: '@', valor: '127.0.0.1' }]), false) // registro inválido nunca confere
  assert.equal(await m.pub.dnsNoAr('meusite.com.br', 'nao-lista'), false)
  assert.equal(consultado.length, n)
})

test('publicarNoAr: falha honesta; nunca devolve endereço de mentira', async () => {
  await assert.rejects(montar().pub.publicarNoAr('meusite'), /sem-token-vercel/)
  await assert.rejects(montar({ cofre: cofreCom({ 'vercel/token': 't' }) }).pub.publicarNoAr('meusite'), /publicar-nao-implementado/)
  await assert.rejects(montar().pub.publicarNoAr('../x'), /slug-invalido/)
})

test('gerarCartaz: PDF com QR na pasta da obra, nome livre, endereço validado', async () => {
  const { pub, raiz } = montar({ matrizQr: (t) => { assert.equal(t, 'https://meusite.vercel.app'); return Array.from({ length: 21 }, (_, y) => Array.from({ length: 21 }, (_, x) => (x + y) % 3 === 0)) } })
  const r = await pub.gerarCartaz('meusite.vercel.app', 'obra')
  assert.equal(r.arquivo, 'cartaz-instalar-app.pdf')
  const pdf = fs.readFileSync(path.join(raiz, 'obra', 'entrega', r.arquivo), 'latin1')
  assert.ok(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'))
  assert.match(pdf, /meusite\.vercel\.app/)
  assert.ok((pdf.match(/ re f/g) ?? []).length > 100)
  const xref = Number(/startxref\n(\d+)/.exec(pdf)[1])
  assert.ok(pdf.slice(xref).startsWith('xref'))
  const r2 = await pub.gerarCartaz('meusite.vercel.app', 'obra')
  assert.equal(r2.arquivo, 'cartaz-instalar-app-2.pdf')
  for (const e of ['http://127.0.0.1', 'https://evil.com', 'javascript:alert(1)', 'x.vercel.app:81', '']) await assert.rejects(pub.gerarCartaz(e, 'obra'), /endereco-invalido/)
  await assert.rejects(pub.gerarCartaz('meusite.vercel.app', '../fora'), /obra-invalida/)
  await assert.rejects(pub.gerarCartaz('meusite.vercel.app', undefined), /obra-invalida/)
})

test('gerarCartaz com o QR de verdade (qrcode-generator) produz PDF válido', async (t) => {
  try { require('qrcode-generator') } catch { t.skip('qrcode-generator indisponível'); return }
  const { pub, raiz } = montar()
  const r = await pub.gerarCartaz('https://meusite.com.br', 'obra')
  const pdf = fs.readFileSync(path.join(raiz, 'obra', 'entrega', r.arquivo), 'latin1')
  assert.ok(pdf.startsWith('%PDF-1.4') && (pdf.match(/ re f/g) ?? []).length > 200)
})

test('progresso: só {guia,passo}, atômico, dentro da obra; lixo no arquivo => null', async () => {
  const { pub, raiz } = montar()
  assert.equal(await pub.lerProgresso('obra'), null)
  await pub.gravarProgresso('obra', { guia: 'dominio', passo: 3, token: 'segredo-que-nao-pode-ir', extra: 1 })
  const arq = path.join(raiz, 'obra', '.atlas', 'publicar.json')
  const texto = fs.readFileSync(arq, 'utf8')
  assert.ok(!texto.includes('segredo'))
  assert.deepEqual(JSON.parse(texto), { versao: 1, guia: 'dominio', passo: 3 })
  assert.deepEqual(await pub.lerProgresso('obra'), { guia: 'dominio', passo: 3 })
  for (const ruim of [{ guia: '../x', passo: 1 }, { guia: 'a', passo: -1 }, { guia: 'a', passo: 1.5 }, { guia: 'a', passo: 100 }, { guia: 5, passo: 1 }, null, {}]) await assert.rejects(pub.gravarProgresso('obra', ruim), /progresso-invalido/)
  await assert.rejects(pub.gravarProgresso('../fora', { guia: 'a', passo: 1 }))
  assert.equal(await pub.lerProgresso('../fora'), null)
  assert.equal(await pub.lerProgresso('nao-existe'), null)
  fs.writeFileSync(arq, '{"guia":"a b","passo":2}'); assert.equal(await pub.lerProgresso('obra'), null)
  fs.writeFileSync(arq, 'não é json'); assert.equal(await pub.lerProgresso('obra'), null)
  assert.deepEqual(fs.readdirSync(path.join(raiz, 'obra', '.atlas')).filter((n) => n.endsWith('.tmp')), [])
})
