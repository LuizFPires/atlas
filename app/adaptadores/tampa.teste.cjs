// Aviso da tampa (prototipo/caminho-novo/TP1Tampa): "o notebook é o canteiro".
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarTampa, valorAtualCa } = require('./tampa.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-tampa-'))
const SAIDA_PT = `GUID do Esquema de Energia: 381b4222-f694-41f0-9685-ff5bb260df2e  (Equilibrado)
  GUID do Subgrupo: 4f971e89-eebd-4455-a8de-9e59040e7347  (Botões de energia e tampa)
    GUID da Configuração de Energia: 5ca83367-6e45-459f-a27b-476b1d01c936  (Ação de fechamento da tampa)
      Índice de Configuração Possível: 000
      Nome Amigável da Configuração Possível: Não fazer nada
      Índice de Configuração Possível: 001
      Nome Amigável da Configuração Possível: Suspender
    Índice de Configuração de Energia de CA Atual: 0x00000001
    Índice de Configuração de Energia de CC Atual: 0x00000001
`

test('lê o valor atual na tomada, em qualquer idioma do Windows', () => {
  assert.equal(valorAtualCa(SAIDA_PT), 1)
  assert.equal(valorAtualCa(SAIDA_PT.replace(/Índice.*CA Atual/, 'Current AC Power Setting Index').replace(/0x00000001\n    Índice/, '0x00000003\n    Índice')), 3)
  assert.equal(valorAtualCa('nada'), null)
})

function montar(saida = SAIDA_PT) {
  const dados = tmp()
  const chamadas = []
  const t = criarTampa({ dadosApp: dados, plataforma: 'win32', rodar: async (args) => { chamadas.push(args.join(' ')); return { codigo: 0, saida: args[0] === '/q' ? saida : '' } } })
  return { dados, chamadas, t }
}

test('ajustar: guarda o valor de antes, põe "não fazer nada" só na tomada e ativa; ajustar de novo não perde o valor original', async () => {
  const { dados, chamadas, t } = montar()
  assert.deepEqual(await t.ajustar(), { ok: true })
  assert.ok(chamadas.includes('/setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0'))
  assert.ok(!chamadas.some((c) => c.includes('setdcvalueindex'))) // na bateria continua dormindo
  assert.ok(chamadas.includes('/setactive SCHEME_CURRENT'))
  assert.equal(JSON.parse(fs.readFileSync(path.join(dados, 'tampa.json'), 'utf8')).antes, 1)
  assert.equal(t.ajustada(), true)
  const { t: t2 } = { t: criarTampa({ dadosApp: dados, plataforma: 'win32', rodar: async (a) => ({ codigo: 0, saida: a[0] === '/q' ? SAIDA_PT.replace(/0x00000001\n    Índice de Configuração de Energia de CC/, '0x00000000\n    Índice de Configuração de Energia de CC') : '' }) }) }
  await t2.ajustar()
  assert.equal(JSON.parse(fs.readFileSync(path.join(dados, 'tampa.json'), 'utf8')).antes, 1)
})

test('restaurar: volta o valor de antes e esquece; sem ajuste, não mexe em nada', async () => {
  const { chamadas, t } = montar()
  await t.restaurar()
  assert.equal(chamadas.length, 0)
  await t.ajustar()
  await t.restaurar()
  assert.ok(chamadas.includes('/setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 1'))
  assert.equal(t.ajustada(), false)
})

test('fora do Windows ou falha do powercfg: diz que não deu, sem fingir', async () => {
  const t = criarTampa({ dadosApp: tmp(), plataforma: 'darwin', rodar: async () => ({ codigo: 0, saida: '' }) })
  assert.deepEqual(await t.ajustar(), { ok: false, motivo: 'so-windows' })
  const { t: t2 } = { t: criarTampa({ dadosApp: tmp(), plataforma: 'win32', rodar: async () => ({ codigo: 1, saida: '' }) }) }
  assert.deepEqual(await t2.ajustar(), { ok: false, motivo: 'nao-deu' })
  assert.equal(t2.ajustada(), false)
})
