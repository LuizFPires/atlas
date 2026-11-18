// Teste do adaptador do celular (node --test app/adaptadores/*.teste.cjs). Sem Electron nem Claude.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarCelular, validarPrefs, ENDERECO_APP, HOSTS_CLAUDE } = require('./celular.cjs')

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cel-')), 'celular')
const PREFS = { frequencia: '3h', avisos: { precisa: true, etapa: false, fim: true } }

test('enderecoApp é fixo, https e de host oficial do Claude', () => {
  const c = criarCelular({ dados: tmp() })
  assert.equal(c.enderecoApp(), 'https://claude.ai/download')
  assert.equal(new URL(ENDERECO_APP).protocol, 'https:')
  assert.ok(HOSTS_CLAUDE.includes(new URL(ENDERECO_APP).hostname))
  assert.ok(!HOSTS_CLAUDE.includes('github.com'))
})

test('aplicar guarda as preferências mas NÃO finge conexão: rejeita enquanto o celular não está ligado', async () => {
  const dados = tmp()
  const c = criarCelular({ dados, agora: () => new Date('2026-11-18T12:00:00Z') })
  await assert.rejects(c.aplicar(PREFS), /celular-nao-conectado/)
  const gravado = JSON.parse(fs.readFileSync(path.join(dados, 'prefs.json'), 'utf8'))
  assert.equal(gravado.frequencia, '3h')
  assert.deepEqual(gravado.avisos, PREFS.avisos)
  assert.deepEqual(c.prefsAtuais(), PREFS)
})

test('aplicar resolve só com conexão confirmada (e erro na checagem conta como não conectado)', async () => {
  await criarCelular({ dados: tmp(), conexao: async () => true }).aplicar(PREFS)
  await assert.rejects(criarCelular({ dados: tmp(), conexao: async () => 'sim' }).aplicar(PREFS), /celular-nao-conectado/)
  await assert.rejects(criarCelular({ dados: tmp(), conexao: async () => { throw new Error('x') } }).aplicar(PREFS), /celular-nao-conectado/)
})

test('prefs inválidas são recusadas ANTES de gravar qualquer coisa', async () => {
  const dados = tmp()
  const c = criarCelular({ dados })
  for (const ruim of [null, {}, { frequencia: '5m', avisos: PREFS.avisos }, { frequencia: '1h' }, { frequencia: '1h', avisos: { precisa: 'sim', etapa: true, fim: true } }, { frequencia: '1h', avisos: { precisa: true, etapa: true } }, 'x']) {
    await assert.rejects(c.aplicar(ruim), /prefs-invalidas/)
  }
  assert.ok(!fs.existsSync(path.join(dados, 'prefs.json')))
})

test('validarPrefs descarta campos extras (nada de segredo ou lixo vai para o arquivo)', () => {
  const v = validarPrefs({ ...PREFS, token: 'segredo', avisos: { ...PREFS.avisos, extra: true } })
  assert.deepEqual(Object.keys(v).sort(), ['avisos', 'frequencia'])
  assert.deepEqual(Object.keys(v.avisos).sort(), ['etapa', 'fim', 'precisa'])
})

test('prefsAtuais sem arquivo ou com arquivo estragado volta ao padrão', () => {
  const dados = tmp()
  const c = criarCelular({ dados })
  assert.equal(c.prefsAtuais().frequencia, '1h')
  fs.mkdirSync(dados, { recursive: true })
  fs.writeFileSync(path.join(dados, 'prefs.json'), '{lixo')
  assert.equal(c.prefsAtuais().frequencia, '1h')
})
