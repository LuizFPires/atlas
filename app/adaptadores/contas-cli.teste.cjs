// Teste do adaptador que liga as contas a este computador (node --test app/adaptadores/*.teste.cjs). Sem rede, sem CLI de verdade.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarContasCli, codigoEEndereco, chaveSupabaseValida, CHAVE_SUPABASE } = require('./contas-cli.cjs')
const { criarCofreMemoria } = require('../cofre.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-contas-'))

/** Processo falso: o teste escreve a saída e termina quando quiser. */
function processosFalsos() {
  const vivos = []
  const iniciar = (cmd, args, o) => {
    const p = { cmd, args, env: o.env, escrito: [], parado: false, falar: (t) => o.onTexto(t), terminar: (c) => o.onFim(c) }
    vivos.push(p)
    return { escrever: (t) => p.escrito.push(t), parar: () => { p.parado = true } }
  }
  return { vivos, iniciar }
}

function montar({ rodar = async () => ({ codigo: 1, saida: '' }), cofre = criarCofreMemoria(), apiSupabase = async () => [], existe = () => true } = {}) {
  const dados = tmp()
  const pf = processosFalsos()
  const chamadas = []
  const r = async (cmd, args, o) => { chamadas.push({ cmd, args, env: o && o.env }); return rodar(cmd, args, o) }
  const api = []
  const contas = criarContasCli({ dadosApp: dados, cofre, rodar: r, iniciar: pf.iniciar, plataforma: 'linux', env: { PATH: '/usr/bin' }, existe, apiSupabase: async (m, c, corpo, token) => { api.push({ m, c, token }); return apiSupabase(m, c, corpo, token) } })
  return { contas, pf, chamadas, cofre, dados, api }
}

test('lê o código e o endereço da saída do gh e da Vercel (só endereços oficiais)', () => {
  assert.deepEqual(codigoEEndereco('github', '! First copy your one-time code: 1A2B-3C4D\nOpen this URL to continue in your web browser: https://github.com/login/device\n'),
    { codigo: '1A2B-3C4D', url: 'https://github.com/login/device' })
  assert.deepEqual(codigoEEndereco('hosp', '\n  Visit https://vercel.com/oauth/device?user_code=WXKD-TPLM\n'),
    { codigo: 'WXKD-TPLM', url: 'https://vercel.com/oauth/device?user_code=WXKD-TPLM' })
  // endereço de outro site nunca é aberto: usa o fixo
  assert.deepEqual(codigoEEndereco('github', 'code: 1A2B-3C4D https://mal.example/login/device'), { codigo: '1A2B-3C4D', url: 'https://github.com/login/device' })
  assert.equal(codigoEEndereco('github', 'ainda carregando'), null)
})

test('ligar o GitHub: roda o login do gh pelo navegador, sem abrir o navegador do computador, e fica ligado quando o gh termina bem', async () => {
  const { contas, pf } = montar({ rodar: async (cmd, args) => (args.includes('status') ? { codigo: 0, saida: 'github.com\n  ✓ Logged in to github.com account ze-barbearia (keyring)\n' } : { codigo: 1, saida: '' }) })
  const prometido = contas.ligar('github')
  const p = pf.vivos[0]
  assert.deepEqual(p.args.slice(0, 2), ['auth', 'login'])
  for (const a of ['--web', '--hostname', 'github.com', '--git-protocol', 'https', '--scopes', 'workflow']) assert.ok(p.args.includes(a), a)
  assert.ok(!p.args.includes('--with-token'))
  p.falar('! First copy your one-time code: 1A2B-3C4D\n')
  p.falar('Open this URL to continue in your web browser: https://github.com/login/device\n')
  assert.deepEqual(await prometido, { codigo: '1A2B-3C4D', url: 'https://github.com/login/device' })
  assert.ok(p.escrito.includes('\n')) // o "aperte Enter" do gh
  assert.equal(contas.estado('github'), 'esperando')
  p.terminar(0)
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(contas.estado('github'), 'ligado')
  assert.deepEqual((await contas.situacao()).github, { ligado: true, usuario: 'ze-barbearia' })
})

test('ligar a Vercel usa a CLI instalada pelo Atlas e não abre o navegador do computador (o Atlas abre o site ao lado)', async () => {
  const { contas, pf } = montar()
  const prometido = contas.ligar('hosp')
  const p = pf.vivos[0]
  assert.ok(p.args.includes('login'))
  assert.equal(p.env.CI, '1')
  p.falar('  Visit https://vercel.com/oauth/device?user_code=WXKD-TPLM\n')
  assert.equal((await prometido).codigo, 'WXKD-TPLM')
  p.terminar(1)
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(contas.estado('hosp'), 'erro')
})

