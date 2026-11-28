'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarTestarIdeia, sortearAgentes, contas, textoDoPrototipo, limparReacao, FIXOS } = require('./testar-ideia.cjs')

// Luiz, 28/11/2026 (protótipo TI1TestarIdeia aprovado): "cada agente tem que ser uma persona diferente realmente"; "deixar claro
// no relatório que isso são agentes de IA, não pessoas reais … um termômetro".
function obra() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-'))
  const cwd = path.join(raiz, 'ponto')
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true })
  fs.mkdirSync(path.join(cwd, 'prototipo'), { recursive: true })
  fs.writeFileSync(path.join(cwd, 'docs', 'briefing.md'), '# Ponto\nControle de ponto da equipe de obra pelo celular. R$ 49 por mês.')
  fs.writeFileSync(path.join(cwd, 'prototipo', '02BaterPonto.dc.html'), '<html><style>x{}</style><body><h1>Bater ponto</h1><script>alert(1)</script><button>Bater</button></body></html>')
  return { raiz, cwd }
}

const ENTENDER = JSON.stringify({ produto: { nome: 'Ponto', oQueE: 'Ponto da equipe pelo celular', paraQuem: 'construtoras', preco: 49, telas: ['Bater ponto', 'Minhas horas'] }, eixos: { 'Profissão': ['Mestre de obras', 'Dono', 'RH', 'Pedreiro'], Cidade: ['Capital', 'Interior', 'Metrópole'], 'Tamanho do negócio': ['Até 5', '6 a 20', '21 a 80'], 'O que usa hoje': ['Caderno', 'Planilha', 'Outro app'] } })

function disparoFalso({ cotaNaChamada = null, perde = new Set() } = {}) {
  let chamadas = 0
  const pedidos = []
  return {
    pedidos,
    get chamadas() { return chamadas },
    async perguntar(pasta, pedido) {
      chamadas++
      pedidos.push(pedido)
      assert.equal(pasta, null)
      if (cotaNaChamada === chamadas) throw new Error('claude-cota')
      if (pedido.includes('"eixos"')) return ENTENDER
      if (pedido.includes('PESSOAS:')) {
        const ids = [...pedido.matchAll(/- (a\d{4}):/g)].map((m) => m[1]).filter((id) => !perde.has(id))
        return JSON.stringify(ids.map((id, i) => ({ id, r: i % 3 === 0 ? 'nao' : i % 7 === 0 ? 'duvida' : 'usaria', pagaria: i % 3 === 0 ? 0 : 29, motivo: 'motivo', fala: `fala ${id}`, forte: 'foto no ponto', fraco: i % 3 === 0 ? 'sem internet' : 'caro' })))
      }
      if (pedido.includes('TEMAS')) {
        const fortes = [...pedido.split('INCOMODOU:')[0].matchAll(/- (a\d{4}):/g)].map((m) => m[1])
        const fracos = [...pedido.split('INCOMODOU:')[1].matchAll(/- (a\d{4}):/g)].map((m) => m[1])
        return JSON.stringify({ fortes: [{ tema: 'Foto no ponto', ids: [...fortes, 'a9999'] }], fracos: [{ tema: 'Caro', ids: fracos.slice(0, 5) }, { tema: 'Sem internet', ids: fracos.slice(5) }], ideias: [{ titulo: 'Ponto sem internet', como: 'Guarda e envia depois', fraco: 1 }] })
      }
      throw new Error('pedido inesperado')
    },
  }
}
async function rodarAte(t, pasta, n) { await t._rodar(pasta, n) }

test('sorteio: 500 agentes, todos diferentes, cada categoria espalhada por igual; a mesma semente dá os mesmos agentes', () => {
  const eixos = { 'Profissão': ['A', 'B', 'C', 'D'], Cidade: ['X', 'Y', 'Z'], ...FIXOS }
  const ag = sortearAgentes(eixos, 500, 42)
  assert.equal(ag.length, 500)
  assert.equal(new Set(ag.map((a) => JSON.stringify(a.tracos))).size, 500)
  assert.equal(new Set(ag.map((a) => a.id)).size, 500)
  for (const v of eixos['Profissão']) { const n = ag.filter((a) => a.tracos['Profissão'] === v).length; assert.ok(n >= 110 && n <= 140, `${v}: ${n}`) }
  assert.ok(ag.filter((a) => a.tracos.Jeito === 'Desconfiado').length >= 100)
  for (const a of ag) { const [de, ate] = { '18 a 29': [18, 29], '30 a 44': [30, 44], '45 a 59': [45, 59], '60 ou mais': [60, 74] }[a.tracos.Idade]; assert.ok(a.idade >= de && a.idade <= ate) }
  assert.deepEqual(sortearAgentes(eixos, 50, 7), sortearAgentes(eixos, 50, 7))
})

test('texto do protótipo: só o texto das telas, sem script nem estilo', () => {
  const { cwd } = obra()
  const t = textoDoPrototipo(cwd)
  assert.match(t, /\[02BaterPonto\] Bater ponto Bater/)
  assert.doesNotMatch(t, /alert|x\{\}/)
})

test('reação torta não vira resposta; preço absurdo vira "não disse"', () => {
  assert.equal(limparReacao({ r: 'talvez' }), null)
  assert.equal(limparReacao(null), null)
  assert.equal(limparReacao({ r: 'usaria', pagaria: -5 }).pagaria, null)
  assert.equal(limparReacao({ r: 'nao', pagaria: '29.6' }).pagaria, 30)
})

