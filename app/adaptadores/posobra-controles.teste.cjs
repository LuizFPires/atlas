// Controles do pós-obra com git de verdade (Guilherme, 27/11/2026): cancelar mudança, descartar a pronta e publicar agora.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { criarPosObra, blocoDoMilestone, semMilestone } = require('./posobra.cjs')

const ID = ['-c', 'user.name=Teste', '-c', 'user.email=t@t.t', '-c', 'commit.gpgsign=false']
const git = async (args, { cwd }) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8' }); return { codigo: r.status, saida: `${r.stdout || ''}${r.stderr || ''}` } }
const sh = (cwd, ...args) => { const r = spawnSync('git', [...ID, ...args], { cwd, encoding: 'utf8' }); if (r.status !== 0) throw new Error(`${args.join(' ')}: ${r.stderr}`); return r.stdout.trim() }
const bloco = (n, id, feitas = 0) => [`## Milestone ${n} — Pós-obra ${id}`, 'peso: 1', 'spec: regras.md', 'tela: ',
  `- [${feitas > 0 ? 'x' : ' '}] Construir`, `- [${feitas > 1 ? 'x' : ' '}] Testar`, `- [${feitas > 2 ? 'x' : ' '}] Conferir`, 'Notas:', ''].join('\n')
const BASE = ['# PLAN — Ponto', '', '## Milestone 1 — Base', 'peso: 1', 'spec: regras.md', 'tela: ', '- [x] Fazer', 'Notas:', ''].join('\n')

