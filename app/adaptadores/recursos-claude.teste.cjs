// Teste dos recursos do Claude Code instalado (node --test app/adaptadores/recursos-claude.teste.cjs).
// Economia de tokens (Luiz, 24/11/2026: "fazer mais com menos", sem perder qualidade): só liga as opções que o Claude do cliente conhece.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { criarRecursosClaude, argsEnxutos, argsEsforco } = require('./recursos-claude.cjs')

const AJUDA = `Usage: claude [options]
  --tools <tools...>                    Built-in tools to make available
  --effort <level>                      Effort level for the current session
  --exclude-dynamic-system-prompt-sections
      Move per-machine sections ...`

test('lê o --help uma vez e guarda o que o Claude instalado aceita', async () => {
  let chamadas = 0
  const r = criarRecursosClaude({ executar: async (args) => { chamadas++; assert.deepEqual(args, ['--help']); return { codigo: 0, saida: AJUDA } }, resolver: () => ({ cmd: 'x' }) })
  assert.equal(r.tem('--tools'), false) // antes de carregar: nada (nunca arrisca uma opção desconhecida)
  await r.carregar(); await r.carregar()
  assert.equal(chamadas, 1)
  assert.equal(r.tem('--tools'), true)
  assert.equal(r.tem('--effort'), true)
  assert.equal(r.tem('--exclude-dynamic-system-prompt-sections'), true)
  assert.equal(r.tem('--bare'), false)
})

test('Claude antigo, sem as opções, ou --help que falha: nada muda nos argumentos', async () => {
  const velho = criarRecursosClaude({ executar: async () => ({ codigo: 0, saida: 'Usage: claude\n  --model <model>' }), resolver: () => ({ cmd: 'x' }) })
  await velho.carregar()
  assert.deepEqual(argsEnxutos(velho, 'Read,Glob,Grep'), [])
  assert.deepEqual(argsEsforco(velho, 'medium'), [])
  const quebrado = criarRecursosClaude({ executar: async () => { throw new Error('x') }, resolver: () => ({ cmd: 'x' }) })
  await quebrado.carregar()
  assert.deepEqual(argsEnxutos(quebrado, ''), [])
})

test('com as opções: só as ferramentas pedidas vão para o Claude e o pedaço que muda sai do começo (o resto fica no cache)', async () => {
  const r = criarRecursosClaude({ executar: async () => ({ codigo: 0, saida: AJUDA }), resolver: () => ({ cmd: 'x' }) })
  await r.carregar()
  assert.deepEqual(argsEnxutos(r, 'Read,Glob,Grep'), ['--tools', 'Read,Glob,Grep', '--exclude-dynamic-system-prompt-sections'])
  assert.deepEqual(argsEnxutos(r, ''), ['--tools', '', '--exclude-dynamic-system-prompt-sections'])
  assert.deepEqual(argsEnxutos(r, null), ['--exclude-dynamic-system-prompt-sections'])
  assert.deepEqual(argsEsforco(r, 'medium'), ['--effort', 'medium'])
  assert.deepEqual(argsEsforco(r, 'qualquer'), [])
})

test('disparo (protótipo, estilo, nomes, Ajuda): com obra só Read/Glob/Grep vão ao Claude; sem obra, nenhuma ferramenta', async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
  const { criarDisparo } = require('./projeto-comum.cjs')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rec-')); fs.mkdirSync(path.join(raiz, 'obra'))
  const recursos = criarRecursosClaude({ executar: async () => ({ codigo: 0, saida: AJUDA }), resolver: () => ({ cmd: 'x' }) })
  await recursos.carregar()
  const chamadas = []
  const d = criarDisparo({ raiz, dadosApp: fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rec-')), claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }), recursos,
    executar: async (args) => { chamadas.push(args); return { codigo: 0, saida: JSON.stringify({ result: 'ok' }) } } })
  await d.perguntar('obra', 'oi')
  await d.perguntar(null, 'oi')
  const v = (a, f) => a[a.indexOf(f) + 1]
  assert.equal(v(chamadas[0], '--tools'), 'Read,Glob,Grep')
  assert.equal(v(chamadas[1], '--tools'), '')
  assert.ok(chamadas[0].includes('--exclude-dynamic-system-prompt-sections'))
})

