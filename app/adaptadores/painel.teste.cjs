// Teste do painel (node --test app/adaptadores/*.teste.cjs). Sem Claude real: a linha de produção é simulada.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { criarPainel, lerPlanoDoTexto, paradaDeOcorrencias } = require('./painel.cjs')
const { criarConstrucao } = require('./construcao.cjs')
const { criarModo } = require('./modo.cjs')
const { lerPlano } = require('../../.claude/hooks/plano.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-painel-'))
const ETAPAS = [{ n: 'M1', nome: 'Base', desc: 'a' }, { n: 'M2', nome: 'Agenda', desc: 'b' }, { n: 'M3', nome: 'Pagamento', desc: 'c' }]

function montar(extra = {}) {
  const raiz = tmp(); const home = tmp()
  fs.mkdirSync(path.join(raiz, 'obra'))
  const chamadas = []
  const modos = criarModo({ raiz })
  const c = criarConstrucao({
    raiz, home, modos, claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }),
    iniciarFluxo: () => { let t; chamadas.push('religar'); return { parar: () => { chamadas.push('parar'); t({ codigo: null, parado: true }) }, fim: new Promise((r) => { t = r }) } },
  })
  const abertos = []
  const painel = criarPainel({ raiz, home, modos, construcao: c, shell: { openExternal: async (u) => abertos.push(u), openPath: async (u) => { abertos.push(u); return '' } }, kitDir: path.join(__dirname, '..', '..', '.claude'), subir: async () => {}, porta: 1, ...extra })
  return { raiz, home, c, painel, chamadas, abertos, modos }
}
const marcar = (raiz, ate) => {
  const arq = path.join(raiz, 'obra', 'PLAN.md')
  let md = fs.readFileSync(arq, 'utf8'); let ms = 0
  md = md.split('\n').map((l) => { if (/^## Milestone/.test(l)) ms++; return ms && ms <= ate && /^- \[ \]/.test(l) ? l.replace('[ ]', '[x]') : l }).join('\n')
  fs.writeFileSync(arq, md)
}

test('% ponderado igual ao plano.cjs do kit (e à porta local)', async () => {
  const { raiz, c, painel } = montar()
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  marcar(raiz, 1)
  const e = await painel.ler('obra')
  const k = lerPlano(path.join(raiz, 'obra'))
  assert.ok(Math.abs(e.pct - k.pct) < 0.05) // o painel mostra 2 casas; o kit, 1
  assert.equal(lerPlanoDoTexto(fs.readFileSync(path.join(raiz, 'obra', 'PLAN.md'), 'utf8')).pct, k.pct)
  assert.deepEqual(e.etapa, { n: 2, nome: 'Agenda' })
  assert.equal(e.agora.length, 1) // linha rodando
  assert.equal(e.parada, null)
})

test('pausar derruba a linha; continuar religa e reafirma o recomendado do modo', async () => {
  const { home, c, painel, chamadas } = montar()
  await c.iniciar('obra', 'B', 'passo-a-passo', ETAPAS)
  await painel.pausar('obra')
  assert.ok(chamadas.includes('parar'))
  assert.equal((await painel.ler('obra')).pausadaPorVoce, true)
  fs.writeFileSync(path.join(home, '.claude', 'recomendado.json'), JSON.stringify({ ativo: true }))
  await painel.continuar('obra')
  assert.equal((await painel.ler('obra')).pausadaPorVoce, false)
  assert.equal(chamadas.filter((x) => x === 'religar').length, 2)
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.claude', 'recomendado.json'), 'utf8')).ativo, false)
})

test('passo a passo: etapa pronta espera o OK; aprovarEtapa libera', async () => {
  const { raiz, c, painel } = montar()
  await c.iniciar('obra', 'B', 'passo-a-passo', ETAPAS)
  marcar(raiz, 1)
  assert.deepEqual((await painel.ler('obra')).etapaPronta, { n: 1, nome: 'Base' })
  await painel.aprovarEtapa('obra')
  assert.equal((await painel.ler('obra')).etapaPronta, null)
})

test('aplicarModo regrava modo.json e recomendado.json; modo inválido é recusado', async () => {
  const { home, c, painel, modos } = montar()
  await c.iniciar('obra', 'B', 'automatico', ETAPAS)
  await painel.aplicarModo('obra', 'passo-a-passo')
  assert.equal(await modos.ler('obra'), 'passo-a-passo')
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.claude', 'recomendado.json'), 'utf8')).ativo, false)
  await assert.rejects(painel.aplicarModo('obra', 'x'), /modo-invalido/)
})

test('parada por cota: linha.json e ocorrências abertas', async () => {
  const { raiz, c, painel, chamadas } = montar()
  await c.iniciar('obra', 'B', 'automatico', ETAPAS)
  await painel.pausar('obra')
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify({ estado: 'parou', motivo: 'cota' }))
  assert.equal((await painel.ler('obra')).parada, 'cota')
  assert.equal(paradaDeOcorrencias({ ocorrencias: [{ status: 'aberta', servico: 'Stripe', motivo: 'cobrança recusada' }] }), 'billing')
  assert.equal(paradaDeOcorrencias({ ocorrencias: [{ status: 'resolvida', servico: 'x', motivo: 'cota' }] }), null)
  assert.ok(chamadas.length)
})

test('endereço do canteiro só loopback; abrirTeste só por allowlist', async () => {
  const srv = http.createServer((_q, r) => { r.statusCode = 200; r.end('{}') })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const porta = srv.address().port
  const { raiz, c, painel, abertos } = montar()
  const p2 = criarPainel({ raiz, modos: criarModo({ raiz }), construcao: c, shell: { openExternal: async (u) => abertos.push(u), openPath: async () => '' }, subir: async () => {}, porta })
  await c.iniciar('obra', 'B', 'automatico', ETAPAS)
  assert.equal(p2.enderecoCanteiro('obra'), null)
  await p2.ler('obra')
  await new Promise((r) => setTimeout(r, 300))
  assert.match(p2.enderecoCanteiro('obra'), new RegExp(`^http://127\\.0\\.0\\.1:${porta}/\\?obra=[0-9a-f]{10}$`))
  assert.equal(p2.enderecoCanteiro('../x'), null)
  srv.close()
  await assert.rejects(painel.abrirTeste('obra'), /sem-teste/)
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'teste.json'), JSON.stringify({ url: 'https://evil.example/x' }))
  await assert.rejects(painel.abrirTeste('obra'), /sem-teste/)
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'teste.json'), JSON.stringify({ url: 'http://127.0.0.1:5173' }))
  await painel.abrirTeste('obra')
  assert.deepEqual(abertos, ['http://127.0.0.1:5173'])
})

