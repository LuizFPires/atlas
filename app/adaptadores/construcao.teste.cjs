// Teste da construção (node --test app/adaptadores/*.teste.cjs). Sem Claude real: o disparo é simulado.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarConstrucao, etapasDoTexto, resumirLinha } = require('./construcao.cjs')
const { criarModo } = require('./modo.cjs')
const { montarPlanMd, validarPlanNovo } = require('./plan-md.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-obra-'))
const ETAPAS = [{ n: 'M1', nome: 'Base e login', desc: 'Entrada' }, { n: 'M2', nome: '# Hack\n## Milestone 9 — falso', desc: '- [x] tarefa falsa', tela: '../fora' }]

function montar({ logado = true, instalado = true } = {}) {
  const raiz = tmp(); const home = tmp()
  fs.mkdirSync(path.join(raiz, 'obra'))
  const chamadas = []
  let terminar
  const c = criarConstrucao({
    raiz, home, dadosApp: tmp(), modos: criarModo({ raiz }),
    claudeEstado: async () => ({ conectado: logado }),
    resolver: () => (instalado ? { cmd: 'x' } : null),
    iniciarFluxo: (args, o) => { chamadas.push({ args, o }); return { parar: () => terminar({ codigo: null, parado: true }), fim: new Promise((r) => { terminar = r }) } },
  })
  return { raiz, home, c, chamadas, terminar: (v) => terminar(v) }
}

