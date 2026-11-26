'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarNoAr, nomeValido, nomeDaObra, candidatos, variaveisSupabase, chavePublica, laudoDoTexto, chaveSenha } = require('./no-ar.cjs')

function obra({ supabase = true, migrations = true, envExample = 'VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=\n' } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'noar-'))
  const cwd = path.join(raiz, 'ponto')
  fs.mkdirSync(cwd)
  if (supabase) fs.mkdirSync(path.join(cwd, 'supabase', migrations ? 'migrations' : 'x'), { recursive: true })
  if (envExample !== null) fs.writeFileSync(path.join(cwd, '.env.example'), envExample)
  return { raiz, cwd }
}

function cofreMem(inicial = {}) {
  const m = new Map(Object.entries(inicial))
  return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => { m.set(k, v) }, _m: m }
}

const APROVADO = '{"laudo":"aprovado","bloqueia":[]}'

function deps(over = {}) {
  const chamadas = { vercel: [], supabase: [], api: [] }
  const base = {
    cofre: cofreMem({ 'contas/supabase': 'sbp_' + 'a'.repeat(40) }),
    vercel: async (args, o) => { chamadas.vercel.push({ args, entrada: o.entrada }); return { codigo: 0, saida: '' } },
    supabase: async (args, o) => { chamadas.supabase.push({ args, env: o.env }); return { codigo: 0, saida: '' } },
    git: async () => ({ codigo: 0, saida: 'https://github.com/ana/ponto.git\n' }),
    apiSupabase: async (m, c, corpo) => {
      chamadas.api.push({ m, c, corpo })
      if (c === '/v1/organizations') return [{ id: 'x', slug: 'ana-org' }]
      if (m === 'POST' && c === '/v1/projects') return { id: 'abcdefghijklmnopqrst' }
      if (c === '/v1/projects/abcdefghijklmnopqrst') return { status: 'ACTIVE_HEALTHY' }
      if (c.endsWith('/api-keys')) return [{ name: 'service_role', api_key: 'S'.repeat(40) }, { name: 'anon', api_key: 'A'.repeat(40) }]
      return null
    },
    sondar: async (url) => (url === 'https://ponto.vercel.app/' && !chamadas.vercel.some((v) => v.args[0] === 'deploy')
      ? { status: 404, cabecalhos: { 'x-vercel-error': 'DEPLOYMENT_NOT_FOUND' }, corpo: '' }
      : { status: 200, cabecalhos: {}, corpo: '<!doctype html><html></html>' }),
    perguntar: async () => APROVADO,
    corrigir: async () => {},
    esperar: async () => {},
    gerarSenha: () => 'senha-gerada-123',
  }
  return { d: { ...base, ...over }, chamadas }
}

test('nomes: válidos, a partir do nome da obra e sugestões', () => {
  assert.equal(nomeValido('pontoampla'), true)
  assert.equal(nomeValido('Ponto'), false)
  assert.equal(nomeValido('a'), false)
  assert.equal(nomeValido('ponto--x'), false)
  assert.equal(nomeDaObra('Ponto da Ampla'), 'ponto-da-ampla')
  assert.equal(nomeDaObra('Ação & Cia'), 'acao-cia')
  assert.deepEqual(candidatos('ponto', 'Ampla').slice(0, 3), ['ponto', 'pontoampla', 'ponto-ampla'])
})

test('variáveis do Supabase vêm só pelos NOMES do .env.example', () => {
  const v = variaveisSupabase('# banco\nVITE_SUPABASE_URL=https://x\nVITE_SUPABASE_ANON_KEY=\nSTRIPE_SECRET=\n')
  assert.deepEqual(v, { url: ['VITE_SUPABASE_URL'], chave: ['VITE_SUPABASE_ANON_KEY'] })
})

test('chave pública: nunca a service_role', () => {
  assert.equal(chavePublica([{ name: 'service_role', api_key: 'S'.repeat(40) }]), null)
  assert.equal(chavePublica([{ name: 'anon', api_key: 'A'.repeat(40) }]), 'A'.repeat(40))
  assert.equal(chavePublica([{ type: 'secret', api_key: 'S'.repeat(40) }, { type: 'publishable', api_key: 'P'.repeat(40) }]), 'P'.repeat(40))
})

test('laudo estranho = reprovado (fail-closed); aprovado não traz achados', () => {
  assert.equal(laudoDoTexto('não sei').laudo, 'reprovado')
  assert.deepEqual(laudoDoTexto(APROVADO), { laudo: 'aprovado', achados: [] })
  const r = laudoDoTexto('{"laudo":"reprovado","bloqueia":["Um funcionário via o ponto de outro."]}')
  assert.deepEqual(r.achados, ['Um funcionário via o ponto de outro.'])
})

