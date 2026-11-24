// Ações das fichas de trava (T1Travas): site fixo de cada trava e "deixar público até o GitHub voltar", com volta sozinha.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarTravasAcoes, SITE_DA_TRAVA } = require('./travas-acoes.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-travas-'))
const livro = (raiz, ocorrencias) => { fs.mkdirSync(path.join(raiz, 'obra', 'docs'), { recursive: true }); fs.writeFileSync(path.join(raiz, 'obra', 'docs', 'ocorrencias.json'), JSON.stringify({ proximo_id: 9, ocorrencias })) }
const minutos = { id: 1, status: 'aberta', servico: 'GitHub', motivo: 'minutos do GitHub Actions acabaram (billing)', acao: 'x', bloqueia: [], tentativas: [] }

function montar() {
  const raiz = tmp()
  fs.mkdirSync(path.join(raiz, 'obra'))
  const chamadas = []
  const acoes = criarTravasAcoes({ raiz, rodarGh: async (args, cwd) => { chamadas.push({ args, cwd }); return { codigo: 0, saida: '' } } })
  return { raiz, chamadas, acoes }
}

test('site de cada trava é fixo e oficial', () => {
  assert.equal(SITE_DA_TRAVA['supabase-dormindo'], 'https://supabase.com/dashboard/projects')
  for (const u of Object.values(SITE_DA_TRAVA)) assert.match(u, /^https:\/\/(github\.com|vercel\.com|supabase\.com)\//)
})

test('deixar público só com a trava do GitHub aberta; volta para privado sozinho quando o GitHub libera', async () => {
  const { raiz, chamadas, acoes } = montar()
  await assert.rejects(acoes.deixarPublico('obra'), /sem-trava/)
  livro(raiz, [minutos])
  await acoes.deixarPublico('obra')
  assert.deepEqual(chamadas[0].args, ['repo', 'edit', '--visibility', 'public', '--accept-visibility-change-consequences'])
  assert.equal(chamadas[0].cwd, path.join(raiz, 'obra'))
  assert.equal(acoes.publico('obra'), true)
  await acoes.revisar(['obra']) // trava ainda aberta: continua público
  assert.equal(chamadas.length, 1)
  livro(raiz, [{ ...minutos, status: 'resolvida' }])
  await acoes.revisar(['obra'])
  assert.deepEqual(chamadas[1].args, ['repo', 'edit', '--visibility', 'private', '--accept-visibility-change-consequences'])
  assert.equal(acoes.publico('obra'), false)
})

test('se voltar para privado falhar, tenta de novo na próxima revisão (nunca esquece)', async () => {
  const raiz = tmp(); fs.mkdirSync(path.join(raiz, 'obra'))
  let falhar = false
  const chamadas = []
  const acoes = criarTravasAcoes({ raiz, rodarGh: async (args) => { chamadas.push(args); return { codigo: falhar ? 1 : 0, saida: '' } } })
  livro(raiz, [minutos])
  await acoes.deixarPublico('obra')
  livro(raiz, [])
  falhar = true
  await acoes.revisar(['obra'])
  assert.equal(acoes.publico('obra'), true)
  falhar = false
  await acoes.revisar(['obra'])
  assert.equal(acoes.publico('obra'), false)
})
