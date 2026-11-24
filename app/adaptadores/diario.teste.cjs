// Teste do diário da obra (M41). "Tem que ser transparente 100% com o desenvolvimento do software" (Luiz, 24/11/2026).
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarDiario, MAX_LINHAS } = require('./diario.cjs')

function montar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-diario-'))
  let t = Date.UTC(2026, 10, 24, 12, 0)
  const d = criarDiario({ agora: () => new Date(t) })
  return { dir, d, passar: (ms) => { t += ms } }
}

test('registra com hora e tipo, e lê na ordem (o mais novo por último)', () => {
  const { dir, d, passar } = montar()
  d.registrar(dir, { tipo: 'info', texto: 'O Atlas começou a trabalhar na obra' })
  passar(60_000)
  d.registrar(dir, { tipo: 'parada', texto: 'Parou: a cota do Claude acabou. Volta às 15:40.' })
  const l = d.ler(dir)
  assert.equal(l.length, 2)
  assert.equal(l[0].texto, 'O Atlas começou a trabalhar na obra')
  assert.equal(l[1].tipo, 'parada')
  assert.equal(l[1].em, new Date(Date.UTC(2026, 10, 24, 12, 1)).toISOString())
  assert.ok(fs.existsSync(path.join(dir, '.atlas', 'diario.jsonl')))
})

test('o mesmo acontecimento seguido não se repete (o diário não vira barulho)', () => {
  const { dir, d, passar } = montar()
  d.registrar(dir, { tipo: 'trabalho', texto: 'Escrevendo o código' })
  passar(30_000)
  d.registrar(dir, { tipo: 'trabalho', texto: 'Escrevendo o código' })
  passar(30_000)
  d.registrar(dir, { tipo: 'trabalho', texto: 'Revisando o que foi feito' })
  passar(30_000)
  d.registrar(dir, { tipo: 'trabalho', texto: 'Escrevendo o código' })
  assert.deepEqual(d.ler(dir).map((x) => x.texto), ['Escrevendo o código', 'Revisando o que foi feito', 'Escrevendo o código'])
})

test('senha, chave e token nunca entram no diário (nem no detalhe)', () => {
  const { dir, d } = montar()
  d.registrar(dir, { tipo: 'parada', texto: 'Falhou com ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789 no push', detalhe: 'SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123 password=segredo123' })
  const bruto = fs.readFileSync(path.join(dir, '.atlas', 'diario.jsonl'), 'utf8')
  for (const s of ['ghp_AbCd', 'eyJhbGci', 'segredo123']) assert.ok(!bruto.includes(s), s)
  assert.match(d.ler(dir)[0].texto, /no push/)
})

test('texto vem limpo e curto; tipo desconhecido vira "info"', () => {
  const { dir, d } = montar()
  d.registrar(dir, { tipo: 'qualquer', texto: '**Parei**   no `M1`\n\n' + 'x'.repeat(500) })
  const [e] = d.ler(dir)
  assert.equal(e.tipo, 'info')
  assert.ok(!/[*`]/.test(e.texto))
  assert.ok(e.texto.length <= 240)
})

test('guarda no máximo MAX_LINHAS (as mais antigas saem) e ler(limite) devolve as últimas', () => {
  const { dir, d, passar } = montar()
  for (let i = 0; i < MAX_LINHAS + 25; i++) { d.registrar(dir, { tipo: 'info', texto: `evento ${i}` }); passar(1000) }
  const todas = d.ler(dir, 10_000)
  assert.equal(todas.length, MAX_LINHAS)
  assert.equal(todas.at(-1).texto, `evento ${MAX_LINHAS + 24}`)
  assert.deepEqual(d.ler(dir, 3).map((x) => x.texto), [`evento ${MAX_LINHAS + 22}`, `evento ${MAX_LINHAS + 23}`, `evento ${MAX_LINHAS + 24}`])
})

test('arquivo estragado ou ausente: lê o que der, nunca quebra', () => {
  const { dir, d } = montar()
  assert.deepEqual(d.ler(dir), [])
  fs.mkdirSync(path.join(dir, '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.atlas', 'diario.jsonl'), 'lixo\n{"em":"2026-11-24T12:00:00.000Z","tipo":"info","texto":"ok"}\n{quebrado')
  assert.deepEqual(d.ler(dir).map((x) => x.texto), ['ok'])
})
