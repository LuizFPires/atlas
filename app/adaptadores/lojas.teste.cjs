'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarLojas, pacoteDoNome, chaveAscValida } = require('./lojas.cjs')

function obra() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'lojas-'))
  fs.mkdirSync(path.join(raiz, 'ponto', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'ponto', '.atlas', 'no-ar.json'), JSON.stringify({ versao: 1, nome: 'pontoampla', endereco: 'https://pontoampla.vercel.app' }))
  return raiz
}
function cofreMem() { const m = new Map(); return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => { m.set(k, v) }, _m: m } }
const P8 = '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg' + 'a'.repeat(40) + '\n-----END PRIVATE KEY-----\n'

function deps(over = {}) {
  const chamadas = []
  const cofre = cofreMem()
  cofre._m.set('atlas/dispositivo', JSON.stringify({ token: 'tok', email: 'ana@loja.com' }))
  const buscar = async (url, init) => {
    const corpo = JSON.parse(init.body)
    chamadas.push({ url, corpo, cab: init.headers })
    if (url.endsWith('/lojas/convite')) return { ok: true, json: async () => ({ codigo: 'abcdefghjk23', link: 'https://atlas.test/teste/abcdefghjk23' }) }
    if (url.endsWith('/lojas/testadores')) return { ok: true, json: async () => ({ pessoas: 9, faltam: 3, dia: 0, completo: false, nomes: [] }) }
    return { ok: false, json: async () => ({ erro: 'x' }) }
  }
  return { d: { raiz: obra(), cofre, hashComputador: async () => 'h'.repeat(64), api: 'https://api.test', buscar, ...over }, chamadas, cofre }
}

test('pacoteDoNome: o identificador do app sai do endereço (br.com.<nome>.app)', () => {
  assert.equal(pacoteDoNome('pontoampla'), 'br.com.pontoampla.app')
  assert.equal(pacoteDoNome('ponto-ampla'), 'br.com.pontoampla.app')
  assert.equal(pacoteDoNome('2ponto'), 'br.com.app2ponto.app')
})

test('escolher o caminho e marcar as contas fica salvo na obra, sem segredo', async () => {
  const { d } = deps()
  const l = criarLojas(d)
  await l.escolher('ponto', 'pessoa')
  await l.marcarConta('ponto', 'apple', true)
  const e = await l.estado('ponto')
  assert.equal(e.caminho, 'pessoa')
  assert.equal(e.contas.apple, true)
  assert.equal(e.contas.google, false)
  assert.equal(e.pacote, 'br.com.pontoampla.app')
  await assert.rejects(l.escolher('ponto', 'outro'), /caminho-invalido/)
  await assert.rejects(l.marcarConta('ponto', 'banco', true), /conta-invalida/)
})

test('chave da App Store Connect: confere o formato e guarda SÓ no cofre (nunca na obra)', async () => {
  const { d, cofre } = deps()
  const l = criarLojas(d)
  assert.equal(chaveAscValida({ keyId: 'ABC123DEF4', issuerId: '69a6de70-03db-47e3-e053-5b8c7c11a4d1', p8: P8 }), true)
  assert.equal(chaveAscValida({ keyId: 'x', issuerId: 'y', p8: 'z' }), false)
  await l.guardarChaveAsc('ponto', { keyId: 'ABC123DEF4', issuerId: '69a6de70-03db-47e3-e053-5b8c7c11a4d1', p8: P8 })
  assert.match(cofre._m.get('lojas/asc'), /BEGIN PRIVATE KEY/)
  const arquivos = fs.readdirSync(path.join(d.raiz, 'ponto', '.atlas')).map((f) => fs.readFileSync(path.join(d.raiz, 'ponto', '.atlas', f), 'utf8')).join('')
  assert.doesNotMatch(arquivos, /PRIVATE KEY/)
  assert.equal((await l.estado('ponto')).chaveAsc, true)
  await assert.rejects(l.guardarChaveAsc('ponto', { keyId: 'x', issuerId: 'y', p8: 'z' }), /chave-invalida/)
})

test('token da Expo: confere e guarda só no cofre', async () => {
  const { d, cofre } = deps()
  const l = criarLojas(d)
  await l.guardarTokenExpo('A'.repeat(40))
  assert.equal(cofre._m.get('lojas/expo'), 'A'.repeat(40))
  assert.equal((await l.estado('ponto')).contas.expo, true)
  await assert.rejects(l.guardarTokenExpo('curto demais'), /token-invalido/)
})

test('convite dos testadores: só grupo do Google; pede ao servidor com o opt-in do pacote e guarda o link', async () => {
  const { d, chamadas } = deps()
  const l = criarLojas(d)
  await assert.rejects(l.criarConvite('ponto', 'Ponto', 'https://evil.com/g'), /grupo-invalido/)
  const r = await l.criarConvite('ponto', 'Ponto', 'https://groups.google.com/g/ponto-testadores')
  assert.equal(r.link, 'https://atlas.test/teste/abcdefghjk23')
  assert.deepEqual({ ...chamadas[0].corpo, computador_hash: undefined }, { email: 'ana@loja.com', computador_hash: undefined, obra_id: 'ponto', app_nome: 'Ponto', grupo_url: 'https://groups.google.com/g/ponto-testadores', optin_url: 'https://play.google.com/apps/testing/br.com.pontoampla.app' })
  assert.equal((await l.estado('ponto')).convite.link, 'https://atlas.test/teste/abcdefghjk23')
  const t = await l.testadores('ponto')
  assert.equal(t.pessoas, 9)
})