test('ligar de novo derruba o login anterior (nunca dois ao mesmo tempo); sem código em 60 s, falha com calma', async () => {
  const { contas, pf } = montar()
  void contas.ligar('github').catch(() => {})
  void contas.ligar('github').catch(() => {})
  assert.equal(pf.vivos[0].parado, true)
  const { contas: c2, pf: pf2 } = montar()
  const pr = c2.ligar('github', { esperaMs: 10 })
  await assert.rejects(pr, /sem-codigo/)
  assert.equal(pf2.vivos[0].parado, true)
  assert.equal(c2.estado('github'), 'erro')
})

test('Supabase: a chave é conferida pela API do Supabase (HTTPS, sem CLI) e só então vai ao cofre; formato errado nem é testado', async () => {
  const boa = 'sbp_' + 'a'.repeat(40)
  const { contas, cofre, chamadas, dados, api } = montar({ apiSupabase: async (m, c, corpo, token) => { if (token !== boa) throw new Error('supabase-401'); return [] } })
  assert.deepEqual(await contas.guardarChaveSupabase('senha123'), { ok: false, motivo: 'formato' })
  assert.equal(api.length, 0)
  assert.deepEqual(await contas.guardarChaveSupabase('sbp_' + 'b'.repeat(40)), { ok: false, motivo: 'recusada' })
  assert.equal(await cofre.ler(CHAVE_SUPABASE), null)
  assert.deepEqual(await contas.guardarChaveSupabase('  ' + boa + '\n'), { ok: true })
  assert.equal(await cofre.ler(CHAVE_SUPABASE), boa)
  assert.deepEqual(api.map((a) => [a.m, a.c]), [['GET', '/v1/projects'], ['GET', '/v1/projects']])
  assert.equal(chamadas.length, 0, 'nenhuma ferramenta instalada é usada para ligar o Supabase')
  const tudo = fs.readdirSync(dados, { recursive: true }).map((f) => { try { return fs.readFileSync(path.join(dados, String(f)), 'utf8') } catch { return '' } }).join('')
  assert.ok(!tudo.includes('sbp_'))
  assert.equal(contas.estado('supabase'), 'ligado')
  assert.deepEqual((await contas.situacao()).supabase, { ligado: true, usuario: null })
})

test('Supabase: sem internet NÃO diz que a chave foi recusada (motivo próprio, a pessoa não gera chave à toa)', async () => {
  const { contas, cofre } = montar({ apiSupabase: async () => { throw new Error('timeout') } })
  assert.deepEqual(await contas.guardarChaveSupabase('sbp_' + 'a'.repeat(40)), { ok: false, motivo: 'sem-internet' })
  assert.equal(await cofre.ler(CHAVE_SUPABASE), null)
})

test('chaveSupabaseValida: só sbp_ + 40 letras/números', () => {
  assert.equal(chaveSupabaseValida('sbp_' + 'a1'.repeat(20)), true)
  assert.equal(chaveSupabaseValida('sbp_123'), false)
  assert.equal(chaveSupabaseValida('sbp_' + 'a'.repeat(40) + ' && rm'), false)
})

test('ambiente da linha: chave do Supabase do cofre e as ferramentas do Atlas no PATH; sem chave, nada inventado', async () => {
  const { contas, cofre, dados } = montar()
  assert.equal(contas.envDaLinha().SUPABASE_ACCESS_TOKEN, undefined)
  await cofre.guardar(CHAVE_SUPABASE, 'sbp_' + 'c'.repeat(40))
  await contas.recarregar()
  const env = contas.envDaLinha('/usr/bin')
  assert.equal(env.SUPABASE_ACCESS_TOKEN, 'sbp_' + 'c'.repeat(40))
  assert.ok(env.PATH.startsWith(path.join(dados, 'ferramentas')))
  assert.ok(env.PATH.endsWith('/usr/bin'))
})

test('situacao: GitHub e Vercel perguntam à própria CLI; falha de CLI = não ligado (nunca finge)', async () => {
  const { contas } = montar({ rodar: async (cmd, args) => {
    if (args.includes('whoami')) return { codigo: 0, saida: '> ze-barbearia\n' }
    throw new Error('sem gh')
  } })
  const s = await contas.situacao()
  assert.deepEqual(s.github, { ligado: false, usuario: null })
  assert.deepEqual(s.hosp, { ligado: true, usuario: 'ze-barbearia' })
  assert.deepEqual(s.supabase, { ligado: false, usuario: null })
})

test('instalar as ferramentas: uma de cada vez, versões fixas, dentro da pasta do Atlas, sem global', async () => {
  const { contas, chamadas, dados } = montar({ existe: () => false, rodar: async () => ({ codigo: 0, saida: '' }) })
  assert.equal(await contas.instalarFerramentas(['vercel', 'supabase']), true)
  const inst = chamadas.filter((x) => x.args.includes('install'))
  assert.equal(inst.length, 2, 'cada ferramenta num npm install próprio')
  for (const c of inst) { assert.ok(c.args.includes('--prefix') && c.args.includes(path.join(dados, 'ferramentas'))); assert.ok(!c.args.includes('-g')) }
  assert.ok(inst[0].args.some((a) => /^vercel@\d/.test(a)) && !inst[0].args.some((a) => /^(supabase|eas-cli)@/.test(a)))
  assert.ok(inst[1].args.some((a) => /^supabase@\d/.test(a)))
})

