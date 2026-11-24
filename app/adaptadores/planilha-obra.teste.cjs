// Planilha dentro da obra (X1–X3): raio-X guardado na obra, "o que entendi" pelo Claude, voz para responder e pedir mudança.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarPlanilhaObra } = require('./planilha-obra.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-plobra-'))
const CSV = 'Data;Descrição;Valor;Categoria\n01/11/2026;Cimento;R$ 1.234,56;Material\n02/11/2026;Frete;R$ 80,00;Transporte\n'
const ENTENDI = {
  resumo: 'Você controla o caixa da obra: cada gasto com data, valor e categoria.',
  entidades: [{ nome: 'Lançamentos', quantos: 2, campos: 'data, descrição, valor, categoria' }],
  relacoes: [],
  regras: ['Total do mês = soma dos valores'],
  relatorios: ['Gasto por categoria no mês'],
  perguntas: [{ pergunta: 'Quem lança os gastos?', porque: 'A planilha não diz se é você ou a equipe.' }],
  aparelho: { celular: 'lançar gasto na obra', computador: 'ver o resumo do mês' },
}

function montar(resposta = ENTENDI) {
  const raiz = tmp()
  fs.mkdirSync(path.join(raiz, 'caixa', 'planilha'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'caixa', 'planilha', 'caixa.csv'), CSV)
  const pedidos = []
  const disparo = { perguntar: async (pasta, pedido) => { pedidos.push({ pasta, pedido }); return JSON.stringify(typeof resposta === 'function' ? resposta(pedido) : resposta) } }
  return { raiz, pedidos, pl: criarPlanilhaObra({ raiz, disparo }) }
}

test('ler: faz o raio-X, guarda na obra (raio-x.json e .md) e devolve para a tela só o que ela mostra', async () => {
  const { raiz, pl } = montar()
  const v = await pl.ler('caixa', 'caixa.csv')
  assert.equal(v.arquivo, 'caixa.csv')
  assert.equal(v.abas[0].nome, 'caixa')
  assert.equal(v.abas[0].linhas, 2)
  assert.ok(v.abas[0].achados.some((a) => /Valor.*valor em R\$/.test(a)))
  assert.ok(fs.existsSync(path.join(raiz, 'caixa', 'planilha', 'raio-x.json')))
  assert.match(fs.readFileSync(path.join(raiz, 'caixa', 'planilha', 'raio-x.md'), 'utf8'), /Raio-X da planilha/)
  await assert.rejects(pl.ler('caixa', '../fora.csv'), /nome-invalido/)
})

test('entender: o Claude lê o raio-X da pasta da obra; a resposta é validada e guardada; texto do cliente vai como dado', async () => {
  const { raiz, pl, pedidos } = montar()
  await pl.ler('caixa', 'caixa.csv')
  const e = await pl.entender('caixa')
  assert.equal(pedidos[0].pasta, 'caixa')
  assert.match(pedidos[0].pedido, /planilha\/raio-x\.md/)
  assert.equal(e.entidades[0].nome, 'Lançamentos')
  assert.equal(e.perguntas.length, 1)
  assert.deepEqual(e.mudancas, [])
  assert.ok(fs.existsSync(path.join(raiz, 'caixa', 'planilha', 'entendimento.json')))
})

test('falar: responde as perguntas OU pede acréscimos e mudanças; o Atlas ajusta e diz o que mudou', async () => {
  const { pl, pedidos } = montar((pedido) => (/O CLIENTE FALOU/.test(pedido) ? { ...ENTENDI, perguntas: [], regras: [...ENTENDI.regras, 'Gasto acima de R$ 1.000 precisa da foto da nota'], mudancas: ['Novo: foto da nota fiscal nos gastos acima de R$ 1.000', 'Entendi: quem lança é a equipe'] } : ENTENDI))
  await pl.ler('caixa', 'caixa.csv')
  await pl.entender('caixa')
  const e = await pl.entender('caixa', 'Quem lança é a equipe. E quero foto da nota quando passar de mil reais.')
  assert.match(pedidos[1].pedido, /quero foto da nota/)
  assert.match(pedidos[1].pedido, /Entendimento atual/)
  assert.equal(e.perguntas.length, 0)
  assert.equal(e.mudancas.length, 2)
  // o que a pessoa falou fica guardado para a obra
  const r = pl.relato('caixa')
  assert.match(r, /Você controla o caixa da obra/)
  assert.match(r, /foto da nota quando passar de mil reais/)
  assert.match(r, /Raio-X da planilha/)
})

test('levar os dados: a escolha fica registrada na obra para a construção', async () => {
  const { raiz, pl } = montar()
  await pl.levarDados('caixa', true)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(raiz, 'caixa', 'planilha', 'importar.json'), 'utf8')).levar, true)
})

test('resposta estranha do Claude: falha calma, nada guardado', async () => {
  const { raiz, pl } = montar({ lixo: true })
  await pl.ler('caixa', 'caixa.csv')
  await assert.rejects(pl.entender('caixa'), /entendimento-invalido/)
  assert.ok(!fs.existsSync(path.join(raiz, 'caixa', 'planilha', 'entendimento.json')))
})