/** Obra com a linha no meio do M2 (p001), M3 (p002) e M4 (p003) na fila, como o pós-obra deixa. */
function montar({ rodando = true } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-ctl-'))
  const cwd = path.join(raiz, 'obra')
  fs.mkdirSync(cwd)
  sh(cwd, 'init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(cwd, 'PLAN.md'), BASE)
  fs.writeFileSync(path.join(cwd, '.gitignore'), '.atlas/\nposobra/\n')
  sh(cwd, 'add', '-A'); sh(cwd, 'commit', '-q', '-m', 'base')
  // o pós-obra acrescentou os 3 milestones (sem commit); a linha abriu a branch do M2 e já fez parte
  fs.writeFileSync(path.join(cwd, 'PLAN.md'), [BASE, bloco(2, 'p001', 1), bloco(3, 'p002'), bloco(4, 'p003')].join('\n'))
  sh(cwd, 'checkout', '-q', '-b', 'feat/m2-filtro')
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'pronto do M2\n')
  sh(cwd, 'add', '-A'); sh(cwd, 'commit', '-q', '-m', 'M2: parte 1')
  fs.writeFileSync(path.join(cwd, 'b.txt'), 'em andamento\n') // sem commit
  fs.mkdirSync(path.join(cwd, 'posobra'))
  const hist = [['p001', 2, '2026-11-27T16:30:00Z'], ['p002', 3, '2026-11-27T18:05:00Z'], ['p003', 4, '2026-11-27T19:12:00Z']]
    .map(([id, milestone, criadoEm]) => ({ id, nome: `Pedido ${id}`, criadoEm, minutos: 30, status: 'em-andamento', milestone }))
  fs.writeFileSync(path.join(cwd, 'posobra', 'historico.json'), JSON.stringify({ versao: 1, pedidos: hist }))
  const ev = { parar: 0, religar: 0 }
  let roda = rodando
  const construcao = { linha: { rodando: () => roda, parar: () => { ev.parar++; roda = false }, religar: () => { ev.religar++; roda = true }, ultimoFim: () => null } }
  const mk = (extra = {}) => criarPosObra({ raiz, disparo: {}, construcao, licenca: {}, git, agora: () => new Date('2026-11-27T21:00:00Z'), ...extra })
  return { raiz, cwd, ev, construcao, p: mk(), mk, parar: () => { roda = false } }
}
const planDe = (cwd) => fs.readFileSync(path.join(cwd, 'PLAN.md'), 'utf8')
const histDe = (cwd) => JSON.parse(fs.readFileSync(path.join(cwd, 'posobra', 'historico.json'), 'utf8')).pedidos
const branch = (cwd) => sh(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')

test('blocoDoMilestone / semMilestone: tira só o bloco pedido, o resto fica igual', () => {
  const plan = [BASE, bloco(2, 'p001', 1), bloco(3, 'p002')].join('\n')
  assert.equal(blocoDoMilestone(plan, 2).faltam, 2)
  assert.equal(blocoDoMilestone(plan, 3).faltam, 3)
  assert.equal(blocoDoMilestone(plan, 9), null)
  const sem = semMilestone(plan, 2)
  assert.equal(blocoDoMilestone(sem, 2), null)
  assert.ok(sem.includes('## Milestone 1 — Base') && sem.includes('## Milestone 3 — Pós-obra p002'))
})

test('histórico: diz qual está sendo feita e quais estão na fila; só o que falta fazer pode ser cancelado', async () => {
  const { p } = montar()
  const h = await p.historico('obra')
  assert.deepEqual(h.map((x) => [x.id, x.fila, x.podeCancelar, x.data.split(' · ')[1]]), [
    ['p003', 'fila', true, 'na fila'], ['p002', 'fila', true, 'na fila'], ['p001', 'agora', true, 'sendo feita'],
  ])
})

test('cancelar um pedido da fila: sai do PLAN na hora, a linha segue no que estava (sem mexer na branch nem no que estava aberto)', async () => {
  const { p, cwd, ev } = montar()
  const r = await p.cancelar('obra', 'p003')
  assert.deepEqual(r, { ok: true, continuou: true })
  assert.equal(branch(cwd), 'feat/m2-filtro')
  assert.ok(fs.existsSync(path.join(cwd, 'b.txt')), 'o trabalho aberto continua')
  assert.equal(blocoDoMilestone(planDe(cwd), 4), null)
  assert.ok(blocoDoMilestone(planDe(cwd), 3))
  assert.equal(histDe(cwd).find((h) => h.id === 'p003').status, 'cancelada')
  assert.deepEqual(ev, { parar: 1, religar: 1 })
  const h = await p.historico('obra')
  assert.deepEqual(h.find((x) => x.id === 'p003'), { id: 'p003', nome: 'Pedido p003', data: '27/11 · cancelada', status: 'cancelada', fila: null, podeCancelar: false, podeDescartar: false })
})

test('cancelar o que está sendo feito: para a linha, guarda o feito num commit da branch, volta à base com a fila e segue com o próximo', async () => {
  const { p, cwd, ev } = montar()
  const r = await p.cancelar('obra', 'p001')
  assert.deepEqual(r, { ok: true, continuou: true })
  assert.equal(branch(cwd), 'main')
  assert.equal(sh(cwd, 'log', '-1', '--format=%s', 'feat/m2-filtro'), 'Atlas: pausa (trabalho em andamento guardado)', 'nada se perde: fica na branch')
  assert.ok(!fs.existsSync(path.join(cwd, 'a.txt')) && !fs.existsSync(path.join(cwd, 'b.txt')), 'nada do M2 na base')
  const plan = planDe(cwd)
  assert.equal(blocoDoMilestone(plan, 2), null)
  assert.ok(blocoDoMilestone(plan, 3) && blocoDoMilestone(plan, 4), 'a fila continua')
  assert.equal(ev.religar, 1)
  const h = await p.historico('obra')
  assert.equal(h.find((x) => x.id === 'p002').fila, 'agora')
})

test('cancelar o último da fila com a linha parada: não religa à toa', async () => {
  const { p, ev } = montar({ rodando: false })
  await p.cancelar('obra', 'p003')
  assert.equal(ev.religar, 0)
})

test('cancelar o que não dá: pronto, já no ar ou id estranho', async () => {
  const { p, cwd } = montar()
  fs.writeFileSync(path.join(cwd, 'PLAN.md'), planDe(cwd).replace(bloco(3, 'p002'), bloco(3, 'p002', 3)))
  await assert.rejects(p.cancelar('obra', 'p002'), /ja-pronta/)
  await assert.rejects(p.cancelar('obra', 'p999'), /nao-cancelavel/)
  await assert.rejects(p.cancelar('obra', '../x'), /pedido-invalido/)
})

function comMergePronto(m) {
  const { cwd } = m
  m.parar()
  sh(cwd, 'add', '-A'); sh(cwd, 'commit', '-q', '-m', 'M2: fim')
  sh(cwd, 'checkout', '-q', 'main')
  sh(cwd, 'merge', '-q', '--no-ff', 'feat/m2-filtro', '-m', 'Merge pull request #7: M2 — Pós-obra p001')
  const hist = histDe(cwd)
  hist[0].status = 'para-conferir'
  fs.writeFileSync(path.join(cwd, 'posobra', 'historico.json'), JSON.stringify({ versao: 1, pedidos: hist }))
}

test('descartar a mudança pronta: desfaz o merge dela na base (a versão de teste volta) e marca "descartada"', async () => {
  const m = montar()
  comMergePronto(m)
  const { p, cwd } = m
  assert.ok(fs.existsSync(path.join(cwd, 'a.txt')))
  assert.equal((await p.historico('obra')).find((x) => x.id === 'p001').podeDescartar, true)
  assert.deepEqual(await p.descartar('obra', 'p001'), { ok: true })
  assert.ok(!fs.existsSync(path.join(cwd, 'a.txt')) && !fs.existsSync(path.join(cwd, 'b.txt')))
  assert.equal(histDe(cwd).find((h) => h.id === 'p001').status, 'descartada')
  assert.equal(sh(cwd, 'status', '--porcelain', '--untracked-files=no'), '')
})

test('descartar: com a obra trabalhando recusa; com conflito volta tudo como estava', async () => {
  const m = montar()
  comMergePronto(m)
  const { cwd, mk, construcao } = m
  const ocupado = mk({ })
  construcao.linha.religar()
  await assert.rejects(ocupado.descartar('obra', 'p001'), /obra-trabalhando/)
  construcao.linha.parar()
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'mexido depois\n')
  sh(cwd, 'commit', '-q', '-am', 'outra mudança em cima')
  const antes = sh(cwd, 'rev-parse', 'HEAD')
  await assert.rejects(mk().descartar('obra', 'p001'), /descartar-conflito/)
  assert.equal(sh(cwd, 'rev-parse', 'HEAD'), antes)
  assert.equal(sh(cwd, 'status', '--porcelain', '--untracked-files=no'), '')
  assert.equal(histDe(cwd).find((h) => h.id === 'p001').status, 'para-conferir')
})