test('teste completo com 100 agentes: lotes de 20, contas feitas pelo programa, temas só com ids de verdade, aviso de que são agentes de IA', async () => {
  const { raiz, cwd } = obra()
  const disparo = disparoFalso()
  const t = criarTestarIdeia({ raiz, disparo, agendar: () => {} })
  const { n } = await t.iniciar('ponto', { quantidade: 100 })
  await rodarAte(t, 'ponto', n)
  const e = await t.estado('ponto', n)
  assert.equal(e.estado, 'pronto')
  assert.equal(disparo.chamadas, 1 + 5 + 1)
  const r = await t.relatorio('ponto', n)
  assert.match(r.aviso, /agentes de IA, não pessoas reais/)
  assert.match(r.aviso, /não recomenda nem garante/)
  assert.equal(r.geral.total, 100)
  assert.equal(r.geral.usaria + r.geral.nao + r.geral.duvida, 100)
  assert.equal(r.semResposta, 0)
  assert.equal(r.fortes[0].tema, 'Foto no ponto')
  assert.equal(r.fortes[0].n, 100) // o id inventado a9999 não conta
  assert.deepEqual(r.ideias.map((i) => [i.titulo, i.tema]), [['Ponto sem internet', 'Sem internet']])
  assert.ok(Object.keys(r.porTipo).includes('Profissão') && Object.keys(r.porTipo).includes('Jeito'))
  assert.equal(r.preco.reduce((a, b) => a + b.n, 0), 100)
  assert.ok(disparo.pedidos[1].includes('Desconfiados desconfiam'))
})

test('quem não responde em 2 tentativas fica "sem resposta" e sai das contas (nada é inventado)', async () => {
  const { raiz } = obra()
  const disparo = disparoFalso({ perde: new Set(['a0003', 'a0040']) })
  const t = criarTestarIdeia({ raiz, disparo, agendar: () => {} })
  const { n } = await t.iniciar('ponto', { quantidade: 100 })
  await rodarAte(t, 'ponto', n)
  const r = await t.relatorio('ponto', n)
  assert.equal(r.semResposta, 2)
  assert.equal(r.geral.total, 98)
})

test('cota acabou no meio: pausa, guarda o que já fez e retoma de onde parou', async () => {
  const { raiz } = obra()
  const disparo = disparoFalso({ cotaNaChamada: 4 })
  let agendado = null
  const t = criarTestarIdeia({ raiz, disparo, agendar: (fn) => { agendado = fn } })
  const { n } = await t.iniciar('ponto', { quantidade: 100 })
  await rodarAte(t, 'ponto', n)
  let e = await t.estado('ponto', n)
  assert.equal(e.estado, 'pausado-cota')
  assert.equal(e.feitos, 40)
  assert.ok(agendado)
  await assert.rejects(t.iniciar('ponto', { quantidade: 100 }), /teste-em-andamento/)
  await rodarAte(t, 'ponto', n)
  e = await t.estado('ponto', n)
  assert.equal(e.estado, 'pronto')
  assert.equal(disparo.chamadas, 1 + 2 + 1 + 3 + 1) // os 2 lotes feitos não são perguntados de novo
})

test('"mesmos agentes": o teste novo reaproveita os agentes e o entendimento do anterior; histórico do mais novo para o mais antigo', async () => {
  const { raiz, cwd } = obra()
  const t = criarTestarIdeia({ raiz, disparo: disparoFalso(), agendar: () => {} })
  const a = await t.iniciar('ponto', { quantidade: 100 })
  await rodarAte(t, 'ponto', a.n)
  const disparo2 = disparoFalso()
  const t2 = criarTestarIdeia({ raiz, disparo: disparo2, agendar: () => {} })
  const b = await t2.iniciar('ponto', { quantidade: 100, mesmosDe: a.n, versao: 'v4' })
  await rodarAte(t2, 'ponto', b.n)
  const ag1 = JSON.parse(fs.readFileSync(path.join(cwd, '.atlas', 'testes', '1', 'agentes.json'), 'utf8'))
  const ag2 = JSON.parse(fs.readFileSync(path.join(cwd, '.atlas', 'testes', '2', 'agentes.json'), 'utf8'))
  assert.deepEqual(ag1, ag2)
  assert.equal(disparo2.chamadas, 5 + 1) // sem "entender" de novo
  const h = await t2.listar('ponto')
  assert.deepEqual(h.map((x) => [x.n, x.mesmosDe, x.versao]), [[2, 1, 'v4'], [1, null, null]])
  assert.ok(h[0].termometro.pctUsaria > 0)
})

test('entradas da tela validadas: quantidade fora da lista, teste inexistente, obra inválida', async () => {
  const { raiz } = obra()
  const t = criarTestarIdeia({ raiz, disparo: disparoFalso(), agendar: () => {} })
  await assert.rejects(t.iniciar('ponto', { quantidade: 5000 }), /quantidade-invalida/)
  await assert.rejects(t.iniciar('ponto', { quantidade: 100, mesmosDe: 9 }), /teste-invalido/)
  await assert.rejects(t.estado('ponto', '../1'), /teste-invalido/)
  await assert.rejects(t.listar('../x'), /obra-invalida/)
})

test('contas: porcentagens por tipo e preço em faixas', () => {
  const ag = [{ id: 'a1', tracos: { T: 'x' } }, { id: 'a2', tracos: { T: 'x' } }, { id: 'a3', tracos: { T: 'y' } }]
  const c = contas(ag, { a1: { r: 'usaria', pagaria: 29 }, a2: { r: 'nao', pagaria: 0 }, a3: { r: 'usaria', pagaria: 80 } })
  assert.deepEqual(c.porTipo.T.map((x) => [x.valor, x.pctUsaria]), [['y', 100], ['x', 50]])
  assert.deepEqual(c.preco.map((p) => p.n), [1, 0, 1, 0, 1])
  assert.equal(c.mediana, 29)
})
