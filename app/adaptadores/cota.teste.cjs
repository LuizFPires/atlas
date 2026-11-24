// Teste do adaptador de cota (node --test app/adaptadores/*.teste.cjs). Sem Claude real: o "teste barato" é simulado.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarCota, detectarCota, lerResultadoDoTeste, epochParaIso } = require('./cota.cjs')
const { resumirLinha } = require('./construcao.cjs')
const { criarLojaDeParadas } = require('./cota-store.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cota-'))
const PLAN = '# PLAN — Obra\n\n## Milestone 1 — Base\npeso: 1\n- [x] a\n\n## Milestone 2 — Aviso de confirmação\npeso: 1\n- [ ] Enviar aviso <b>agora</b>\n- [ ] outra\n'

function montar({ resposta, linha = { estado: 'parou', motivo: 'cota' }, pausada = false, registro = true, garantirKit } = {}) {
  const raiz = tmp()
  fs.mkdirSync(path.join(raiz, 'obra', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'PLAN.md'), PLAN)
  if (linha) fs.writeFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), JSON.stringify(linha))
  const estado = { resposta, testes: 0, continuadas: [], avisos: [], agora: new Date('2026-11-18T12:00:00Z') }
  const construcao = { linha: { rodando: () => false } }
  const painel = { ler: async () => ({ pausadaPorVoce: pausada }), continuar: async (p) => estado.continuadas.push(p) }
  const executar = async () => { estado.testes++; return { codigo: 0, saida: typeof estado.resposta === 'string' ? estado.resposta : JSON.stringify(estado.resposta), erro: '' } }
  const dadosApp = tmp()
  if (registro) criarLojaDeParadas({ raiz, dadosApp }).marcar('obra', { em: estado.agora.toISOString() }) // o que construcao.cjs grava no fim por cota
  estado.executadas = 0
  estado.ordem = []
  if (garantirKit) { const g = garantirKit; garantirKit = async (p) => { estado.ordem.push('kit:' + p); await g(p) } }
  painel.continuar = async (p) => { estado.ordem.push('continuar:' + p); estado.continuadas.push(p) }
  const cota = criarCota({ raiz, construcao, painel, claudeEstado: async () => ({ conectado: true, plano: 'pro' }), dadosApp, agora: () => estado.agora, executar, resolver: () => ({ cmd: 'x' }), avisar: async (p, t) => estado.avisos.push(t), garantirKit })
  return { raiz, cota, estado, dadosApp }
}
const OK = { type: 'result', is_error: false, result: 'ok' }
const LIMITE = { type: 'result', is_error: true, result: 'Claude AI usage limit reached|1795010000' }

