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

function montar({ rodar = async () => ({ codigo: 1, saida: '' }), cofre = criarCofreMemoria() } = {}) {
  const dados = tmp()
  const pf = processosFalsos()
  const chamadas = []
  const r = async (cmd, args, o) => { chamadas.push({ cmd, args, env: o && o.env }); return rodar(cmd, args, o) }
  const contas = criarContasCli({ dadosApp: dados, cofre, rodar: r, iniciar: pf.iniciar, plataforma: 'linux', env: { PATH: '/usr/bin' }, existe: () => true })
  return { contas, pf, chamadas, cofre, dados }
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

test('Supabase: a chave vai ao cofre (nunca a arquivo) só depois que o próprio Supabase aceita; formato errado nem é testado', async () => {
  const usados = []
  const { contas, cofre, chamadas, dados } = montar({ rodar: async (cmd, args, o) => { usados.push(o.env.SUPABASE_ACCESS_TOKEN); return { codigo: o.env.SUPABASE_ACCESS_TOKEN === 'sbp_' + 'a'.repeat(40) ? 0 : 1, saida: '[]' } } })
  assert.deepEqual(await contas.guardarChaveSupabase('senha123'), { ok: false, motivo: 'formato' })
  assert.equal(chamadas.length, 0)
  assert.deepEqual(await contas.guardarChaveSupabase('sbp_' + 'b'.repeat(40)), { ok: false, motivo: 'recusada' })
  assert.equal(await cofre.ler(CHAVE_SUPABASE), null)
  assert.deepEqual(await contas.guardarChaveSupabase('  sbp_' + 'a'.repeat(40) + '\n'), { ok: true })
  assert.equal(await cofre.ler(CHAVE_SUPABASE), 'sbp_' + 'a'.repeat(40))
  // a chave vai pelo ambiente, nunca na linha de comando
  assert.ok(chamadas.every((c) => !c.args.join(' ').includes('sbp_')))
  const tudo = fs.readdirSync(dados, { recursive: true }).map((f) => { try { return fs.readFileSync(path.join(dados, String(f)), 'utf8') } catch { return '' } }).join('')
  assert.ok(!tudo.includes('sbp_'))
  assert.equal(contas.estado('supabase'), 'ligado')
  assert.deepEqual((await contas.situacao()).supabase, { ligado: true, usuario: null })
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

test('instalar as ferramentas: versões fixas, dentro da pasta do Atlas, sem global', async () => {
  const { contas, chamadas, dados } = montar({ rodar: async () => ({ codigo: 0, saida: '' }) })
  assert.equal(await contas.instalarFerramentas(), true)
  const c = chamadas.find((x) => x.args.includes('install'))
  assert.ok(c.args.includes('--prefix') && c.args.includes(path.join(dados, 'ferramentas')))
  assert.ok(!c.args.includes('-g'))
  assert.ok(c.args.some((a) => /^vercel@\d/.test(a)) && c.args.some((a) => /^supabase@\d/.test(a)))
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