test('linha da obra: a parte que muda sai do começo (cache entre religadas); o plano da obra só leva Read/Glob/Grep; o teste de cota, nenhuma ferramenta', async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
  const { criarConstrucao } = require('./construcao.cjs')
  const { criarModo } = require('./modo.cjs')
  const recursos = criarRecursosClaude({ executar: async () => ({ codigo: 0, saida: AJUDA }), resolver: () => ({ cmd: 'x' }) })
  await recursos.carregar()
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rec-')); fs.mkdirSync(path.join(raiz, 'obra'))
  const fluxo = [], execs = []
  const c = criarConstrucao({ raiz, home: fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rec-')), dadosApp: fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rec-')), modos: criarModo({ raiz }), recursos,
    claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }),
    executar: async (args) => { execs.push(args); return { codigo: 0, saida: JSON.stringify({ result: '1. Base | entrada' }) } },
    iniciarFluxo: (args) => { fluxo.push(args); return { parar: () => {}, fim: new Promise(() => {}) } } })
  await c.planejar('obra', 'Barbearia').catch(() => {}) // só os argumentos importam aqui
  assert.equal(execs[0][execs[0].indexOf('--tools') + 1], 'Read,Glob,Grep')
  await c.iniciar('obra', 'Barbearia', 'automatico', [{ n: 'M1', nome: 'Base', desc: 'x' }])
  assert.ok(fluxo[0].includes('--exclude-dynamic-system-prompt-sections'))
  assert.ok(!fluxo[0].includes('--tools'), 'a linha usa as ferramentas padrão (subagentes, skills)')
  assert.ok(!fluxo[0].includes('--effort'), 'o esforço da linha não muda (vale para os subagentes também)')
  const { criarCota } = require('./cota.cjs')
  const testes = []
  const cota = criarCota({ raiz, construcao: { linha: { rodando: () => false } }, painel: { ler: async () => ({}) }, claudeEstado: async () => ({ conectado: true }), dadosApp: fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rec-')), recursos,
    executar: async (args) => { testes.push(args); return { codigo: 0, saida: JSON.stringify({ type: 'result', is_error: false, result: 'ok' }) } }, resolver: () => ({ cmd: 'x' }) })
  fs.mkdirSync(path.join(raiz, 'obra', '.atlas'), { recursive: true }); fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify({ estado: 'parou', motivo: 'cota' }))
  c.encerrar()
  await cota.ler('obra')
  assert.equal(testes[0][testes[0].indexOf('--tools') + 1], '')
})

test('medição: todo pedido com obra (protótipo, Ajuda, estilo…) deixa os números de consumo na obra, com o tipo, sem o texto', async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
  const { criarDisparo } = require('./projeto-comum.cjs')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rec-')); fs.mkdirSync(path.join(raiz, 'obra'))
  const d = criarDisparo({ raiz, dadosApp: fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rec-')), claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }),
    executar: async () => ({ codigo: 0, saida: JSON.stringify({ type: 'result', is_error: false, result: 'texto secreto', num_turns: 3, total_cost_usd: 0.12, usage: { output_tokens: 900 } }) }) })
  await d.perguntar('obra', 'oi', { tipo: 'protótipo · lote' })
  const l = fs.readFileSync(path.join(raiz, 'obra', '.atlas', 'consumo.jsonl'), 'utf8')
  const j = JSON.parse(l.trim())
  assert.equal(j.tipo, 'protótipo · lote')
  assert.equal(j.saida, 900)
  assert.doesNotMatch(l, /secreto/)
})
