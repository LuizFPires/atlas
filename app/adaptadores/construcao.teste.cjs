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
    raiz, home, modos: criarModo({ raiz }),
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