test('nome livre: só DEPLOYMENT_NOT_FOUND é livre; o nome que já é da obra é "seu"', async () => {
  const { raiz } = obra()
  const { d } = deps({ sondar: async (u) => (u.startsWith('https://livre') ? { status: 404, cabecalhos: { 'x-vercel-error': 'DEPLOYMENT_NOT_FOUND' } } : u.startsWith('https://caiu') ? Promise.reject(new Error('x')) : { status: 200, cabecalhos: {} }) })
  const n = criarNoAr({ raiz, ...d })
  assert.equal(await n.nomeLivre('livre-1'), 'livre')
  assert.equal(await n.nomeLivre('ponto'), 'ocupado')
  assert.equal(await n.nomeLivre('caiu-1'), 'incerto')
  assert.equal(await n.nomeLivre('X'), 'invalido')
})

test('um clique: vistoria, banco em São Paulo, Vercel com variáveis pela entrada, GitHub, teste e no ar', async () => {
  const { raiz, cwd } = obra()
  const { d, chamadas } = deps()
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'noar', JSON.stringify(e))
  assert.equal(e.endereco, 'https://ponto.vercel.app')
  assert.ok(e.passos.every((p) => p.estado === 'feito'))
  const criar = chamadas.api.find((a) => a.m === 'POST')
  assert.equal(criar.corpo.region, 'sa-east-1')
  assert.equal(criar.corpo.organization_slug, 'ana-org')
  assert.equal(await d.cofre.ler(chaveSenha('ponto')), 'senha-gerada-123')
  // senha e token nunca na linha de comando: só no ambiente
  for (const s of chamadas.supabase) assert.ok(!s.args.join(' ').includes('senha-gerada-123'))
  assert.equal(chamadas.supabase.find((s) => s.args[0] === 'db').env.SUPABASE_DB_PASSWORD, 'senha-gerada-123')
  // variáveis pela entrada, nunca nos argumentos; nunca a service_role
  const envs = chamadas.vercel.filter((v) => v.args[0] === 'env')
  assert.deepEqual(envs.map((v) => v.args[2]), ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  assert.deepEqual(envs.map((v) => v.entrada), ['https://abcdefghijklmnopqrst.supabase.co', 'A'.repeat(40)])
  assert.ok(!JSON.stringify(chamadas.vercel.map((v) => v.args)).includes('A'.repeat(40)))
  assert.ok(chamadas.vercel.some((v) => v.args.join(' ') === 'deploy --prod --yes'))
  assert.ok(chamadas.vercel.some((v) => v.args.join(' ') === 'git connect --yes'))
  // registro sem segredo
  const reg = fs.readFileSync(path.join(cwd, '.atlas', 'no-ar.json'), 'utf8')
  assert.ok(reg.includes('abcdefghijklmnopqrst') && reg.includes('https://ponto.vercel.app'))
  assert.ok(!reg.includes('senha') && !reg.includes('A'.repeat(40)) && !reg.includes('sbp_'))
})

test('obra sem supabase/: pula o banco e publica', async () => {
  const { raiz } = obra({ supabase: false })
  const { d, chamadas } = deps()
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'noar')
  assert.equal(e.passos.find((p) => p.id === 'banco').estado, 'pulado')
  assert.equal(chamadas.api.length, 0)
})

test('religar reaproveita o projeto do Supabase (não cria outro)', async () => {
  const { raiz, cwd } = obra()
  fs.mkdirSync(path.join(cwd, '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(cwd, '.atlas', 'no-ar.json'), JSON.stringify({ nome: 'ponto', ref: 'abcdefghijklmnopqrst' }))
  const { d, chamadas } = deps()
  d.cofre._m.set(chaveSenha('ponto'), 'antiga')
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar')
  assert.ok(!chamadas.api.some((a) => a.m === 'POST'))
})

test('vistoria reprovada: para antes de publicar e mostra os pontos; corrigir manda pela linha', async () => {
  const { raiz } = obra()
  const corrigidos = []
  let rodando = 2
  const { d, chamadas } = deps({ perguntar: async () => (corrigidos.length ? APROVADO : '{"laudo":"reprovado","bloqueia":["Falta a página de privacidade."]}'), corrigir: async (p, a) => { corrigidos.push([p, a]) }, linhaRodando: () => rodando-- > 0 })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'vistoria')
  assert.deepEqual(e.achados, ['Falta a página de privacidade.'])
  assert.equal(chamadas.vercel.length, 0)
  assert.equal(chamadas.api.length, 0)
  const c = await n.corrigir('ponto')
  assert.equal(c.fase, 'corrigindo')
  assert.deepEqual(corrigidos, [['ponto', ['Falta a página de privacidade.']]])
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar', 'depois da correção, confere de novo e publica sozinho')
})

test('sem a conta do Supabase ligada: erro no passo do banco, nada publicado', async () => {
  const { raiz } = obra()
  const { d, chamadas } = deps({ cofre: cofreMem({}) })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'erro')
  assert.deepEqual(e.erro, { passo: 'banco', motivo: 'sem-conta-supabase' })
  assert.equal(chamadas.vercel.length, 0)
})

