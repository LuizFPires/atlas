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
  const chamadas = { vercel: [], supabase: [], api: [], sql: [] }
  const base = {
    cofre: cofreMem({ 'contas/supabase': 'sbp_' + 'a'.repeat(40) }),
    vercel: async (args, o) => { chamadas.vercel.push({ args, entrada: o.entrada }); return { codigo: 0, saida: '' } },
    supabase: async (args, o) => { chamadas.supabase.push({ args, env: o.env }); return { codigo: 0, saida: '' } },
    git: async () => ({ codigo: 0, saida: 'https://github.com/ana/ponto.git\n' }),
    apiSupabase: async (m, c, corpo) => {
      chamadas.api.push({ m, c, corpo })
      if (c.endsWith('/database/query')) { chamadas.sql.push(corpo.query); return over.query ? over.query(corpo.query) : [] }
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
  assert.ok(e.passos.every((p) => p.estado === 'feito' || (p.id === 'acesso' && p.estado === 'pulado')), 'sem entrada com senha, o acesso do dono é pulado')
  const criar = chamadas.api.find((a) => a.m === 'POST')
  assert.equal(criar.corpo.region, 'sa-east-1')
  assert.equal(criar.corpo.organization_slug, 'ana-org')
  assert.equal(await d.cofre.ler(chaveSenha('ponto')), 'senha-gerada-123')
  // senha e token nunca na linha de comando: só no ambiente
  for (const s of chamadas.supabase) assert.ok(!s.args.join(' ').includes('senha-gerada-123'))
  // banco pela API de gestão (HTTPS), nunca pela conexão direta do Postgres (Guilherme, 27/11/2026)
  assert.ok(!chamadas.supabase.some((s) => s.args[0] === 'link' || s.args[0] === 'db'))
  // variáveis pela entrada, nunca nos argumentos; nunca a service_role
  const envs = chamadas.vercel.filter((v) => v.args[0] === 'env')
  assert.deepEqual(envs.map((v) => v.args[2]), ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  assert.deepEqual(envs.map((v) => v.entrada), ['https://abcdefghijklmnopqrst.supabase.co', 'A'.repeat(40)])
  assert.ok(!JSON.stringify(chamadas.vercel.map((v) => v.args)).includes('A'.repeat(40)))
  assert.ok(chamadas.vercel.some((v) => v.args.join(' ') === 'deploy --prod --yes'))
  assert.ok(chamadas.vercel.some((v) => v.args.join(' ') === 'git disconnect --yes'), 'mudança só vai ao ar com a aprovação')
  assert.ok(!chamadas.vercel.some((v) => v.args.join(' ') === 'git connect --yes'))
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

test('rede: o motivo do Supabase (erro do SQL) vem junto no erro, para a tela', async () => {
  const corpo = JSON.stringify({ message: 'Failed to run sql query: ERROR:  42P01: relation "x" does not exist' })
  await assert.rejects(pedirApiSupabase('POST', '/v1/projects/abc/database/query', { query: 'x' }, 't', { enviar: async () => ({ status: 400, corpo }) }),
    (e) => e.message === 'supabase-400' && /relation "x" does not exist/.test(e.detalhe))
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

test('conferirAntes: avisa ANTES de começar quanto banco a conta do Supabase já tem (limite grátis = 2)', async () => {
  const { raiz } = obra()
  const ativos = [{ status: 'ACTIVE_HEALTHY' }, { status: 'COMING_UP' }, { status: 'INACTIVE' }]
  const { d } = deps({ apiSupabase: async (m, c) => (c === '/v1/projects' ? ativos : null) })
  const n = criarNoAr({ raiz, ...d })
  assert.deepEqual(await n.conferirAntes('ponto'), { precisaBanco: true, bancoNovo: true, contaLigada: true, bancosAtivos: 2 })
  // sem pasta supabase: não precisa de banco
  const semBanco = obra({ supabase: false })
  assert.deepEqual(await criarNoAr({ raiz: semBanco.raiz, ...d }).conferirAntes('ponto'), { precisaBanco: false, bancoNovo: false, contaLigada: true, bancosAtivos: null })
  // conta não ligada: diz isso, sem chamar a API
  const { d: d2, chamadas } = deps({ cofre: cofreMem({}) })
  assert.deepEqual(await criarNoAr({ raiz, ...d2 }).conferirAntes('ponto'), { precisaBanco: true, bancoNovo: true, contaLigada: false, bancosAtivos: null })
  assert.equal(chamadas.api.length, 0)
  // API fora: não trava nada, só não sabe contar
  const { d: d3 } = deps({ apiSupabase: async () => { throw new Error('supabase-500') } })
  assert.equal((await criarNoAr({ raiz, ...d3 }).conferirAntes('ponto')).bancosAtivos, null)
})

function obraComMigrations() {
  const o = obra()
  const dir = path.join(o.cwd, 'supabase', 'migrations')
  fs.writeFileSync(path.join(dir, '20261120_ponto.sql'), 'create table public.marcacoes (id bigint primary key);\n')
  fs.writeFileSync(path.join(dir, '20261121_funcionarios.sql'), "create table public.funcionarios (id bigint primary key, nome text default 'x');\n")
  fs.writeFileSync(path.join(dir, 'leia-me.txt'), 'não é migration')
  return o
}
const erroApi = (msg, detalhe) => Object.assign(new Error(msg), detalhe ? { detalhe } : {})

test('migrations pela API de gestão do Supabase (HTTPS), em ordem, sem conexão direta ao Postgres (Guilherme, 27/11/2026)', async () => {
  const { raiz } = obraComMigrations()
  const { d, chamadas } = deps()
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar', JSON.stringify(n.estado('ponto')))
  assert.ok(!chamadas.supabase.some((s) => s.args[0] === 'link' || s.args[0] === 'db'), 'nada de supabase link / db push')
  assert.ok(chamadas.api.filter((a) => a.c.endsWith('/database/query')).every((a) => a.m === 'POST' && a.c === '/v1/projects/abcdefghijklmnopqrst/database/query'))
  const sql = chamadas.sql
  assert.match(sql[0], /create table if not exists supabase_migrations\.schema_migrations/)
  const iPonto = sql.findIndex((q) => q.includes('public.marcacoes'))
  const iFunc = sql.findIndex((q) => q.includes('public.funcionarios'))
  assert.ok(iPonto > 0 && iFunc > iPonto, 'em ordem de nome')
  assert.match(sql[iPonto], /^begin;[\s\S]*insert into supabase_migrations\.schema_migrations[\s\S]*'20261120'[\s\S]*commit;$/)
  assert.ok(!sql.some((q) => q.includes('não é migration')))
})

test('migration já aplicada não roda de novo (religar ou "Tentar de novo")', async () => {
  const { raiz } = obraComMigrations()
  const { d, chamadas } = deps({ query: async (q) => (/select version/.test(q) ? [{ version: '20261120' }] : []) })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar')
  assert.ok(!chamadas.sql.some((q) => q.includes('public.marcacoes')))
  assert.ok(chamadas.sql.some((q) => q.includes('public.funcionarios')))
})

const ERRO_SQL = 'Failed to run sql query: ERROR:  42P01: relation "public.funcionarios" does not exist postgresql://postgres.abcdefghijklmnopqrst:senha-gerada-123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres'

test('tabelas não subiram (erro de SQL): o erro vem resumido, sem senha, e "corrigir" manda para a linha e depois publica sozinho (Ponto, 26/11/2026)', async () => {
  const { raiz } = obraComMigrations()
  const corrigidos = []
  let falhas = 0, rodando = 1
  const { d } = deps({
    query: async (q) => { if (q.includes('public.marcacoes') && falhas++ === 0) throw erroApi('supabase-400', ERRO_SQL); return [] },
    corrigir: async (p, a) => { corrigidos.push([p, a]) },
    linhaRodando: () => rodando-- > 0,
  })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'erro')
  assert.equal(e.erro.motivo, 'supabase-migrations')
  assert.match(e.erro.detalhe, /relation "public\.funcionarios" does not exist/)
  assert.match(e.erro.detalhe, /20261120_ponto\.sql/, 'diz qual arquivo falhou')
  assert.doesNotMatch(e.erro.detalhe, /senha-gerada-123|postgresql:\/\//)
  assert.equal(falhas, 1, 'erro de SQL não adianta repetir: não tenta de novo sozinho')
  const c = await n.corrigir('ponto')
  assert.equal(c.fase, 'corrigindo')
  assert.equal(corrigidos.length, 1)
  assert.match(corrigidos[0][1][0], /tabelas do banco.*supabase\/migrations/i)
  assert.match(corrigidos[0][1][0], /relation "public\.funcionarios" does not exist/)
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar', 'depois da correção, confere de novo e publica sozinho')
})

test('banco recém-criado ainda não responde: tenta de novo sozinho antes de desistir', async () => {
  const { raiz } = obraComMigrations()
  let vezes = 0
  const { d } = deps({ query: async (q) => { if (/create table if not exists/.test(q) && vezes++ < 2) throw erroApi('supabase-503'); return [] } })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar')
  assert.equal(vezes, 3)
})

test('internet cai sempre: motivo próprio (supabase-conexao), sem achar que é defeito da obra', async () => {
  const { raiz } = obraComMigrations()
  const { d } = deps({ query: async () => { throw erroApi('timeout') } })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').erro.motivo, 'supabase-conexao')
  await assert.rejects(n.corrigir('ponto'), /nada-para-corrigir/)
})

test('chave do Supabase sem permissão no banco (401/403): motivo próprio, explicado na tela', async () => {
  const { raiz } = obraComMigrations()
  const { d } = deps({ query: async () => { throw erroApi('supabase-403') } })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').erro.motivo, 'supabase-sem-permissao-banco')
})

function obraComFuncao() {
  const o = obra()
  fs.mkdirSync(path.join(o.cwd, 'supabase', 'functions', 'avisar'), { recursive: true })
  fs.writeFileSync(path.join(o.cwd, 'supabase', 'functions', 'avisar', 'index.ts'), 'Deno.serve(() => new Response("ok"))\n')
  fs.mkdirSync(path.join(o.cwd, 'supabase', 'functions', '_shared'), { recursive: true })
  return o
}

test('funções do servidor: montadas pelo próprio Supabase (--use-api), sem Docker e sem conexão direta ao banco', async () => {
  const { raiz } = obraComFuncao()
  const { d, chamadas } = deps()
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar')
  const dep = chamadas.supabase.filter((s) => s.args[0] === 'functions')
  assert.equal(dep.length, 1, '_shared não é função')
  assert.deepEqual(dep[0].args, ['functions', 'deploy', 'avisar', '--project-ref', 'abcdefghijklmnopqrst', '--use-api'])
  assert.equal(dep[0].env.SUPABASE_ACCESS_TOKEN, 'sbp_' + 'a'.repeat(40))
  assert.equal(dep[0].env.SUPABASE_DB_PASSWORD, undefined, 'senha do banco não é necessária')
})

test('funções: internet/Supabase instável tenta de novo sozinho; não manda "corrigir" o que não é defeito da obra', async () => {
  const { raiz } = obraComFuncao()
  let vezes = 0
  const { d } = deps({ supabase: async (args) => (args[0] === 'functions' && vezes++ < 2 ? { codigo: 1, saida: 'Error: request failed: 503 Service Unavailable' } : { codigo: 0, saida: '' }) })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar')
  assert.equal(vezes, 3)
  const sempre = obraComFuncao()
  const { d: d2 } = deps({ supabase: async (args) => (args[0] === 'functions' ? { codigo: 1, saida: 'fetch failed: ETIMEDOUT' } : { codigo: 0, saida: '' }) })
  const n2 = criarNoAr({ raiz: sempre.raiz, ...d2 })
  await n2.iniciar('ponto', 'ponto')
  await n2._esperar('ponto')
  assert.equal(n2.estado('ponto').erro.motivo, 'supabase-conexao')
})

test('funções: chave sem permissão vira motivo explicado; erro no código da função vai para "Corrigir e continuar"', async () => {
  const a = obraComFuncao()
  const { d } = deps({ supabase: async (args) => (args[0] === 'functions' ? { codigo: 1, saida: 'Unexpected error deploying Function: 401 Unauthorized' } : { codigo: 0, saida: '' }) })
  const n = criarNoAr({ raiz: a.raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').erro.motivo, 'supabase-sem-permissao-banco')
  const b = obraComFuncao()
  let vezes = 0
  const { d: d2 } = deps({ supabase: async (args) => { if (args[0] === 'functions') { vezes++; return { codigo: 1, saida: 'error: Module not found "npm:stripe@99"' } } return { codigo: 0, saida: '' } } })
  const n2 = criarNoAr({ raiz: b.raiz, ...d2 })
  await n2.iniciar('ponto', 'ponto')
  await n2._esperar('ponto')
  assert.equal(n2.estado('ponto').erro.motivo, 'supabase-funcoes')
  assert.equal(vezes, 1)
})

test('teste do endereço: espera até ~5 min (DNS e certificado do endereço novo) antes de dizer que não respondeu', async () => {
  const { raiz } = obra({ supabase: false })
  let sondas = 0
  const { d } = deps({ sondar: async (u) => {
    if (u === 'https://ponto.vercel.app/' && sondas === 0) { sondas++; return { status: 404, cabecalhos: { 'x-vercel-error': 'DEPLOYMENT_NOT_FOUND' }, corpo: '' } }
    sondas++
    return sondas < 20 ? { status: 404, cabecalhos: {}, corpo: '' } : { status: 200, cabecalhos: {}, corpo: '<!doctype html>' }
  } })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar')
})

test('Vercel que pisca (ligar, variáveis, publicar) tenta de novo sozinho; build quebrado não repete', async () => {
  const { raiz } = obra()
  const vezes = { link: 0, env: 0, deploy: 0 }
  let publicado = false
  const { d } = deps({
    vercel: async (args) => {
      const k = args[0]
      if (k in vezes && vezes[k]++ < 2) return { codigo: 1, saida: 'Error: getaddrinfo EAI_AGAIN api.vercel.com' }
      if (k === 'deploy') publicado = true
      return { codigo: 0, saida: '' }
    },
    sondar: async () => (publicado ? { status: 200, cabecalhos: {}, corpo: '<!doctype html>' } : { status: 404, cabecalhos: { 'x-vercel-error': 'DEPLOYMENT_NOT_FOUND' }, corpo: '' }),
  })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar', JSON.stringify(n.estado('ponto').erro))
  assert.equal(vezes.link, 3)
  assert.equal(vezes.deploy, 3)
})

test('chave pública do banco ainda não apareceu: espera e busca de novo; nunca publica o sistema sem ela', async () => {
  const { raiz } = obra()
  let pedidos = 0
  const base = deps().d.apiSupabase
  const { d, chamadas } = deps({ apiSupabase: async (m, c, corpo, t) => {
    if (c.endsWith('/api-keys')) { pedidos++; return pedidos < 3 ? [] : [{ name: 'anon', api_key: 'A'.repeat(40) }] }
    return base(m, c, corpo, t)
  } })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar')
  assert.equal(pedidos, 3)
  const sem = obra()
  const { d: d2 } = deps({ apiSupabase: async (m, c, corpo, t) => (c.endsWith('/api-keys') ? [] : base(m, c, corpo, t)) })
  const n2 = criarNoAr({ raiz: sem.raiz, ...d2 })
  await n2.iniciar('ponto', 'ponto')
  await n2._esperar('ponto')
  assert.equal(n2.estado('ponto').erro.motivo, 'supabase-sem-chave')
  void chamadas
})

test('acompanhamento: cada etapa conta o avanço de verdade (tabelas, funções), guarda quanto levou e o diário com hora', async () => {
  const { raiz, cwd } = obraComMigrations()
  fs.mkdirSync(path.join(cwd, 'supabase', 'functions', 'avisar'), { recursive: true })
  const vistos = []
  let n = null
  const relogio = { t: Date.parse('2026-11-27T08:40:00Z') }
  const { d } = deps({ query: async (q) => { if (/public\.(marcacoes|funcionarios)/.test(q)) vistos.push(n.estado('ponto').sub); return [] } })
  n = criarNoAr({ raiz, ...d, agora: () => new Date((relogio.t += 1000)) })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'noar')
  assert.deepEqual(vistos.map((s) => s.texto), ['Criando as tabelas · 1 de 2', 'Criando as tabelas · 2 de 2'])
  assert.ok(vistos[0].pct < vistos[1].pct, 'a barra anda com a contagem')
  assert.equal(typeof vistos[0].inicio, 'number')
  assert.equal(typeof vistos[0].noticia, 'number')
  for (const p of ['vistoria', 'banco', 'publicar']) assert.ok(e.duracoes[p] > 0, p)
  const textos = e.diario.map((l) => l.texto)
  assert.ok(textos.includes('Vistoria aprovada.'))
  assert.ok(textos.includes('Tabelas prontas: 2 arquivos.'))
  assert.ok(textos.some((t) => /Vercel publicou o sistema/.test(t)))
  assert.ok(e.diario.every((l) => /^\d{4}-\d\d-\d\dT/.test(l.hora)))
  assert.ok(e.diario.length <= 30)
  assert.equal(e.sub, null, 'no fim não fica etapa "agora"')
})

test('a Vercel não conseguiu montar o sistema (erro de build): vira "vercel-build" com o resumo e a linha corrige', async () => {
  const { raiz } = obra()
  const corrigidos = []
  let deploys = 0
  const { d } = deps({
    vercel: async (args) => (args[0] === 'deploy' && deploys++ === 0 ? { codigo: 1, saida: 'Building...\nsrc/App.tsx(12,3): error TS2304: Cannot find name \'Ponto\'.\nError: Command "npm run build" exited with 2\n' } : { codigo: 0, saida: '' }),
    corrigir: async (p, a) => { corrigidos.push(a) },
    linhaRodando: () => false,
    sondar: async () => (deploys > 1 ? { status: 200, cabecalhos: {}, corpo: '<!doctype html><html></html>' } : { status: 404, cabecalhos: { 'x-vercel-error': 'DEPLOYMENT_NOT_FOUND' }, corpo: '' }),
  })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.erro.motivo, 'vercel-build')
  assert.match(e.erro.detalhe, /error TS2304/)
  await n.corrigir('ponto')
  assert.match(corrigidos[0][0], /npm run build.*error TS2304/s)
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar')
})

// Achado em 26/11/2026 (Guilherme sem cota do Claude): a vistoria lançava 'claude-cota' e a tela dizia "defeito do Atlas".
// Agora a obra espera a cota renovar sozinha (mostrando que está esperando) e continua de onde parou.
test('cota do Claude acabou na vistoria: espera sozinho (mostra na tela) e continua quando renova', async () => {
  const { raiz } = obra({ supabase: false })
  let vezes = 0
  let vistoDuranteEspera = null
  const { d } = deps({
    perguntar: async () => { vezes++; if (vezes <= 2) throw new Error('claude-cota'); return APROVADO },
    esperar: async () => { if (vistoDuranteEspera === null) vistoDuranteEspera = n.estado('ponto') },
  })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(vistoDuranteEspera.esperandoCota, true)
  assert.equal(vistoDuranteEspera.fase, 'rodando')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'noar')
  assert.equal(e.esperandoCota, false)
  assert.equal(vezes, 3)
})

test('cota que não renova nunca: depois do prazo vira erro explicado (claude-cota), não fica girando para sempre', async () => {
  const { raiz } = obra({ supabase: false })
  const { d } = deps({ perguntar: async () => { throw new Error('claude-cota') } })
  const n = criarNoAr({ raiz, ...d, esperasCota: 3 })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'erro')
  assert.equal(e.erro.motivo, 'claude-cota')
  assert.equal(e.esperandoCota, false)
})

// Guilherme, 27/11/2026: "Deploy bloqueado" na Vercel (o autor das mudanças é o Atlas, que a Vercel não reconhece) e
// "não consegui acessar" (o sistema só entra por convite e ninguém criava a conta do dono).
const { chaveSecreta, usaLogin, RE_BLOQUEADO } = require('./no-ar.cjs')
const BLOQUEIO = 'Error: The Deployment was blocked because the commit author does not have contributing access to the project on Vercel. Hobby teams do not support collaboration.'

test('bloqueio da Vercel pelo autor: publica de novo sem o histórico do GitHub junto e devolve o .git no lugar', async () => {
  const { raiz, cwd } = obra()
  fs.mkdirSync(path.join(cwd, '.git'))
  fs.writeFileSync(path.join(cwd, '.git', 'HEAD'), 'ref: refs/heads/main\n')
  const deploys = []
  let publicado = false
  const { d } = deps({
    vercel: async (args, o) => {
      if (args[0] !== 'deploy') return { codigo: 0, saida: '' }
      deploys.push({ env: o.env || null, temGit: fs.existsSync(path.join(cwd, '.git')) })
      if (deploys.length === 1) return { codigo: 1, saida: BLOQUEIO }
      publicado = true
      return { codigo: 0, saida: '' }
    },
    sondar: async () => (publicado ? { status: 200, cabecalhos: {}, corpo: '<!doctype html>' } : { status: 404, cabecalhos: { 'x-vercel-error': 'DEPLOYMENT_NOT_FOUND' }, corpo: '' }),
  })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(n.estado('ponto').fase, 'noar', JSON.stringify(n.estado('ponto').erro))
  assert.equal(deploys.length, 2)
  assert.equal(deploys[0].temGit, true)
  assert.equal(deploys[1].temGit, false, 'na segunda vez o .git fica fora da pasta enviada')
  assert.ok(deploys[1].env && deploys[1].env.GIT_DIR, 'e o git não acha o histórico')
  assert.equal(fs.readFileSync(path.join(cwd, '.git', 'HEAD'), 'utf8'), 'ref: refs/heads/main\n', 'o .git volta inteiro')
  assert.equal(fs.readdirSync(raiz).filter((x) => x.startsWith('.atlas-git-pausa')).length, 0)
})

test('bloqueio da Vercel que continua: motivo próprio (vercel-bloqueado), sem mandar a linha "corrigir" e com o .git de volta', async () => {
  const { raiz, cwd } = obra()
  fs.mkdirSync(path.join(cwd, '.git'))
  const { d } = deps({ vercel: async (args) => (args[0] === 'deploy' ? { codigo: 1, saida: BLOQUEIO } : { codigo: 0, saida: '' }) })
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.erro && e.erro.motivo, 'vercel-bloqueado')
  assert.ok(fs.existsSync(path.join(cwd, '.git')))
})

test('o Atlas fechou no meio da publicação de novo: o .git volta na próxima vez', async () => {
  const { raiz, cwd } = obra()
  const pausa = path.join(raiz, '.atlas-git-pausa-ponto')
  fs.mkdirSync(pausa)
  fs.writeFileSync(path.join(pausa, 'HEAD'), 'x')
  const { d } = deps()
  const n = criarNoAr({ raiz, ...d })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(fs.readFileSync(path.join(cwd, '.git', 'HEAD'), 'utf8'), 'x')
  assert.ok(!fs.existsSync(pausa))
})

test('RE_BLOQUEADO reconhece as mensagens da Vercel e não confunde com build quebrado', () => {
  for (const m of [BLOQUEIO, 'The Deployment was blocked because GitHub could not associate the committer with a GitHub user.', 'The Deployment was blocked because there was no git user associated with the commit.']) assert.ok(RE_BLOQUEADO.test(m), m)
  assert.ok(!RE_BLOQUEADO.test('Error: Command "npm run build" exited with 1'))
})

const LOGIN = "import { supabase } from './banco'\nexport const entrar = (e, s) => supabase.auth.signInWithPassword({ email: e, password: s })\n"
function obraComLogin() {
  const o = obra()
  fs.mkdirSync(path.join(o.cwd, 'src'))
  fs.writeFileSync(path.join(o.cwd, 'src', 'entrar.ts'), LOGIN)
  return o
}
const comChaves = (base) => async (m, c, corpo) => (c.endsWith('/api-keys?reveal=true') ? [{ type: 'publishable', api_key: 'P'.repeat(40) }, { type: 'secret', api_key: 'sb_secret_' + 'S'.repeat(40) }] : base(m, c, corpo))

test('primeiro acesso: cria a conta do dono com o e-mail da licença (confirmada, sem senha, papel dono) e não repete', async () => {
  const { raiz, cwd } = obraComLogin()
  const criadas = []
  const { d } = deps()
  const n = criarNoAr({ raiz, ...d, apiSupabase: comChaves(d.apiSupabase), emailDoDono: async () => ' Gui@Exemplo.com ', authSupabase: async (ref, m, c, corpo, chave) => { criadas.push({ ref, m, c, corpo, chave }); return { id: 'u1' } } })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'noar', JSON.stringify(e.erro))
  assert.equal(e.passos.find((p) => p.id === 'acesso').estado, 'feito')
  assert.deepEqual(e.acesso, { email: 'gui@exemplo.com', novo: true, senha: false })
  assert.equal(criadas.length, 1)
  assert.deepEqual(criadas[0], { ref: 'abcdefghijklmnopqrst', m: 'POST', c: '/auth/v1/admin/users', corpo: { email: 'gui@exemplo.com', email_confirm: true, app_metadata: { papel: 'dono' } }, chave: 'sb_secret_' + 'S'.repeat(40) })
  assert.ok(!('password' in criadas[0].corpo), 'o Atlas não define senha')
  const registro = fs.readFileSync(path.join(cwd, '.atlas', 'no-ar.json'), 'utf8')
  assert.ok(!registro.includes('sb_secret_'), 'a chave secreta nunca vai para arquivo')
  // Colocar no ar de novo (ex.: depois de uma mudança): não cria de novo
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  assert.equal(criadas.length, 1)
  assert.deepEqual(n.estado('ponto').acesso, { email: 'gui@exemplo.com', novo: true, senha: false })
})

test('primeiro acesso: o e-mail já tinha conta (422) segue normal, sem erro', async () => {
  const { raiz } = obraComLogin()
  const { d } = deps()
  const n = criarNoAr({ raiz, ...d, apiSupabase: comChaves(d.apiSupabase), emailDoDono: async () => 'gui@exemplo.com', authSupabase: async () => { throw Object.assign(new Error('supabase-422'), { detalhe: 'email_exists' }) } })
  await n.iniciar('ponto', 'ponto')
  await n._esperar('ponto')
  const e = n.estado('ponto')
  assert.equal(e.fase, 'noar')
  assert.deepEqual(e.acesso, { email: 'gui@exemplo.com', novo: false, senha: false })
})

test('primeiro acesso: sistema sem entrada com senha pula; sem e-mail ou sem chave avisa, mas o sistema fica no ar', async () => {
  { // sem login no código
    const { raiz } = obra()
    let chamou = false
    const { d } = deps()
    const n = criarNoAr({ raiz, ...d, apiSupabase: comChaves(d.apiSupabase), emailDoDono: async () => 'a@b.com', authSupabase: async () => { chamou = true } })
    await n.iniciar('ponto', 'ponto'); await n._esperar('ponto')
    assert.equal(n.estado('ponto').passos.find((p) => p.id === 'acesso').estado, 'pulado')
    assert.equal(chamou, false)
  }
  { // sem e-mail
    const { raiz } = obraComLogin()
    const { d } = deps()
    const n = criarNoAr({ raiz, ...d, apiSupabase: comChaves(d.apiSupabase), emailDoDono: async () => null, authSupabase: async () => ({}) })
    await n.iniciar('ponto', 'ponto'); await n._esperar('ponto')
    const e = n.estado('ponto')
    assert.equal(e.fase, 'noar')
    assert.equal(e.passos.find((p) => p.id === 'acesso').estado, 'atencao')
    assert.ok(e.avisos.some((a) => /seu e-mail/.test(a)))
  }
  { // Supabase fora na hora de criar
    const { raiz } = obraComLogin()
    const { d } = deps()
    const n = criarNoAr({ raiz, ...d, apiSupabase: comChaves(d.apiSupabase), emailDoDono: async () => 'a@b.com', authSupabase: async () => { throw new Error('timeout') } })
    await n.iniciar('ponto', 'ponto'); await n._esperar('ponto')
    const e = n.estado('ponto')
    assert.equal(e.fase, 'noar')
    assert.equal(e.passos.find((p) => p.id === 'acesso').estado, 'atencao')
    assert.equal(e.acesso, null)
  }
})

test('chave secreta: só a de verdade (nunca a pública nem a mascarada)', () => {
  assert.equal(chaveSecreta([{ type: 'publishable', api_key: 'P'.repeat(40) }]), null)
  assert.equal(chaveSecreta([{ type: 'secret', api_key: 'sb_secret_••••••••••••••••••••••' }]), null)
  assert.equal(chaveSecreta([{ name: 'anon', api_key: 'A'.repeat(40) }, { name: 'service_role', api_key: 'S'.repeat(40) }]), 'S'.repeat(40))
})

test('usaLogin: acha o Supabase Auth no código, ignora node_modules', () => {
  const { cwd } = obra()
  fs.mkdirSync(path.join(cwd, 'node_modules', 'x'), { recursive: true })
  fs.writeFileSync(path.join(cwd, 'node_modules', 'x', 'i.js'), LOGIN)
  assert.equal(usaLogin(cwd), false)
  fs.mkdirSync(path.join(cwd, 'app'))
  fs.writeFileSync(path.join(cwd, 'app', 'login.tsx'), LOGIN)
  assert.equal(usaLogin(cwd), true)
})

test('pedirAuthSupabase: só <ref>.supabase.co/auth/v1/admin/users, chave no cabeçalho, erro sem e-mail', async () => {
  const { pedirAuthSupabase } = require('./no-ar-rede.cjs')
  const vistos = []
  const enviar = async (o) => { vistos.push(o); return { status: 422, corpo: JSON.stringify({ error_code: 'email_exists', msg: 'gui@x.com já existe' }) } }
  await assert.rejects(pedirAuthSupabase('abcdefghijklmnopqrst', 'POST', '/auth/v1/admin/users', { email: 'gui@x.com' }, 'sb_secret_x', { enviar }), (e) => e.message === 'supabase-422' && e.detalhe === 'email_exists')
  assert.equal(vistos[0].host, 'abcdefghijklmnopqrst.supabase.co')
  assert.equal(vistos[0].cabecalhos.apikey, 'sb_secret_x')
  assert.ok(!vistos[0].caminho.includes('sb_secret'))
  for (const [ref, m, c] of [['evil.com/x', 'POST', '/auth/v1/admin/users'], ['abcdefghijklmnopqrst', 'DELETE', '/auth/v1/admin/users'], ['abcdefghijklmnopqrst', 'POST', '/auth/v1/admin/users/1'], ['abcdefghijklmnopqrst', 'POST', '/rest/v1/perfis']]) {
    await assert.rejects(pedirAuthSupabase(ref, m, c, {}, 'k', { enviar }))
  }
  assert.equal(vistos.length, 1)
})

test('licença: email() devolve o e-mail guardado no cofre (ou null)', async () => {
  const { criarLicenca } = require('./licenca.cjs')
  const com = criarLicenca({ cofre: cofreMem({ 'atlas/dispositivo': JSON.stringify({ token: 't', email: 'gui@exemplo.com' }) }), hashComputador: async () => 'h' })
  assert.equal(await com.email(), 'gui@exemplo.com')
  const sem = criarLicenca({ cofre: cofreMem(), hashComputador: async () => 'h' })
  assert.equal(await sem.email(), null)
})


// Guilherme, 28/11/2026: "não funcionou o reset de senha". O e-mail padrão do Supabase só vai para a equipe do projeto e o link
// apontava para localhost:3000. Agora: links apontados para o endereço do sistema e senha criada no próprio Atlas.
const UID = '11111111-2222-3333-4444-555555555555'
function comConfig(base, cfg, patches) {
  return comChaves(async (m, c, corpo) => {
    if (c.endsWith('/config/auth')) { if (m === 'PATCH') { patches.push(corpo); return {} } return cfg }
    return base(m, c, corpo)
  })
}

test('links de senha: troca o localhost:3000 do projeto novo pelo endereço do sistema e libera o endereço para voltar', async () => {
  const { raiz } = obraComLogin()
  const patches = []
  const { d } = deps()
  const n = criarNoAr({ raiz, ...d, apiSupabase: comConfig(d.apiSupabase, { site_url: 'http://localhost:3000', uri_allow_list: '' }, patches), emailDoDono: async () => 'gui@exemplo.com', authSupabase: async () => ({ id: UID }) })
  await n.iniciar('ponto', 'ponto'); await n._esperar('ponto')
  assert.deepEqual(patches, [{ site_url: 'https://ponto.vercel.app', uri_allow_list: 'https://ponto.vercel.app/**' }])
})

test('links de senha: endereço que o cliente já configurou fica; só acrescenta o do sistema à lista', async () => {
  const { raiz } = obraComLogin()
  const patches = []
  const { d } = deps()
  const n = criarNoAr({ raiz, ...d, apiSupabase: comConfig(d.apiSupabase, { site_url: 'https://ponto.com.br', uri_allow_list: 'https://ponto.com.br/**' }, patches), emailDoDono: async () => 'gui@exemplo.com', authSupabase: async () => ({ id: UID }) })
  await n.iniciar('ponto', 'ponto'); await n._esperar('ponto')
  assert.deepEqual(patches, [{ uri_allow_list: 'https://ponto.com.br/**,https://ponto.vercel.app/**' }])
})

test('senha do dono criada no Atlas: grava na conta (PUT com a chave secreta), marca "senha criada" e não guarda a senha', async () => {
  const { raiz, cwd } = obraComLogin()
  const chamadas = []
  const { d } = deps()
  const n = criarNoAr({ raiz, ...d, apiSupabase: comChaves(d.apiSupabase), emailDoDono: async () => 'gui@exemplo.com', authSupabase: async (ref, m, c, corpo, chave) => { chamadas.push({ m, c, corpo, chave }); return m === 'POST' ? { id: UID } : {} } })
  await n.iniciar('ponto', 'ponto'); await n._esperar('ponto')
  await assert.rejects(n.definirSenha('ponto', 'curta'), /senha-curta/)
  assert.deepEqual(await n.definirSenha('ponto', 'pontodaampla26'), { ok: true })
  const put = chamadas.find((x) => x.m === 'PUT')
  assert.deepEqual(put, { m: 'PUT', c: `/auth/v1/admin/users/${UID}`, corpo: { password: 'pontodaampla26' }, chave: 'sb_secret_' + 'S'.repeat(40) })
  assert.equal(n.estado('ponto').acesso.senha, true)
  const reg = fs.readFileSync(path.join(cwd, '.atlas', 'no-ar.json'), 'utf8')
  assert.ok(!reg.includes('pontodaampla26') && !reg.includes('sb_secret_'), 'nem a senha nem a chave vão para arquivo')
  assert.match(reg, /"senha":true/)
})

test('senha do dono: conta criada antes (sem id guardado) é achada pelo e-mail', async () => {
  const { raiz, cwd } = obraComLogin()
  fs.mkdirSync(path.join(cwd, '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(cwd, '.atlas', 'no-ar.json'), JSON.stringify({ versao: 1, nome: 'ponto', ref: 'abcdefghijklmnopqrst', endereco: 'https://ponto.vercel.app', acesso: { email: 'gui@exemplo.com', novo: true } }))
  const chamadas = []
  const { d } = deps()
  const n = criarNoAr({ raiz, ...d, apiSupabase: comChaves(d.apiSupabase), authSupabase: async (ref, m, c) => { chamadas.push(`${m} ${c}`); return m === 'GET' ? { users: [{ id: 'aaaaaaaa-2222-3333-4444-555555555555', email: 'outra@x.com' }, { id: UID, email: 'Gui@Exemplo.com' }] } : {} } })
  assert.deepEqual(await n.definirSenha('ponto', 'pontodaampla26'), { ok: true })
  assert.deepEqual(chamadas, ['GET /auth/v1/admin/users?page=1&per_page=200', `PUT /auth/v1/admin/users/${UID}`])
})

test('pedirAuthSupabase e pedirApiSupabase: só os caminhos da senha e da configuração de login', async () => {
  const { pedirAuthSupabase, pedirApiSupabase } = require('./no-ar-rede.cjs')
  const enviar = async () => ({ status: 200, corpo: '{}' })
  await pedirAuthSupabase('abcdefghijklmnopqrst', 'PUT', `/auth/v1/admin/users/${UID}`, { password: 'x' }, 'k', { enviar })
  await pedirAuthSupabase('abcdefghijklmnopqrst', 'GET', '/auth/v1/admin/users?page=1&per_page=200', null, 'k', { enviar })
  await assert.rejects(pedirAuthSupabase('abcdefghijklmnopqrst', 'PUT', '/auth/v1/admin/users', {}, 'k', { enviar }))
  await assert.rejects(pedirAuthSupabase('abcdefghijklmnopqrst', 'GET', '/auth/v1/admin/users?page=1&per_page=200&x=1', null, 'k', { enviar }))
  await pedirApiSupabase('PATCH', '/v1/projects/abcdefghijklmnopqrst/config/auth', {}, 't', { enviar })
  await assert.rejects(pedirApiSupabase('PATCH', '/v1/projects/abcdefghijklmnopqrst/database/query', {}, 't', { enviar }))
})

test('Resend verificado: o login do sistema passa a mandar e-mail pelo Resend do domínio do cliente (só o domínio fica no registro)', async () => {
  const { raiz, cwd } = obraComLogin()
  const patches = []
  const { d } = deps()
  const cfg = { dominio: 'ampla.com.br', senha: 're_' + 'E'.repeat(30) }
  const n = criarNoAr({ raiz, ...d, apiSupabase: comConfig(d.apiSupabase, { site_url: 'https://ponto.vercel.app', uri_allow_list: 'https://ponto.vercel.app/**' }, patches), emailDoDono: async () => 'gui@exemplo.com', authSupabase: async () => ({ id: UID }), emailDoSistema: async () => cfg })
  await n.iniciar('ponto', 'ponto'); await n._esperar('ponto')
  assert.deepEqual(patches, [{ external_email_enabled: true, smtp_admin_email: 'nao-responda@ampla.com.br', smtp_host: 'smtp.resend.com', smtp_port: '465', smtp_user: 'resend', smtp_pass: cfg.senha, smtp_sender_name: 'ponto' }])
  assert.deepEqual(n.estado('ponto').email, { dominio: 'ampla.com.br' })
  const reg = fs.readFileSync(path.join(cwd, '.atlas', 'no-ar.json'), 'utf8')
  assert.ok(!reg.includes('re_E'), 'a chave de envio não vai para arquivo')
  // obra já publicada: ligarEmails() direto (quando o domínio verifica depois)
  patches.length = 0
  assert.deepEqual(await n.ligarEmails('ponto'), { ok: true, dominio: 'ampla.com.br' })
  assert.equal(patches.length, 1)
  const sem = criarNoAr({ raiz, ...d, apiSupabase: comChaves(d.apiSupabase), emailDoSistema: async () => null })
  assert.deepEqual(await sem.ligarEmails('ponto'), { ok: false, motivo: 'resend-sem-dominio' })
})
