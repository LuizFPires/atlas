'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarIdeia, TOPICOS } = require('./ideia.cjs')
const { criarDisparo } = require('./projeto-comum.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-ideia-'))
function montar(resposta) {
  const chamadas = []
  const executar = async (args, o) => { chamadas.push({ args, o }); return { codigo: 0, saida: JSON.stringify({ result: typeof resposta === 'string' ? resposta : JSON.stringify(resposta) }), erro: '' } }
  const disparo = criarDisparo({ raiz: tmp(), dadosApp: tmp(), claudeEstado: async () => ({ conectado: true }), executar, resolver: () => ({ cmd: 'x' }), modelo: () => ['--model', 'claude-haiku-5-5'] })
  return { chamadas, ideia: criarIdeia({ disparo }) }
}

// Caminho novo (Luiz, 23/11/2026): o roteiro à esquerda fica verde conforme a pessoa fala; no fim, o Atlas pergunta só o que faltou.
test('o roteiro tem 7 tópicos, na ordem combinada', () => {
  assert.deepEqual(TOPICOS.map((t) => t.id), ['problema', 'quem', 'primeiro', 'essencial', 'informacoes', 'hoje', 'mais'])
})

test('conferir devolve os tópicos já respondidos e um resumo curto de cada um, sem pasta e com o modelo rápido', async () => {
  const { chamadas, ideia } = montar({ cobertos: [{ id: 'problema', resumo: 'Ponto da equipe no papel.' }, { id: 'quem', resumo: 'Pedreiros pelo celular.' }], faltam: [] })
  const r = await ideia.conferir('hoje o ponto é no papel, os pedreiros vão usar pelo celular')
  assert.deepEqual(r.cobertos, [{ id: 'problema', resumo: 'Ponto da equipe no papel.' }, { id: 'quem', resumo: 'Pedreiros pelo celular.' }])
  assert.ok(chamadas[0].args.includes('claude-haiku-5-5'))
  assert.match(String(chamadas[0].o.entrada), /ponto é no papel/)
  assert.ok(!chamadas[0].args.includes('--allowedTools'), 'sem pasta: o Claude não lê arquivo nenhum')
})

test('no fim, devolve no máximo 3 perguntas do que faltou, cada uma com o porquê', async () => {
  const faltam = Array.from({ length: 5 }, (_, i) => ({ pergunta: `P${i}?`, porque: `porque ${i}` }))
  const { ideia } = montar({ cobertos: [], faltam })
  const r = await ideia.conferir('x', { fim: true })
  assert.equal(r.faltam.length, 3)
  assert.deepEqual(r.faltam[0], { pergunta: 'P0?', porque: 'porque 0' })
})

test('resposta estranha é limpa: tópico desconhecido some, texto comprido é cortado, repetido conta uma vez', async () => {
  const { ideia } = montar({ cobertos: [{ id: 'inventado', resumo: 'x' }, { id: 'quem', resumo: 'y'.repeat(500) }, { id: 'quem', resumo: 'de novo' }], faltam: 'nada' })
  const r = await ideia.conferir('x')
  assert.deepEqual(r.cobertos.map((c) => c.id), ['quem'])
  assert.ok(r.cobertos[0].resumo.length <= 120)
  assert.deepEqual(r.faltam, [])
})

test('relato vazio não chama o Claude', async () => {
  const { chamadas, ideia } = montar({ cobertos: [], faltam: [] })
  assert.deepEqual(await ideia.conferir('   '), { cobertos: [], faltam: [] })
  assert.equal(chamadas.length, 0)
})

test('no fim, sugere um título curto para a obra (vira o nome da pasta; o nome de verdade vem depois)', async () => {
  const { ideia } = montar({ cobertos: [], faltam: [], titulo: 'Controle de ponto das obras e mais um monte de palavras que sobram' })
  const r = await ideia.conferir('x', { fim: true })
  assert.ok(r.titulo.length <= 40)
  assert.match(r.titulo, /^Controle de ponto/)
  const { ideia: i2 } = montar({ cobertos: [], faltam: [] })
  assert.equal((await i2.conferir('x', { fim: true })).titulo, '')
  assert.equal((await i2.conferir('x')).titulo, undefined, 'só no fim')
})