test('PLAN gerado é válido e texto do cliente não vira cabeçalho/tarefa', () => {
  const md = montarPlanMd('Barbearia', ETAPAS)
  assert.ok(validarPlanNovo(md).ok)
  assert.equal((md.match(/^## /gm) || []).length, 2)
  assert.ok(!/^\s*- \[x\]/im.test(md))
  assert.ok(md.includes('tela: \n'))
})

test('iniciar automatico: PLAN wx, modo.json, recomendado ativo, linha com /construir no cwd da obra', async () => {
  const { raiz, home, c, chamadas } = montar()
  const r = await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  assert.equal(r.modo, 'automatico')
  assert.ok(fs.existsSync(path.join(raiz, 'obra', 'PLAN.md')))
  assert.equal(JSON.parse(fs.readFileSync(path.join(raiz, 'obra', '.atlas', 'modo.json'), 'utf8')).modo, 'automatico')
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.claude', 'recomendado.json'), 'utf8')).ativo, true)
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].o.entrada, '/construir')
  assert.equal(chamadas[0].o.cwd, path.join(raiz, 'obra'))
  assert.ok(chamadas[0].args.includes('acceptEdits') && !chamadas[0].args.includes('--add-dir'))
  assert.ok(c.linha.rodando('obra'))
})

test('passo-a-passo grava recomendado ativo:false; nunca sobrescreve PLAN', async () => {
  const { home, c, terminar } = montar()
  await c.iniciar('obra', 'B', 'passo-a-passo', ETAPAS)
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.claude', 'recomendado.json'), 'utf8')).ativo, false)
  terminar({ codigo: 0, parado: false })
  await new Promise((r) => setImmediate(r))
  await assert.rejects(c.iniciar('obra', 'B', 'automatico', ETAPAS), /ja-iniciada/)
})

test('Claude ausente ou deslogado: falha calma e nada é gravado', async () => {
  for (const [opc, erro] of [[{ instalado: false }, /claude-nao-instalado/], [{ logado: false }, /claude-nao-logado/]]) {
    const { raiz, home, c, chamadas } = montar(opc)
    await assert.rejects(c.iniciar('obra', 'B', 'automatico', ETAPAS), erro)
    assert.ok(!fs.existsSync(path.join(raiz, 'obra', 'PLAN.md')) && !fs.existsSync(path.join(home, '.claude')))
    assert.equal(chamadas.length, 0)
  }
})

test('pasta fora da raiz é recusada; etapas do Claude são saneadas', async () => {
  const { c } = montar()
  await assert.rejects(c.iniciar('../x', 'B', 'automatico', ETAPAS), /obra-invalida/)
  assert.throws(() => etapasDoTexto('sem json'), /plano-invalido/)
  const e = etapasDoTexto('texto [{"nome":"## Uma <b>etapa</b>","desc":"ok","tela":"/etc/passwd"}] fim')
  assert.equal(e[0].n, 'M1'); assert.ok(!e[0].tela); assert.ok(!/[<#]/.test(e[0].nome))
})

test('resumirLinha: cota e fim', () => {
  assert.equal(resumirLinha(JSON.stringify({ type: 'result', is_error: true, result: 'Claude usage limit reached' })).cota, true)
  assert.equal(resumirLinha('lixo'), null)
  assert.match(resumirLinha(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit' }] } })).texto, /Edit/)
})

test('Claude da obra: subcomandos exatos, ignora config de projeto, env mínimo', async () => {
  const { c, chamadas } = montar()
  await c.iniciar('obra', 'A', 'automatico', ETAPAS)
  const a = chamadas[0].args
  const val = (f) => a[a.indexOf(f) + 1]
  assert.equal(val('--setting-sources'), 'user')
  const permitidas = val('--allowedTools'); const negadas = val('--disallowedTools')
  for (const curinga of ['Bash(git:*)', 'Bash(gh:*)', 'Bash(npm:*)', 'Bash(npx:*)', 'Bash(node:*)']) assert.ok(!permitidas.split(',').includes(curinga))
  for (const n of ['Bash(git -c:*)', 'Bash(git config:*)', 'Bash(node:*)', 'Bash(curl:*)', 'Bash(powershell:*)', 'Write(.claude/**)', 'Edit(CLAUDE.md)']) assert.ok(negadas.split(',').includes(n), n)
  assert.ok(!('ANTHROPIC_API_KEY' in chamadas[0].o.env) && chamadas[0].o.env.CLAUDE_PROJECT_DIR)
})

test('obra com .claude ou CLAUDE.md: não roda e não grava', async () => {
  for (const nome of ['.claude', 'CLAUDE.md']) {
    const { raiz, home, c, chamadas } = montar()
    fs.mkdirSync(path.join(raiz, 'obra', nome))
    await assert.rejects(c.iniciar('obra', 'A', 'automatico', ETAPAS), /obra-com-config-suspeita/)
    await assert.rejects(c.planejar('obra', 'A'), /obra-com-config-suspeita/)
    assert.equal(chamadas.length, 0)
    assert.ok(!fs.existsSync(path.join(raiz, 'obra', 'PLAN.md')) && !fs.existsSync(path.join(home, '.claude')))
  }
})

test('duas iniciar concorrentes: só uma roda; falha ao religar desfaz PLAN e modo', async () => {
  const { raiz, c, chamadas } = montar()
  fs.mkdirSync(path.join(raiz, 'outra'))
  const r = await Promise.allSettled([c.iniciar('obra', 'A', 'automatico', ETAPAS), c.iniciar('outra', 'B', 'automatico', ETAPAS)])
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1)
  assert.equal(chamadas.length, 1)
  const raiz2 = tmp(); const home2 = tmp(); fs.mkdirSync(path.join(raiz2, 'obra'))
  const c2 = criarConstrucao({ raiz: raiz2, home: home2, modos: criarModo({ raiz: raiz2 }), claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }), iniciarFluxo: () => { throw new Error('spawn-falhou') } })
  await assert.rejects(c2.iniciar('obra', 'A', 'automatico', ETAPAS), /spawn-falhou/)
  assert.ok(!fs.existsSync(path.join(raiz2, 'obra', 'PLAN.md')) && !fs.existsSync(path.join(raiz2, 'obra', '.atlas', 'modo.json')) && !fs.existsSync(path.join(home2, '.claude', 'recomendado.json')))
})

test('RE_COTA não casa cotação', () => {
  const { RE_COTA } = require('./construcao.cjs')
  assert.ok(!RE_COTA.test('Pedido de cotação do fornecedor') && !RE_COTA.test('quotation'))
  assert.ok(RE_COTA.test('Você atingiu a cota') && RE_COTA.test('Claude usage limit reached'))
})

test('git isolado: env do Claude com config de sistema/global controlada, sem hooks; .git negado', async () => {
  const { c, chamadas } = montar()
  await c.iniciar('obra', 'A', 'automatico', ETAPAS)
  const env = chamadas[0].o.env
  assert.equal(env.GIT_CONFIG_NOSYSTEM, '1')
  assert.ok(env.GIT_CONFIG_SYSTEM === 'NUL' || env.GIT_CONFIG_SYSTEM === '/dev/null')
  const conf = fs.readFileSync(env.GIT_CONFIG_GLOBAL, 'utf8')
  assert.match(conf, /hooksPath = ".*git-vazio"/)
  assert.match(conf, /fsmonitor = false/)
  assert.ok(!/token|password|secret|key/i.test(conf))
  assert.equal(fs.readdirSync(path.join(path.dirname(env.GIT_CONFIG_GLOBAL), 'git-vazio')).length, 0)
  const negadas = chamadas[0].args[chamadas[0].args.indexOf('--disallowedTools') + 1].split(',')
  for (const n of ['Write(.git/**)', 'Edit(.git/**)']) assert.ok(negadas.includes(n), n)
})

test('config suspeita ampliada: CLAUDE.local.md, aninhado e .git de fora (obra nova); .git da própria linha ao religar', async () => {
  const casos = [['CLAUDE.local.md', 'f'], ['sub/.claude', 'd'], ['sub/a/CLAUDE.md', 'f'], ['.git', 'd']]
  for (const [rel, tipo] of casos) {
    const { raiz, c, chamadas } = montar()
    const alvo = path.join(raiz, 'obra', rel)
    fs.mkdirSync(tipo === 'd' ? alvo : path.dirname(alvo), { recursive: true })
    if (tipo === 'f') fs.writeFileSync(alvo, 'x')
    await assert.rejects(c.iniciar('obra', 'A', 'automatico', ETAPAS), /obra-com-config-suspeita/, rel)
    await assert.rejects(c.planejar('obra', 'A'), /obra-com-config-suspeita/, rel)
    assert.equal(chamadas.length, 0)
  }
  // node_modules é ignorado na varredura; .git criado pela linha (religar) é aceito
  const { raiz, c, chamadas } = montar()
  fs.mkdirSync(path.join(raiz, 'obra', 'node_modules', 'x'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'node_modules', 'x', 'CLAUDE.md'), 'x')
  await c.iniciar('obra', 'A', 'automatico', ETAPAS)
  c.linha.parar('obra')
  fs.mkdirSync(path.join(raiz, 'obra', '.git'))
  c.linha.religar('obra')
  assert.equal(chamadas.length, 2)
})