test('canteiro real: porta aleatória + nonce; impostor na porta não passa', async () => {
  const { spawn } = require('node:child_process')
  const crypto = require('node:crypto')
  const { portaLivre, responde } = require('./painel.cjs')
  const porta = await portaLivre()
  const nonce = crypto.randomBytes(8).toString('hex')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cant-'))
  const f = spawn(process.execPath, [path.join(__dirname, '..', '..', '.claude', 'canteiro', 'server.cjs'), String(porta)], { cwd: dir, stdio: 'ignore', env: { ...process.env, CANTEIRO_NONCE: nonce, CLAUDE_PROJECT_DIR: dir, HOME: dir, USERPROFILE: dir } })
  try {
    let ok = false
    for (let i = 0; i < 20 && !ok; i++) { ok = await responde(porta, nonce); if (!ok) await new Promise((r) => setTimeout(r, 200)) }
    assert.ok(ok)
    assert.equal(await responde(porta, 'nonce-errado'), false)
  } finally { f.kill() }
  const imp = http.createServer((_q, r) => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ obras: [], prova: 'x' })) })
  await new Promise((r) => imp.listen(0, '127.0.0.1', r))
  assert.equal(await responde(imp.address().port, nonce), false)
  imp.close()
})

test('kit do painel: instalado, vem de resources/kit (fora do asar); em desenvolvimento, do .claude do repositório', () => {
  const { kitDirDoApp } = require('./painel.cjs')
  assert.equal(kitDirDoApp({ empacotado: true, recursos: 'C:\\Atlas\\resources' }), path.join('C:\\Atlas\\resources', 'kit'))
  assert.equal(kitDirDoApp({ empacotado: false, recursos: 'x' }), path.join(__dirname, '..', '..', '.claude'))
})

test('trava conhecida de uma conta: o painel devolve a trava (só dados limpos) e a obra NÃO fica parada', async () => {
  const { raiz, c, painel } = montar()
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  fs.mkdirSync(path.join(raiz, 'obra', 'docs'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'docs', 'ocorrencias.json'), JSON.stringify({ proximo_id: 2, ocorrencias: [
    { id: 1, status: 'aberta', servico: 'GitHub', motivo: 'minutos do GitHub Actions acabaram (billing) <script>', acao: 'x', liberar_em: '2026-12-01T03:00:00.000Z', bloqueia: [], tentativas: [] },
  ] }))
  const e = await painel.ler('obra')
  assert.equal(e.parada, null)
  assert.deepEqual(e.trava, { id: 1, tipo: 'github-minutos', servico: 'GitHub', liberaEm: '2026-12-01T03:00:00.000Z' })
})

const roteiro = (raiz, r) => { fs.mkdirSync(path.join(raiz, 'obra', '.claude'), { recursive: true }); fs.writeFileSync(path.join(raiz, 'obra', '.claude', 'roteiro.json'), JSON.stringify(r)) }