// ---- M59 parte 2: montar a versão de app e mandar para os testes das lojas ----------------------------------------------------
const ASC = { keyId: 'ABC123DEF4', issuerId: '69a6de70-03db-47e3-e053-5b8c7c11a4d1', teamId: 'A1B2C3D4E5', p8: P8 }

function comEnvio(over = {}) {
  const base = deps()
  const eas = []
  const pedidos = []
  let rodando = false
  const status = { ios: 'IN_PROGRESS', android: 'IN_PROGRESS' }
  const d = {
    ...base.d,
    pedirConstrucao: async (pasta, texto) => { pedidos.push(texto); rodando = true; fs.mkdirSync(path.join(base.d.raiz, pasta, 'apps', 'mobile'), { recursive: true }); fs.writeFileSync(path.join(base.d.raiz, pasta, 'apps', 'mobile', 'app.json'), '{}'); fs.writeFileSync(path.join(base.d.raiz, pasta, 'apps', 'mobile', 'eas.json'), '{}'); rodando = false },
    linhaRodando: () => rodando,
    eas: async (args, o) => {
      const p8 = o.env.EXPO_ASC_API_KEY_PATH ? fs.readFileSync(o.env.EXPO_ASC_API_KEY_PATH, 'utf8') : null
      eas.push({ args, cwd: o.cwd, env: { ...o.env }, p8 })
      if (args[0] === 'build') return { codigo: 0, saida: JSON.stringify([{ id: 'b-ios', platform: 'IOS' }, { id: 'b-and', platform: 'ANDROID' }]) }
      if (args[0] === 'build:view') {
        const ios = args[1] === 'b-ios'
        const st = ios ? status.ios : status.android
        if (st === 'IN_PROGRESS') status[ios ? 'ios' : 'android'] = 'FINISHED'
        return { codigo: 0, saida: JSON.stringify({ id: args[1], status: st, artifacts: { buildUrl: ios ? 'https://expo.dev/artifacts/eas/x.ipa' : 'https://expo.dev/artifacts/eas/abc.aab' } }) }
      }
      if (args[0] === 'submit') return { codigo: 0, saida: '' }
      return { codigo: 1, saida: '' }
    },
    esperar: async () => {},
    avisar: async () => {},
    ...over,
  }
  return { ...base, d, eas, pedidos }
}

test('montar sem a conta da Expo: não começa (o Atlas diz o que falta)', async () => {
  const { d } = comEnvio()
  await assert.rejects(criarLojas(d).montar('ponto'), /falta-expo/)
})

test('montar: pede a versão de app à linha, monta na nuvem, manda o iPhone ao TestFlight e deixa o 1º envio do Google com o cliente', async () => {
  const { d, eas, pedidos, cofre } = comEnvio()
  const l = criarLojas(d)
  await l.guardarTokenExpo('E'.repeat(40))
  await l.escolher('ponto', 'pessoa')
  await l.guardarChaveAsc('ponto', ASC)
  await l.montar('ponto')
  await l._esperar('ponto')
  assert.match(pedidos[0], /corretor/)
  assert.match(pedidos[0], /NÃO rode o build/)
  const build = eas.find((c) => c.args[0] === 'build')
  assert.deepEqual(build.args, ['build', '--platform', 'all', '--profile', 'production', '--non-interactive', '--no-wait', '--json'])
  assert.equal(build.cwd, path.join(d.raiz, 'ponto', 'apps', 'mobile'))
  assert.equal(build.env.EXPO_TOKEN, 'E'.repeat(40))
  assert.equal(build.env.EXPO_APPLE_TEAM_ID, 'A1B2C3D4E5')
  assert.equal(build.env.EXPO_APPLE_TEAM_TYPE, 'INDIVIDUAL')
  assert.match(build.p8, /BEGIN PRIVATE KEY/)
  assert.ok(!fs.existsSync(build.env.EXPO_ASC_API_KEY_PATH), 'a chave temporária é apagada')
  assert.ok(!build.env.EXPO_ASC_API_KEY_PATH.startsWith(d.raiz), 'a chave nunca vai para a pasta da obra')
  assert.deepEqual(eas.find((c) => c.args[0] === 'submit').args, ['submit', '--platform', 'ios', '--id', 'b-ios', '--non-interactive'])
  const e = await l.estado('ponto')
  assert.equal(e.envio.fase, 'google-primeiro')
  assert.equal(e.envio.ios, 'testflight')
  assert.equal(e.envio.aab, true)
  assert.doesNotMatch(fs.readFileSync(path.join(d.raiz, 'ponto', '.atlas', 'lojas.json'), 'utf8'), /PRIVATE|EEEE/)
  void cofre
})

test('build que falhou na nuvem = erro honesto, com o passo', async () => {
  const { d } = comEnvio({ eas: async (args) => (args[0] === 'build' ? { codigo: 1, saida: 'Error: credentials' } : { codigo: 0, saida: '' }) })
  const l = criarLojas(d)
  await l.guardarTokenExpo('E'.repeat(40))
  await l.montar('ponto')
  await l._esperar('ponto')
  const e = await l.estado('ponto')
  assert.equal(e.envio.fase, 'erro')
  assert.equal(e.envio.erro, 'eas-build')
})

test('o 1º envio do Google é do cliente; marcado, a versão fica no teste das duas lojas', async () => {
  const { d } = comEnvio()
  const l = criarLojas(d)
  await l.guardarTokenExpo('E'.repeat(40))
  await l.guardarChaveAsc('ponto', ASC)
  await l.montar('ponto')
  await l._esperar('ponto')
  assert.equal(await l.linkAab('ponto'), 'https://expo.dev/artifacts/eas/abc.aab')
  await l.googleEnviado('ponto')
  assert.equal((await l.estado('ponto')).envio.fase, 'teste')
})