const esperarAte = async (cond) => { for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => setTimeout(r, 5)) }

test('publicar agora: para a linha, publica a BASE (sem o que está pela metade) e devolve a obra ao ponto, religando a fila', async () => {
  const m = montar()
  const { cwd, ev, mk, raiz } = m
  fs.mkdirSync(path.join(cwd, '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(cwd, '.atlas', 'no-ar.json'), JSON.stringify({ nome: 'ponto-sistema', endereco: 'https://ponto-sistema.vercel.app' }))
  const visto = {}
  let fase = 'parado'
  const noAr = { iniciar: async (pasta, nome) => { visto.nome = nome; visto.branch = branch(cwd); visto.a = fs.existsSync(path.join(cwd, 'a.txt')); visto.b = fs.existsSync(path.join(cwd, 'b.txt')); fase = 'rodando' }, estado: () => ({ fase }) }
  const p = mk({ noAr, esperar: async () => { await new Promise((r) => setTimeout(r, 1)) } })
  assert.deepEqual(await p.publicarAgora('obra'), { ok: true })
  assert.deepEqual(visto, { nome: 'ponto-sistema', branch: 'main', a: false, b: false })
  assert.equal(ev.parar, 1)
  assert.ok(fs.existsSync(path.join(cwd, '.atlas', 'pausa-publicar.json')))
  fase = 'noar'
  await esperarAte(() => ev.religar === 1)
  assert.equal(branch(cwd), 'feat/m2-filtro')
  assert.equal(fs.readFileSync(path.join(cwd, 'b.txt'), 'utf8'), 'em andamento\n', 'o que estava aberto volta aberto')
  assert.notEqual(sh(cwd, 'log', '-1', '--format=%s'), 'Atlas: pausa (trabalho em andamento guardado)')
  assert.ok(!fs.existsSync(path.join(cwd, '.atlas', 'pausa-publicar.json')))
  assert.equal(ev.religar, 1)
  void raiz
})

test('publicar agora: obra nunca publicada recusa sem mexer em nada', async () => {
  const { p, cwd, ev } = montar()
  const p2 = criarPosObra({ raiz: path.dirname(cwd), disparo: {}, construcao: { linha: { rodando: () => true, parar: () => { ev.parar++ } } }, licenca: {}, git, noAr: { iniciar: async () => {}, estado: () => ({}) } })
  await assert.rejects(p2.publicarAgora('obra'), /sem-publicacao/)
  assert.equal(ev.parar, 0)
  assert.equal(branch(cwd), 'feat/m2-filtro')
  void p
})

test('publicar agora com o Atlas fechado no meio: recuperar() devolve a obra na próxima abertura', async () => {
  const m = montar()
  const { cwd, ev, mk } = m
  fs.mkdirSync(path.join(cwd, '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(cwd, '.atlas', 'no-ar.json'), JSON.stringify({ nome: 'ponto-sistema', endereco: 'https://x.vercel.app' }))
  // 1ª abertura: a publicação começa e o Atlas "fecha" (a espera nunca termina)
  const p = mk({ noAr: { iniciar: async () => {}, estado: () => ({ fase: 'rodando' }) }, esperar: () => new Promise(() => {}) })
  await p.publicarAgora('obra')
  assert.equal(branch(cwd), 'main')
  // 2ª abertura: nada rodando
  const p2 = mk({ noAr: { iniciar: async () => {}, estado: () => ({ fase: 'parado' }) } })
  const r = await p2.recuperar('obra')
  assert.deepEqual(r, { ok: true, continuou: true })
  assert.equal(branch(cwd), 'feat/m2-filtro')
  assert.ok(fs.existsSync(path.join(cwd, 'b.txt')))
  assert.equal(ev.religar, 1)
  assert.deepEqual(await p2.recuperar('obra'), { ok: true, nada: true })
})