test('detectarCota: só padrões estruturados, nunca "cota" solto', () => {
  const agora = new Date('2026-11-18T12:00:00Z')
  assert.equal(detectarCota({ type: 'result', is_error: true, result: 'Claude AI usage limit reached|1795010000' }, agora).forca, 'forte')
  assert.equal(detectarCota({ type: 'result', is_error: true, result: "You've hit your limit · resets 3pm" }, agora).voltaEm, null)
  assert.equal(detectarCota({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: 1795010000 } }, agora).forca, 'forte')
  assert.equal(detectarCota({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', resetsAt: 1795010000 } }, agora), null)
  assert.equal(detectarCota({ type: 'assistant', error: 'rate_limit', message: {} }, agora).forca, 'fraca')
  // sem is_error, ou texto solto sobre cota/limite, não é sinal
  assert.equal(detectarCota({ type: 'result', is_error: false, result: 'usage limit reached' }, agora), null)
  assert.equal(detectarCota({ type: 'result', is_error: true, result: 'Falha no teste: pedido de cotação com cota de 5' }, agora), null)
  assert.equal(detectarCota({ type: 'assistant', message: { content: [{ type: 'text', text: 'Vou tratar o usage limit reached do cliente' }] } }, agora), null)
  assert.equal(detectarCota(null), null)
})

test('epochParaIso: só datas plausíveis (segundos ou ms)', () => {
  const agora = new Date('2026-11-18T12:00:00Z')
  assert.equal(epochParaIso(1795010000, agora), new Date(1795010000 * 1000).toISOString())
  assert.equal(epochParaIso('1795010000000', agora), new Date(1795010000000).toISOString())
  assert.equal(epochParaIso(5, agora), null)
  assert.equal(epochParaIso(4_000_000_000, agora), null)
  assert.equal(epochParaIso('abc', agora), null)
})

test('resumirLinha leva o horário de volta e trata o sinal fraco à parte', () => {
  const r = resumirLinha(JSON.stringify({ type: 'result', is_error: true, result: 'Claude AI usage limit reached|' + Math.floor(Date.now() / 1000 + 3600) }))
  assert.equal(r.cota, true)
  assert.ok(r.voltaEm)
  const f = resumirLinha(JSON.stringify({ type: 'assistant', error: 'rate_limit', message: { content: [] } }))
  assert.equal(f.cota, false)
  assert.equal(f.cotaFraca, true)
})

test('lerResultadoDoTeste: só resposta normal é renovada; o resto é fail-closed', () => {
  assert.equal(lerResultadoDoTeste(JSON.stringify(OK)).estado, 'renovada')
  assert.equal(lerResultadoDoTeste(JSON.stringify([{ type: 'system' }, OK])).estado, 'renovada')
  assert.equal(lerResultadoDoTeste(JSON.stringify(LIMITE), new Date('2026-11-18T12:00:00Z')).estado, 'esgotada')
  for (const ruim of ['', 'lixo', '{}', JSON.stringify({ type: 'result', is_error: true, result: 'erro de rede' }), JSON.stringify({ type: 'result', is_error: false, result: '' })]) {
    assert.equal(lerResultadoDoTeste(ruim).estado, 'incerto')
  }
})

test('ler: parada por cota sem renovar -> esgotada, não renovada, com onde parou (como dado)', async () => {
  const { cota } = montar({ resposta: LIMITE, linha: { estado: 'parou', motivo: 'cota', voltaEm: '2026-11-18T17:00:00.000Z' } })
  const e = await cota.ler('obra')
  assert.equal(e.esgotada, true)
  assert.equal(e.renovada, false)
  assert.equal(e.plano, 'pro')
  assert.equal(e.voltaEm, '2026-11-18T17:00:00.000Z') // antes da hora conhecida, nem testa (economia): vale o horário da linha
  assert.equal(e.parouEm.etapa, 'M2')
  assert.ok(!/[<>]/.test(e.parouEm.tarefa))
})

test('ler: obra que não parou por cota não esgotada; erro e timeout do teste não renovam', async () => {
  assert.equal((await montar({ linha: { estado: 'parou', motivo: 'erro' } }).cota.ler('obra')).esgotada, false)
  assert.equal((await montar({ linha: null }).cota.ler('obra')).esgotada, false)
  const { cota } = montar({ resposta: 'saída estranha' })
  assert.equal((await cota.ler('obra')).renovada, false)
})

test('ler: o teste barato é espaçado (não gasta cota a cada leitura)', async () => {
  const { cota, estado } = montar({ resposta: LIMITE })
  await cota.ler('obra'); await cota.ler('obra'); await cota.ler('obra')
  assert.equal(estado.testes, 1)
  estado.agora = new Date(estado.agora.getTime() + 4 * 60_000)
  await cota.ler('obra')
  assert.equal(estado.testes, 2)
})

test('retomar: renovada religa pelo painel e avisa; não renovada lança e não muda nada', async () => {
  const a = montar({ resposta: LIMITE })
  await assert.rejects(a.cota.retomar('obra'), /cota-nao-renovou/)
  assert.deepEqual(a.estado.continuadas, [])
  const b = montar({ resposta: OK })
  await b.cota.retomar('obra')
  assert.deepEqual(b.estado.continuadas, ['obra'])
  assert.deepEqual(b.estado.avisos, ['A obra voltou sozinha.'])
})

test('retomar: respeita a pausa do cliente e não faz nada se nunca foi cota', async () => {
  const a = montar({ resposta: OK, pausada: true })
  await a.cota.retomar('obra')
  assert.deepEqual(a.estado.continuadas, [])
  const b = montar({ resposta: OK, linha: { estado: 'parou', motivo: 'erro' }, registro: false })
  await b.cota.retomar('obra')
  assert.equal(b.estado.testes, 0)
  assert.deepEqual(b.estado.continuadas, [])
})

test('retomar: pasta inválida é recusada antes de tudo', async () => {
  const { cota } = montar({ resposta: OK })
  await assert.rejects(cota.retomar('..'), /obra-invalida/)
  await assert.rejects(cota.ler('../x'), /obra-invalida/)
})

test('vigiar: retoma sozinho só obra parada por cota que renovou', async () => {
  const { cota, estado, raiz } = montar({ resposta: OK })
  fs.mkdirSync(path.join(raiz, 'outra', '.atlas'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'outra', 'PLAN.md'), PLAN)
  fs.writeFileSync(path.join(raiz, 'outra', '.atlas', 'linha.json'), JSON.stringify({ estado: 'parou', motivo: 'pausada' }))
  const feitas = await cota.vigiar()
  assert.deepEqual(feitas, ['obra'])
  assert.deepEqual(estado.continuadas, ['obra'])
})

test('vigiar: garante o kit ANTES de religar; se o kit falhar, nada é religado e o registro fica', async () => {
  const a = montar({ resposta: OK, garantirKit: async () => {} })
  assert.deepEqual(await a.cota.vigiar(), ['obra'])
  assert.deepEqual(a.estado.ordem, ['kit:obra', 'continuar:obra'])
  const b = montar({ resposta: OK, garantirKit: async () => { throw new Error('kit-indisponivel') } })
  assert.deepEqual(await b.cota.vigiar(), [])
  assert.deepEqual(b.estado.continuadas, [])
  assert.equal(criarLojaDeParadas({ raiz: b.raiz, dadosApp: b.dadosApp }).obter('obra') !== null, true)
})

test('vigiar: cota não renovada não baixa o kit', async () => {
  const a = montar({ resposta: LIMITE, garantirKit: async () => {} })
  assert.deepEqual(await a.cota.vigiar(), [])
  assert.deepEqual(a.estado.ordem, [])
})

test('ocorrência aberta de cota no livro também conta, com liberar_em', async () => {
  const { cota, raiz } = montar({ resposta: { type: 'result', is_error: true, result: "You've hit your limit" }, linha: null })
  fs.mkdirSync(path.join(raiz, 'obra', 'docs'))
  fs.writeFileSync(path.join(raiz, 'obra', 'docs', 'ocorrencias.json'), JSON.stringify({ ocorrencias: [{ id: 1, status: 'aberta', servico: 'Claude', motivo: 'cota estourada', liberar_em: '2026-11-18T18:00:00.000Z' }] }))
  const e = await cota.ler('obra')
  assert.equal(e.esgotada, true)
  assert.equal(e.voltaEm, '2026-11-18T18:00:00.000Z')
})

test('vigiar: linha.json FORJADO e SEM registro do app não retoma, não testa e nunca chama continuar', async () => {
  const { cota, estado, raiz } = montar({ resposta: OK, registro: false })
  fs.mkdirSync(path.join(raiz, 'obra', 'docs'))
  fs.writeFileSync(path.join(raiz, 'obra', 'docs', 'ocorrencias.json'), JSON.stringify({ ocorrencias: [{ id: 1, status: 'aberta', servico: 'Claude', motivo: 'cota estourada' }] }))
  assert.deepEqual(await cota.vigiar(), [])
  assert.equal(estado.testes, 0) // nem gastou cota com o teste barato
  assert.deepEqual(estado.continuadas, [])
  // a tela ainda mostra a espera (exibição), mas o religar automático segue negado
  assert.equal((await cota.ler('obra')).esgotada, true)
  assert.deepEqual(await cota.vigiar(), [])
  assert.deepEqual(estado.continuadas, [])
})

test('vigiar: pula obra pronta (100%) e pausa do cliente, mesmo com registro do app', async () => {
  const a = montar({ resposta: OK })
  fs.writeFileSync(path.join(a.raiz, 'obra', 'PLAN.md'), PLAN.replace('- [ ] Enviar aviso <b>agora</b>', '- [x] x').replace('- [ ] outra', '- [x] y'))
  assert.deepEqual(await a.cota.vigiar(), [])
  assert.deepEqual(a.estado.continuadas, [])
  assert.equal(criarLojaDeParadas({ raiz: a.raiz, dadosApp: a.dadosApp }).obter('obra'), null) // registro apagado
  const b = montar({ resposta: OK, pausada: true })
  assert.deepEqual(await b.cota.vigiar(), [])
  assert.deepEqual(b.estado.continuadas, [])
})

test('retomar (clique do cliente) usa a fonte ampla; religar automático exige o registro', async () => {
  const { cota, estado } = montar({ resposta: OK, registro: false })
  await cota.retomar('obra')
  assert.deepEqual(estado.continuadas, ['obra'])
})

test('cota como palavra inteira: "cotação" na ocorrência não vira cota', async () => {
  const { cota, raiz } = montar({ resposta: OK, linha: null, registro: false })
  fs.mkdirSync(path.join(raiz, 'obra', 'docs'))
  fs.writeFileSync(path.join(raiz, 'obra', 'docs', 'ocorrencias.json'), JSON.stringify({ ocorrencias: [{ id: 1, status: 'aberta', servico: 'Loja', motivo: 'pedido de cotação' }] }))
  assert.equal((await cota.ler('obra')).esgotada, false)
})

test('economia: com a hora da volta conhecida, não testa antes dela (o teste também gasta); depois, testa', async () => {
  const volta = '2026-11-18T15:00:00Z'
  const { raiz, cota, estado, dadosApp } = montar({ resposta: LIMITE, linha: { estado: 'parou', motivo: 'cota', voltaEm: volta } })
  criarLojaDeParadas({ raiz, dadosApp }).marcar('obra', { voltaEm: volta, em: estado.agora.toISOString() })
  await cota.vigiar()
  estado.agora = new Date('2026-11-18T13:30:00Z'); await cota.vigiar()
  assert.equal(estado.testes, 0)
  estado.agora = new Date('2026-11-18T14:59:00Z'); estado.resposta = OK; await cota.vigiar()
  assert.equal(estado.testes, 1)
})
