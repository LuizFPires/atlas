'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { criarNavegador, SITES, urlPermitida, contaPronta } = require('./navegador.cjs')

// Luiz, 23/11/2026: "abrir o browser de verdade nessa tela lateral do Atlas, para o usuário fazer tudo sem sair do Atlas".
test('só os sites das contas abrem dentro do Atlas (https, domínio exato ou subdomínio)', () => {
  for (const u of ['https://github.com/signup', 'https://supabase.com/dashboard', 'https://vercel.com/new', 'https://dashboard.stripe.com/register', 'https://api.github.com/x']) assert.equal(urlPermitida(u), true, u)
  for (const u of ['http://github.com', 'https://github.com.evil.com', 'https://evilgithub.com', 'file:///c:/x', 'javascript:alert(1)', 'https://accounts.google.com/o/oauth2', 'https://claude.ai/login', 'lixo']) assert.equal(urlPermitida(u), false, u)
})

test('o endereço inicial de cada conta é fixo, nunca vem da tela', () => {
  assert.deepEqual(Object.keys(SITES), ['github', 'supabase', 'hosp', 'pag'])
  for (const s of Object.values(SITES)) assert.equal(urlPermitida(s), true)
})

test('conta pronta: Supabase e Vercel pelo painel; GitHub pelo login feito', () => {
  assert.equal(contaPronta('supabase', 'https://supabase.com/dashboard/projects', false), true)
  assert.equal(contaPronta('supabase', 'https://supabase.com/dashboard/sign-in', false), false)
  assert.equal(contaPronta('hosp', 'https://vercel.com/new', false), true)
  assert.equal(contaPronta('hosp', 'https://vercel.com/signup', false), false)
  assert.equal(contaPronta('hosp', 'https://vercel.com/', false), false)
  assert.equal(contaPronta('github', 'https://github.com/', true), true)
  assert.equal(contaPronta('github', 'https://github.com/signup', false), false)
})

function falso() {
  const views = []
  const criarView = () => {
    const ev = {}
    const v = { carregados: [], bounds: null, visivel: true, destruida: false, url: '',
      loadURL(u) { this.carregados.push(u); this.url = u; (ev['did-navigate'] || []).forEach((f) => f({}, u)) },
      setBounds(b) { this.bounds = b }, setVisible(x) { this.visivel = x }, destruir() { this.destruida = true },
      on(n, f) { (ev[n] = ev[n] || []).push(f) }, emitir(n, ...a) { (ev[n] || []).forEach((f) => f(...a)) }, voltar() {}, recarregar() {} }
    views.push(v)
    return v
  }
  const avisos = []
  const externos = []
  const nav = criarNavegador({ criarView, avisar: (d) => avisos.push(d), abrirFora: (u) => externos.push(u), logadoNoGithub: async () => true })
  return { nav, views, avisos, externos }
}

test('abrir: cria um navegador só, carrega o site fixo da conta e avisa a tela da página e se a conta ficou pronta', async () => {
  const { nav, views, avisos } = falso()
  await nav.abrir('supabase', { x: 10, y: 20, width: 500, height: 600 })
  await nav.abrir('hosp', { x: 10, y: 20, width: 500, height: 600 })
  assert.equal(views.length, 1)
  assert.deepEqual(views[0].carregados, [SITES.supabase, SITES.hosp])
  assert.deepEqual(views[0].bounds, { x: 10, y: 20, width: 500, height: 600 })
  views[0].emitir('did-navigate', {}, 'https://vercel.com/new')
  await new Promise((ok) => setImmediate(ok))
  assert.deepEqual(avisos.at(-1), { conta: 'hosp', url: 'https://vercel.com/new', pronta: true })
  assert.equal(await nav.pronta('hosp'), true)
  assert.equal(await nav.pronta('supabase'), false)
})

test('conta desconhecida ou posição estranha: recusa sem abrir nada', async () => {
  const { nav, views } = falso()
  await assert.rejects(nav.abrir('banco', { x: 0, y: 0, width: 10, height: 10 }), /conta-invalida/)
  await assert.rejects(nav.abrir('github', { x: 'a' }), /posicao-invalida/)
  assert.equal(views.length, 0)
})

test('link para fora (ex.: entrar com o Google) não abre dentro: vai para o navegador do computador', () => {
  const { nav, views, externos } = falso()
  nav.abrir('github', { x: 0, y: 0, width: 100, height: 100 })
  const evento = { prevented: false, preventDefault() { this.prevented = true } }
  views[0].emitir('will-navigate', evento, 'https://accounts.google.com/signin')
  assert.equal(evento.prevented, true)
  assert.deepEqual(externos, ['https://accounts.google.com/signin'])
  const ev2 = { prevented: false, preventDefault() { this.prevented = true } }
  views[0].emitir('will-navigate', ev2, 'https://github.com/login')
  assert.equal(ev2.prevented, false)
})

test('esconder e fechar: o navegador some (para o vídeo e a ajuda aparecerem por cima) e fecha de vez ao sair das contas', () => {
  const { nav, views } = falso()
  nav.abrir('github', { x: 0, y: 0, width: 100, height: 100 })
  nav.mostrar(false)
  assert.equal(views[0].visivel, false)
  nav.mostrar(true)
  assert.equal(views[0].visivel, true)
  nav.fechar()
  assert.equal(views[0].destruida, true)
})

test('ligar as contas: abre o endereço que o Atlas recebeu da CLI só se for de um site das contas', async () => {
  const { nav, views } = falso()
  const b = { x: 0, y: 0, width: 600, height: 700 }
  await nav.abrirEndereco('https://github.com/login/device', b)
  assert.equal(views[0].carregados.at(-1), 'https://github.com/login/device')
  await assert.rejects(nav.abrirEndereco('https://mal.example/login/device', b), /endereco-invalido/)
  await assert.rejects(nav.abrirEndereco('https://vercel.com/device', { x: -1 }), /posicao-invalida/)
  assert.equal(views[0].carregados.length, 1)
})