test('avanço fino (Luiz, 24/11): o trabalho da etapa em andamento já conta, em 2 casas, sem passar do que a etapa vale', async () => {
  let commits = 0
  const { raiz, c, painel } = montar({ contarCommits: () => commits })
  await c.iniciar('obra', 'B', 'automatico', ETAPAS)
  assert.equal((await painel.ler('obra')).pct, 0) // nada começou: 0 de verdade
  roteiro(raiz, { milestone: 'M1', etapa_concluida: 0, branch: 'feat/m1-base' })
  const comecou = (await painel.ler('obra')).pct
  assert.ok(comecou > 0, `começou mostra algo: ${comecou}`)
  roteiro(raiz, { milestone: 'M1', etapa_concluida: 1, branch: 'feat/m1-base' })
  const planejado = (await painel.ler('obra')).pct
  commits = 1
  const umCommit = (await painel.ler('obra')).pct
  roteiro(raiz, { milestone: 'M1', etapa_concluida: 3, branch: 'feat/m1-base' })
  const revisado = (await painel.ler('obra')).pct
  assert.ok(comecou < planejado && planejado < umCommit && umCommit < revisado, [comecou, planejado, umCommit, revisado].join(' < '))
  const k = lerPlano(path.join(raiz, 'obra'))
  const fatiaM1 = 100 * k.milestones[0].peso / k.milestones.reduce((a, m) => a + m.peso, 0)
  assert.ok(revisado < fatiaM1, 'antes da medição, nunca chega ao valor da etapa inteira')
  for (const v of [comecou, planejado, umCommit, revisado]) assert.equal(Math.round(v * 100) / 100, v) // 2 casas
  const e = await painel.ler('obra')
  assert.equal(e.feitas, 0) // "0 de N tarefas" continua honesto
})

test('avanço fino: roteiro de outro milestone (já medido) ou quebrado não conta nada a mais', async () => {
  const { raiz, c, painel } = montar({ contarCommits: () => 5 })
  await c.iniciar('obra', 'B', 'automatico', ETAPAS)
  marcar(raiz, 1)
  const base = (await painel.ler('obra')).pct
  roteiro(raiz, { milestone: 'M1', etapa_concluida: 3 })
  assert.equal((await painel.ler('obra')).pct, base)
  fs.writeFileSync(path.join(raiz, 'obra', '.claude', 'roteiro.json'), '{quebrado')
  assert.equal((await painel.ler('obra')).pct, base)
})

test('vigia (24/11): o painel conta o que o vigia está fazendo (tentando de novo ou precisando de você)', async () => {
  const estados = { obra: { situacao: 'tentando', tentativa: 1, de: 3, motivo: 'A linha parou.', proximaEm: '2026-11-24T10:05:00.000Z' } }
  const { c, painel } = montar({ vigia: { estado: (p) => estados[p] ?? null } })
  await c.iniciar('obra', 'B', 'automatico', ETAPAS)
  assert.deepEqual((await painel.ler('obra')).vigia, estados.obra)
})

// M41: o painel traz as últimas linhas do diário, o último sinal da linha e a hora de volta da cota; e o diário completo.
test('painel: diário (últimas e completo), último sinal e hora de volta da cota', async () => {
  const { criarDiario } = require('./diario.cjs')
  const diario = criarDiario()
  const { raiz, c, painel } = montar({ diario })
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  for (let i = 0; i < 12; i++) diario.registrar(path.join(raiz, 'obra'), { tipo: 'info', texto: `evento ${i}` })
  const e = await painel.ler('obra')
  assert.equal(e.diario.length, 8)
  assert.equal(e.diario.at(-1).texto, 'evento 11')
  assert.ok('sinal' in e)
  assert.equal(e.voltaEm, null)
  const todo = await painel.diario('obra')
  assert.ok(todo.length >= 12)
  c.linha.parar('obra')
  await new Promise((r) => setTimeout(r, 20))
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify({ versao: 1, estado: 'parou', motivo: 'cota', voltaEm: '2026-11-24T18:40:00.000Z' }))
  assert.equal((await painel.ler('obra')).voltaEm, '2026-11-24T18:40:00.000Z')
})

// M41: aba Cronograma. Previsto guardado no início, real por etapa, término esperado e pausas de cota (do diário).
test('painel: cronograma da obra com previsto, real, esperado e as pausas de cota do diário', async () => {
  const { criarDiario } = require('./diario.cjs')
  const diario = criarDiario()
  const { raiz, c, painel } = montar({ diario })
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  const dir = path.join(raiz, 'obra')
  diario.registrar(dir, { tipo: 'parada', texto: 'Parou: a cota do seu plano do Claude acabou. Volta sozinha às 15:40.' })
  diario.registrar(dir, { tipo: 'info', texto: 'O Atlas começou a trabalhar na obra' })
  const v = await painel.cronograma('obra')
  assert.equal(v.etapas.length, ETAPAS.length)
  assert.ok(Date.parse(v.previstoFim) > Date.parse(v.inicio))
  assert.equal(v.etapas[0].status, 'andamento')
  assert.equal(v.pausas.length, 1)
  assert.ok(v.pausas[0].fim)
})
