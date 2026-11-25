'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarPolitica, sinaisNoCodigo, politicaDoJson } = require('./politica.cjs')

function obra(arquivos = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'pol-'))
  const cwd = path.join(raiz, 'tarefas')
  for (const [rel, txt] of Object.entries(arquivos)) { fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true }); fs.writeFileSync(path.join(cwd, rel), txt) }
  fs.mkdirSync(cwd, { recursive: true })
  return { raiz, cwd }
}

test('chatbot com IA não é sinal (SDK comum da Anthropic/OpenAI)', () => {
  const { cwd } = obra({ 'package.json': JSON.stringify({ dependencies: { '@anthropic-ai/sdk': '1', openai: '4', react: '19' } }), 'src/chat.ts': 'import Anthropic from "@anthropic-ai/sdk"\nconst r = await c.messages.create({})' })
  assert.deepEqual(sinaisNoCodigo(cwd), [])
})

test('agente que programa é sinal: pacote, CLI do Claude não interativo ou Agent SDK', () => {
  assert.ok(sinaisNoCodigo(obra({ 'package.json': JSON.stringify({ dependencies: { '@anthropic-ai/claude-agent-sdk': '1' } }) }).cwd).length > 0)
  assert.ok(sinaisNoCodigo(obra({ 'src/linha.ts': "spawn('claude', ['-p', '--permission-mode', 'acceptEdits'])" }).cwd).length > 0)
  assert.ok(sinaisNoCodigo(obra({ 'supabase/functions/x/index.ts': 'import { query } from "@anthropic-ai/claude-agent-sdk"' }).cwd).length > 0)
  assert.deepEqual(sinaisNoCodigo(obra({ 'docs/notas.md': "claude -p --permission-mode" }).cwd), [], 'documentação não conta, só código')
})

test('politicaDoJson: na dúvida não bloqueia', () => {
  assert.deepEqual(politicaDoJson({}), { bloqueia: false, sinais: [] })
  assert.deepEqual(politicaDoJson({ politica: { bloqueia: 'sim' } }), { bloqueia: false, sinais: [] })
  assert.equal(politicaDoJson({ politica: { bloqueia: true, sinais: ['Agentes constroem apps'] } }).sinais[0], 'Agentes constroem apps')
})

function servidor(resposta) {
  const vistos = []
  const buscar = async (url, o) => { vistos.push({ url, corpo: JSON.parse(o.body), cab: o.headers }); return { ok: true, json: async () => resposta(url) } }
  return { vistos, buscar }
}
const cofre = { ler: async () => JSON.stringify({ token: 'tok', email: 'ana@loja.com' }) }

test('conferirCodigo: registra no servidor e recusa; embargada vira obra-embargada', async () => {
  const { raiz } = obra({ 'package.json': JSON.stringify({ dependencies: { '@anthropic-ai/claude-code': '2' } }) })
  const s = servidor(() => ({ situacao: 'embargada' }))
  const p = criarPolitica({ raiz, cofre, hashComputador: async () => 'h', api: 'https://api.atlas.test', buscar: s.buscar })
  await assert.rejects(p.conferirCodigo('tarefas'), /obra-embargada/)
  assert.equal(s.vistos[0].url, 'https://api.atlas.test/politica/registrar')
  assert.equal(s.vistos[0].corpo.onde, 'codigo')
  assert.equal(s.vistos[0].cab['X-Atlas-Dispositivo'], 'tok')
})

test('conferirCodigo: obra limpa passa sem chamar o servidor', async () => {
  const { raiz } = obra({ 'package.json': '{"dependencies":{"react":"19"}}' })
  const s = servidor(() => ({}))
  const p = criarPolitica({ raiz, cofre, hashComputador: async () => 'h', api: 'https://api.atlas.test', buscar: s.buscar })
  assert.deepEqual(await p.conferirCodigo('tarefas'), [])
  assert.equal(s.vistos.length, 0)
})

test('servidor fora: registrar devolve null, mas o bloqueio do código continua', async () => {
  const { raiz } = obra({ 'package.json': JSON.stringify({ dependencies: { '@anthropic-ai/claude-code': '2' } }) })
  const p = criarPolitica({ raiz, cofre, hashComputador: async () => 'h', api: null })
  assert.equal(await p.registrar('tarefas', 'ideia', 'x'), null)
  await assert.rejects(p.conferirCodigo('tarefas'), /politica-bloqueado/)
})

const { criarPosObra } = require('./posobra.cjs')
const { criarIdeia } = require('./ideia.cjs')

test('pós-obra: o Claude bloqueia pela política -> registra no servidor e executar recusa', async () => {
  const { raiz } = obra({ 'PLAN.md': '# PLAN\n' })
  const registros = []
  const politica = { registrar: async (...a) => { registros.push(a); return 'embargada' } }
  const disparo = { perguntar: async () => '{"entendi":"","passos":[],"minutos":0,"politica":{"bloqueia":true,"sinais":["Agentes que programam"]}}', claudePronto: async () => {} }
  const p = criarPosObra({ raiz, disparo, construcao: { linha: { rodando: () => false, religar: () => {} } }, licenca: { verificar: async () => ({ ok: true }) }, politica })
  const r = await p.entender('tarefas', { tipo: 'mudar', texto: 'quero agentes de IA que programam e abrem no GitHub' })
  assert.equal(r.politica.bloqueia, true)
  assert.equal(r.politica.situacao, 'embargada')
  assert.deepEqual(registros[0].slice(0, 2), ['tarefas', 'posobra'])
  await assert.rejects(p.executar('tarefas', { tipo: 'mudar', texto: 'x' }, { entendi: 'Você quer', passos: ['a'], minutos: 5 }), /politica-bloqueado/)
})

test('ideia: no fim o mesmo Claude diz se bloqueia (sem chamada a mais)', async () => {
  let chamadas = 0
  const disparo = { perguntar: async (_p, pedido) => { chamadas++; assert.match(pedido, /POLÍTICA DO ATLAS/); return '{"cobertos":[],"faltam":[],"titulo":"Fábrica de apps","politica":{"bloqueia":true,"sinais":["Robôs constroem o app"]}}' } }
  const r = await criarIdeia({ disparo }).conferir('plataforma onde robôs constroem apps de clientes', { fim: true })
  assert.equal(chamadas, 1)
  assert.deepEqual(r.politica, { bloqueia: true, sinais: ['Robôs constroem o app'] })
})