test('nome ocupado por outra pessoa é recusado antes de começar', async () => {
  const { raiz } = obra()
  const { d } = deps({ sondar: async () => ({ status: 200, cabecalhos: {}, corpo: '' }) })
  const n = criarNoAr({ raiz, ...d })
  await assert.rejects(n.iniciar('ponto', 'ponto'), /nome-ocupado/)
})

test('o site não respondeu no teste: erro no passo teste (não diz que está no ar)', async () => {
  const { raiz } = obra({ supabase: false })
  let depois = false
  const { d } = deps({ vercel: async (a) => { if (a[0] === 'deploy') depois = true; return { codigo: 0, saida: '' } }, sondar: async () => (depois ? { status: 500, cabecalhos: {}, corpo: '' } : { status: 404, cabecalhos: { 'x-vercel-error': 'DEPLOYMENT_NOT_FOUND' } }) })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'erro')
  assert.equal(e.erro.passo, 'teste')
  assert.equal(e.endereco, null)
})

test('GitHub sem remoto: publica e avisa (não trava)', async () => {
  const { raiz } = obra({ supabase: false })
  const { d } = deps({ git: async () => ({ codigo: 1, saida: '' }) })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'noar')
  assert.equal(e.passos.find((p) => p.id === 'github').estado, 'atencao')
  assert.equal(e.avisos.length, 1)
})

test('estado depois de reabrir o app: o registro diz que está no ar', () => {
  const { raiz, cwd } = obra()
  fs.mkdirSync(path.join(cwd, '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(cwd, '.atlas', 'no-ar.json'), JSON.stringify({ nome: 'ponto', endereco: 'https://ponto.vercel.app' }))
  const { d } = deps()
  const n = criarNoAr({ raiz, ...d })
  const e = n.estado('ponto')
  assert.equal(e.fase, 'noar')
  assert.equal(e.endereco, 'https://ponto.vercel.app')
})

test('pasta fora da raiz é recusada', async () => {
  const { raiz } = obra()
  const { d } = deps()
  const n = criarNoAr({ raiz, ...d })
  await assert.rejects(n.iniciar('../fora', 'ponto'))
})

const { pedirApiSupabase, sondarSite } = require('./no-ar-rede.cjs')

test('rede: só api.supabase.com com caminho /v1 fixo, token no cabeçalho', async () => {
  const vistos = []
  const enviar = async (o) => { vistos.push(o); return { status: 200, cabecalhos: {}, corpo: '[{"slug":"x"}]' } }
  assert.deepEqual(await pedirApiSupabase('GET', '/v1/organizations', null, 'sbp_t', { enviar }), [{ slug: 'x' }])
  assert.equal(vistos[0].host, 'api.supabase.com')
  assert.equal(vistos[0].cabecalhos.Authorization, 'Bearer sbp_t')
  await assert.rejects(pedirApiSupabase('DELETE', '/v1/projects/x', null, 't', { enviar }), /metodo-invalido/)
  await assert.rejects(pedirApiSupabase('GET', 'https://mal.com/v1/x', null, 't', { enviar }), /caminho-invalido/)
  await assert.rejects(pedirApiSupabase('GET', '/v1/x', null, 't', { enviar: async () => ({ status: 401, corpo: '' }) }), /supabase-401/)
})

test('rede: sondar só endereço .vercel.app', async () => {
  const enviar = async (o) => ({ status: 200, cabecalhos: {}, corpo: o.host })
  assert.equal((await sondarSite('https://ponto.vercel.app/', { enviar })).corpo, 'ponto.vercel.app')
  await assert.rejects(sondarSite('https://ponto.vercel.app.mal.com/', { enviar }), /site-invalido/)
  await assert.rejects(sondarSite('http://ponto.vercel.app/', { enviar }), /site-invalido/)
})

test('API do Supabase: limite de 2 projetos grátis vira um motivo próprio (o cliente sabe o que fazer)', async () => {
  const corpo = JSON.stringify({ message: 'The following organization members have reached their maximum limits for the number of active free projects within organizations where they are an administrator or owner: guilherme (2 project limit).' })
  for (const status of [400, 402]) {
    await assert.rejects(pedirApiSupabase('POST', '/v1/projects', { name: 'ponto' }, 't', { enviar: async () => ({ status, corpo }) }), /^Error: supabase-limite-gratis$/)
  }
  await assert.rejects(pedirApiSupabase('POST', '/v1/projects', {}, 't', { enviar: async () => ({ status: 400, corpo: '{"message":"bad"}' }) }), /^Error: supabase-400$/)
})
