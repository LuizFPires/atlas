'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarObras } = require('./obras.cjs')

const montar = () => { const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-obras-')); return { raiz, o: criarObras({ raiz }) } }
const gravar = (raiz, ...partes) => { const c = path.join(raiz, ...partes); fs.mkdirSync(path.dirname(c), { recursive: true }); fs.writeFileSync(c, 'x') }

test('situação da obra: lê só o que cada etapa deixou na pasta', async () => {
  const { raiz, o } = montar()
  fs.mkdirSync(path.join(raiz, 'so-nome'))
  assert.deepEqual(await o.situacao('so-nome'), { estilo: false, prototipo: false, marca: false, plano: false })
  gravar(raiz, 'meio', 'design-system.md'); gravar(raiz, 'meio', 'prototipo', 'versoes', 'v001', 'versao.json')
  assert.deepEqual(await o.situacao('meio'), { estilo: true, prototipo: true, marca: false, plano: false })
  gravar(raiz, 'quase', 'design-system-2.md'); gravar(raiz, 'quase', 'prototipo', 'versoes', 'v001', 'versao.json'); gravar(raiz, 'quase', 'marca', 'marca.md')
  assert.deepEqual(await o.situacao('quase'), { estilo: true, prototipo: true, marca: true, plano: false })
  gravar(raiz, 'obra', 'PLAN.md')
  assert.equal((await o.situacao('obra')).plano, true)
})

test('situação: pasta vazia de versões não conta como protótipo; pasta fora da raiz é recusada', async () => {
  const { raiz, o } = montar()
  fs.mkdirSync(path.join(raiz, 'a', 'prototipo', 'versoes'), { recursive: true })
  assert.equal((await o.situacao('a')).prototipo, false)
  await assert.rejects(() => o.situacao('../fora'))
  await assert.rejects(() => o.situacao('nao-existe'))
})

test('excluir obra (Luiz, 23/11/2026): só em andamento; para a construção e manda a pasta para a Lixeira', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-obras-'))
  const lixo = []
  const paradas = []
  const o = criarObras({ raiz, shell: { trashItem: async (p) => { lixo.push(p); fs.rmSync(p, { recursive: true }) } }, pararLinha: (p) => paradas.push(p) })
  fs.mkdirSync(path.join(raiz, 'meio'))
  fs.writeFileSync(path.join(raiz, 'meio', 'PLAN.md'), '## Milestone 1\n- [x] a\n- [ ] b\n')
  fs.mkdirSync(path.join(raiz, 'pronta'))
  fs.writeFileSync(path.join(raiz, 'pronta', 'PLAN.md'), '## Milestone 1\n- [x] a\n- [x] b\n')
  fs.mkdirSync(path.join(raiz, 'so-ideia'))
  await o.excluir('meio')
  await o.excluir('so-ideia')
  assert.deepEqual(paradas, ['meio', 'so-ideia'])
  assert.deepEqual(lixo.map((p) => path.basename(p)), ['meio', 'so-ideia'])
  await assert.rejects(o.excluir('pronta'), /obra-concluida/)
  assert.ok(fs.existsSync(path.join(raiz, 'pronta')))
  await assert.rejects(o.excluir('../fora'), /./)
  await assert.rejects(o.excluir('nao-existe'), /obra-inexistente/)
})

test('situação: obra no ar traz o endereço e o dia (o domínio próprio no ar vence o .vercel.app)', async () => {
  const { raiz, o } = montar()
  const escrever = (pasta, arq, obj) => { const c = path.join(raiz, pasta, '.atlas', arq); fs.mkdirSync(path.dirname(c), { recursive: true }); fs.writeFileSync(c, JSON.stringify(obj)) }
  fs.mkdirSync(path.join(raiz, 'sem'))
  assert.equal((await o.situacao('sem')).noAr, undefined)
  escrever('padaria', 'no-ar.json', { nome: 'padaria', endereco: 'padaria-sol.vercel.app', quando: '2026-10-28T12:00:00.000Z' })
  assert.deepEqual((await o.situacao('padaria')).noAr, { endereco: 'padaria-sol.vercel.app', quando: '2026-10-28T12:00:00.000Z' })
  escrever('padaria', 'dominio.json', { dominio: 'padariasol.app.br', fase: 'esperando' })
  assert.equal((await o.situacao('padaria')).noAr.endereco, 'padaria-sol.vercel.app')
  escrever('padaria', 'dominio.json', { dominio: 'padariasol.app.br', fase: 'noar' })
  assert.equal((await o.situacao('padaria')).noAr.endereco, 'padariasol.app.br')
  escrever('lixo', 'no-ar.json', { endereco: '<script>' })
  assert.equal((await o.situacao('lixo')).noAr, undefined)
})

// Luiz, 26/11/2026: obra que recebeu um protótipo de outra IA (telas em prototipo/telas, ainda sem versão) continua nas telas.
test('situação: protótipo trazido de outra IA (prototipo/telas/*.html) conta como protótipo', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'obras-'))
  fs.mkdirSync(path.join(raiz, 'seu-lino', 'prototipo', 'telas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'seu-lino', 'prototipo', 'telas', '01-inicio.html'), '<h1>oi</h1>')
  const o = criarObras({ raiz })
  assert.equal((await o.situacao('seu-lino')).prototipo, true)
})

test('listar: pastas escondidas (ex.: o .git guardado durante a publicação) não viram obra', async () => {
  const { raiz, o } = montar()
  fs.mkdirSync(path.join(raiz, 'ponto'))
  fs.mkdirSync(path.join(raiz, '.atlas-git-pausa-ponto'))
  assert.deepEqual(await o.listar(), ['ponto'])
})