test('instalar as ferramentas: a pesada (Expo) não trava a Vercel; falhou uma vez = tenta de novo', async () => {
  let vercelVezes = 0
  const { contas, chamadas } = montar({ existe: () => false, rodar: async (cmd, args) => {
    if (args.some((a) => /^vercel@/.test(a))) return { codigo: vercelVezes++ === 0 ? 1 : 0, saida: '' }
    if (args.some((a) => /^eas-cli@/.test(a))) return { codigo: 1, saida: '' }
    return { codigo: 0, saida: '' }
  } })
  assert.equal(await contas.instalarFerramentas(['vercel']), true)
  assert.equal(vercelVezes, 2)
  assert.ok(!chamadas.some((c) => c.args.some((a) => /^eas-cli@/.test(a))), 'só instala o que o passo precisa')
  assert.equal(await contas.instalarFerramentas(['eas']), false)
})

test('ferramentas prontas: confere só as pedidas', () => {
  const { contas } = montar({ existe: (f) => f.includes(path.join('vercel', 'dist')) })
  assert.equal(contas.ferramentasProntas(['vercel']), true)
  assert.equal(contas.ferramentasProntas(['vercel', 'eas']), false)
})

test('rodarFerramentaTentando: internet que pisca tenta de novo; erro de montagem e sucesso não repetem', async () => {
  let vezes = 0
  const { contas } = montar({ rodar: async () => (vezes++ < 2 ? { codigo: 1, saida: 'Error: connect ETIMEDOUT 76.76.21.21:443' } : { codigo: 0, saida: 'ok' }) })
  assert.equal((await contas.rodarFerramentaTentando('vercel', ['deploy'], { cwd: '/x' }, { esperar: async () => {} })).codigo, 0)
  assert.equal(vezes, 3)
  let b = 0
  const { contas: c2 } = montar({ rodar: async () => { b++; return { codigo: 1, saida: 'Error: Command "npm run build" exited with 1' } } })
  assert.equal((await c2.rodarFerramentaTentando('vercel', ['deploy'], { cwd: '/x' }, { esperar: async () => {} })).codigo, 1)
  assert.equal(b, 1)
})

test('rodarFerramenta (colocar no ar): só vercel/supabase, na pasta da obra, valor pela entrada', async () => {
  const vistos = []
  const { contas } = montar({ rodar: async (cmd, args, o) => { vistos.push({ args, o }); return { codigo: 0, saida: 'ok' } } })
  const r = await contas.rodarFerramenta('vercel', ['env', 'add', 'VITE_SUPABASE_URL', 'production'], { cwd: '/obras/ponto', entrada: 'https://x.supabase.co' })
  assert.equal(r.codigo, 0)
  assert.equal(vistos[0].o.cwd, '/obras/ponto')
  assert.equal(vistos[0].o.entrada, 'https://x.supabase.co')
  assert.equal(vistos[0].o.env.CI, '1')
  assert.ok(!vistos[0].args.includes('https://x.supabase.co'))
  assert.equal((await contas.rodarFerramenta('gh', ['x'])).codigo, 1)
  assert.equal((await contas.rodarFerramenta('vercel', [1])).codigo, 1)
})

// Guilherme, 27/11/2026: "o Supabase saiu deste computador" com a tela das contas dizendo "Ligado". O cofre (DPAPI) só abre
// depois do "ready" do Electron; a leitura ao abrir o Atlas falhava em silêncio e a linha rodava sem a chave.
test('cofre que ainda não abriu ao iniciar: a tela das contas, ao ler a chave, também a entrega à linha', async () => {
  const chave = 'sbp_' + 'd'.repeat(40)
  let pronto = false
  const base = criarCofreMemoria()
  await base.guardar(CHAVE_SUPABASE, chave)
  const cofre = { ...base, ler: async (c) => { if (!pronto) throw new Error('cofre-indisponivel'); return base.ler(c) } }
  const { contas } = montar({ cofre })
  await contas.recarregar() // antes do "ready": falha
  assert.equal(contas.envDaLinha().SUPABASE_ACCESS_TOKEN, undefined)
  pronto = true
  const s = await contas.situacao()
  assert.equal(s.supabase.ligado, true)
  assert.equal(contas.envDaLinha().SUPABASE_ACCESS_TOKEN, chave, 'se a tela diz Ligado, a linha recebe a chave')
})

test('main.cjs lê a chave do Supabase só depois do "ready" (antes, o cofre do Windows não abre)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8')
  assert.ok(!/^void contasCli\.recarregar\(\)/m.test(src), 'não pode ler no carregamento do módulo')
  assert.match(src, /app\.whenReady\(\)\.then\(\(\) => contasCli\.recarregar\(\)\)/)
})
