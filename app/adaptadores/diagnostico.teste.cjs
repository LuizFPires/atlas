// Teste do diagnóstico da obra (M41, O4 aprovado pelo Luiz em 24/11/2026): quando o Atlas desiste de religar sozinho, ele mostra as
// 10 conferências que fez (✓ / ✗), em português simples, para ninguém ficar no escuro.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarDiagnostico } = require('./diagnostico.cjs')

function montar(o = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-diag-'))
  fs.mkdirSync(path.join(raiz, 'obra', '.atlas'), { recursive: true })
  const d = criarDiagnostico({
    raiz,
    internet: async () => o.internet ?? true,
    claudeEstado: async () => ({ conectado: o.claude ?? true }),
    contas: { situacao: async () => ({ github: { ligado: o.github ?? true }, hosp: { ligado: o.vercel ?? true }, supabase: { ligado: o.supabase ?? true } }) },
    kitDiretorio: () => (o.kit === false ? null : raiz),
    espacoLivre: () => o.espaco ?? 50e9,
    ...(o.lento ? { tempoMaxMs: 30 } : {}),
  })
  return { raiz, d }
}

test('tudo certo, menos o trabalho da etapa: 10 conferências, nesta ordem, com o motivo da linha no ✗', async () => {
  const { raiz, d } = montar()
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify({ estado: 'parou', motivo: 'erro', fala: '**O teste** da tela de relatórios falhou de novo.' }))
  const r = await d.diagnosticar('obra')
  assert.deepEqual(r.map((c) => c.nome), ['Internet', 'Claude ligado', 'Cota do Claude', 'GitHub', 'Supabase', 'Vercel', 'Pasta da obra', 'Instruções da obra', 'Espaço no disco', 'Trabalho da etapa'])
  assert.deepEqual(r.filter((c) => !c.ok).map((c) => c.nome), ['Trabalho da etapa'])
  assert.equal(r.at(-1).dica, 'O teste da tela de relatórios falhou de novo.')
})

test('cada falha vem com uma dica de leigo', async () => {
  const { d } = montar({ internet: false, claude: false, github: false, espaco: 200e6, kit: false })
  const r = await d.diagnosticar('obra')
  const ruim = Object.fromEntries(r.filter((c) => !c.ok).map((c) => [c.nome, c.dica]))
  assert.match(ruim.Internet, /internet/i)
  assert.match(ruim['Claude ligado'], /entre de novo/i)
  assert.match(ruim.GitHub, /Contas ligadas/)
  assert.match(ruim['Espaço no disco'], /espaço/i)
  assert.match(ruim['Instruções da obra'], /baixar/i)
})

test('cota acabada aparece como ✗ com a dica de que volta sozinha', async () => {
  const { raiz, d } = montar()
  fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify({ estado: 'parou', motivo: 'cota' }))
  const c = (await d.diagnosticar('obra')).find((x) => x.nome === 'Cota do Claude')
  assert.equal(c.ok, false)
  assert.match(c.dica, /volta sozinha/)
})

test('uma conferência que trava ou quebra não derruba as outras', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-diag-'))
  fs.mkdirSync(path.join(raiz, 'obra'))
  const d = criarDiagnostico({ raiz, internet: () => new Promise(() => {}), claudeEstado: async () => { throw new Error('x') }, contas: { situacao: async () => { throw new Error('y') } }, kitDiretorio: () => raiz, espacoLivre: () => 50e9, tempoMaxMs: 30 })
  const r = await d.diagnosticar('obra')
  assert.equal(r.length, 10)
  assert.equal(r.find((c) => c.nome === 'Internet').ok, false)
  assert.equal(r.find((c) => c.nome === 'Pasta da obra').ok, true)
})
