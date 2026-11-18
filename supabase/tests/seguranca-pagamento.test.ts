// @vitest-environment node
// Achados da revisão de segurança do M3: validação do pagamento, isolamento por conta, open redirect, TOCTOU e recompra.
import { describe, expect, it } from 'vitest'
import { criarCheckout } from '../functions/_shared/pagamento/checkout.ts'
import { processarAtrasos } from '../functions/_shared/pagamento/atraso.ts'
import { cancelarCompra } from '../functions/_shared/pagamento/cancelamento.ts'
import { processarWebhook } from '../functions/_shared/pagamento/webhook.ts'
import { tratar } from '../functions/_shared/http.ts'
import { assinarStripe, CONTA, evento, montarPag } from './helpers-pagamento.ts'
import { H1 } from './helpers.ts'

const DIA = 24 * 3600_000
type M = ReturnType<typeof montarPag>
async function enviar(m: M, ev: object, conta = CONTA) {
  const corpo = JSON.stringify(ev)
  return processarWebhook(m.deps, conta, corpo, await assinarStripe(corpo, undefined, Math.floor(m.deps.agora().getTime() / 1000)))
}
const sessao = (extra: Record<string, unknown> = {}) => ({
  id: 'cs_1', mode: 'payment', payment_status: 'paid', amount_total: 480000, currency: 'brl', customer: 'cus_1', payment_intent: 'pi_1',
  metadata: { atlas_tipo: 'implantacao', atlas_conta: CONTA }, customer_details: { email: 'bia@padaria.com', name: 'Bia' }, ...extra,
})
const fatura = (id = 'in_1') => ({ id, customer: 'cus_1', subscription: 'sub_1', amount_paid: 20000, amount_due: 20000, payment_intent: `pi_${id}` })
const licencasDaConta = (m: M) => m.store.licencas.filter((l) => l.conta_gateway_id === CONTA)

describe('A — só o pagamento de implantação válido concede licença', () => {
  const casos: Array<[string, Record<string, unknown>]> = [
    ['cupom 100% (no_payment_required)', { payment_status: 'no_payment_required', amount_total: 0 }],
    ['valor baixo', { amount_total: 100 }],
    ['moeda diferente', { currency: 'usd' }],
    ['outro produto (sem metadata do Atlas)', { metadata: {} }],
    ['tipo de metadata diferente', { metadata: { atlas_tipo: 'mensalidade', atlas_conta: CONTA } }],
    ['metadata de outra conta', { metadata: { atlas_tipo: 'implantacao', atlas_conta: 'conta-2' } }],
  ]
  for (const [nome, extra] of casos) {
    it(`${nome} não concede licença nem grava pagamento`, async () => {
      const m = montarPag()
      await enviar(m, evento('checkout.session.completed', sessao(extra)))
      await enviar(m, evento('checkout.session.async_payment_succeeded', sessao({ ...extra, payment_intent: 'pi_2' })))
      expect(licencasDaConta(m)).toHaveLength(0)
      expect(m.store.pagamentos).toHaveLength(0)
    })
  }
  it('a sessão correta concede', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessao()))
    expect(licencasDaConta(m)).toHaveLength(1)
  })
})

describe('B — pagamento de conta errada', () => {
  it('e-mail com licença de outra conta: 409, sem pagamento e sem mexer na licença', async () => {
    const m = montarPag()
    m.store.contas.push({ id: 'conta-2', conta_stripe_id: 'acct_2', segredo_ref: 'CLIENTE1', modo: 'teste', base_retorno: 'https://b.test' })
    Object.assign(m.store.licencas[0], { conta_gateway_id: 'conta-2', status: 'atrasada', pausa_prevista_em: new Date(m.deps.agora().getTime() + DIA) })
    await expect(enviar(m, evento('checkout.session.completed', sessao({ customer_details: { email: 'ana@loja.com' } })))).rejects.toMatchObject({ status: 409, codigo: 'conta_divergente' })
    expect(m.store.pagamentos).toHaveLength(0)
    expect(m.store.licencas[0].status).toBe('atrasada')
  })
})

describe('C — estorno não cruza contas', () => {
  it('charge.refunded da conta B não estorna o mesmo pi_ da conta A', async () => {
    const m = montarPag()
    m.store.contas.push({ id: 'conta-2', conta_stripe_id: 'acct_2', segredo_ref: 'CLIENTE1', modo: 'teste', base_retorno: 'https://b.test' })
    await enviar(m, evento('checkout.session.completed', sessao()))
    await enviar(m, evento('checkout.session.completed', sessao({ metadata: { atlas_tipo: 'implantacao', atlas_conta: 'conta-2' }, customer_details: { email: 'cai@outra.com' } })), 'conta-2')
    expect(m.store.pagamentos).toHaveLength(2) // mesmo pi_1 em contas diferentes convive
    await enviar(m, evento('charge.refunded', { payment_intent: 'pi_1', amount: 480000, amount_refunded: 480000 }), 'conta-2')
    expect(m.store.pagamentos.find((p) => p.conta_gateway_id === CONTA)?.status).toBe('pago')
    expect(m.store.pagamentos.find((p) => p.conta_gateway_id === 'conta-2')?.status).toBe('estornado')
  })
})

describe('D — URL de retorno vem do servidor', () => {
  it('ignora success_url/cancel_url da requisição HTTP e usa a base da conta', async () => {
    const m = montarPag()
    const c = { deps: m.deps, pagamento: m.deps, carregarKit: async () => [], autorizarServico: () => false }
    const r = await tratar(c, new Request('https://x.test/functions/v1/pagamento/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conta_id: CONTA, tipo: 'implantacao', email: 'a@b.co', url_sucesso: 'https://evil.test/x', url_cancelar: 'https://evil.test/y', success_url: 'https://evil.test/z' }),
    }))
    expect(r.status).toBe(200)
    const f = new URLSearchParams(m.chamadas[0].body)
    expect(f.get('success_url')).toBe('https://loja.atlas.test/compra/sucesso')
    expect(f.get('cancel_url')).toBe('https://loja.atlas.test/compra/cancelada')
    expect(m.chamadas[0].body).not.toContain('evil')
  })
  it('sem base configurada, ou base inválida/não https, recusa com erro claro', async () => {
    for (const base of [null, undefined, 'http://loja.test', 'javascript:alert(1)', 'nao-e-url', 'https://u:p@loja.test']) {
      const m = montarPag()
      m.store.contas[0].base_retorno = base
      await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'a@b.co' })).rejects.toMatchObject({ codigo: 'retorno_nao_configurado', status: 503 })
      expect(m.chamadas).toHaveLength(0)
    }
  })
  it('normaliza para a origem exata (descarta caminho/query da base)', async () => {
    const m = montarPag()
    m.store.contas[0].base_retorno = 'https://loja.test/qualquer?x=1'
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'a@b.co' })
    expect(new URLSearchParams(m.chamadas[0].body).get('success_url')).toBe('https://loja.test/compra/sucesso')
  })
})

describe('E — corrida job de atraso x webhook', () => {
  async function atrasada() {
    const m = montarPag()
    Object.assign(m.store.licencas[0], { conta_gateway_id: CONTA, gateway_cliente_ref: 'cus_1', gateway_assinatura_ref: 'sub_1', avisos_atraso: 0 })
    await m.ativar(H1)
    await enviar(m, evento('invoice.payment_failed', fatura('in_1')))
    return m
  }
  it('job com leitura velha não repausa quem pagou no meio', async () => {
    const m = await atrasada()
    m.avancar(8 * DIA)
    const velha = { ...m.store.licencas[0] }
    await enviar(m, evento('invoice.paid', fatura('in_2'))) // pagamento chega depois da leitura do job
    expect(m.store.licencas[0].status).toBe('ativa')
    m.store.licencasAtrasadas = async () => [velha]
    m.store.licencaPorId = async () => velha
    const r = await processarAtrasos(m.deps)
    expect(r.pausadas).toBe(0)
    expect(m.store.licencas[0].status).toBe('ativa')
    expect(m.store.ocorrencias.some((o) => o.tipo === 'licenca_pausada')).toBe(false)
  })
  it('duas rodadas simultâneas do job não duplicam o aviso', async () => {
    const m = await atrasada()
    m.avancar(3.5 * DIA)
    await Promise.all([processarAtrasos(m.deps), processarAtrasos(m.deps)])
    expect(m.avisos.map((a) => a.aviso.n)).toEqual([1, 2])
    expect(m.store.licencas[0].avisos_atraso).toBe(2)
  })
  it('quem pagou entre a leitura e o envio não recebe aviso', async () => {
    const m = await atrasada()
    m.avancar(3.5 * DIA)
    const velha = { ...m.store.licencas[0] }
    await enviar(m, evento('invoice.paid', fatura('in_2')))
    m.store.licencasAtrasadas = async () => [velha]
    m.store.licencaPorId = async () => velha
    await processarAtrasos(m.deps)
    expect(m.avisos).toHaveLength(1) // só o aviso 1, de antes do pagamento
  })
  it('e-mail que falha devolve a reserva e a próxima rodada reenvia', async () => {
    const m = await atrasada()
    m.avancar(3.5 * DIA)
    const ok = m.deps.enviarAvisoAtraso
    m.deps.enviarAvisoAtraso = async () => { throw new Error('fora do ar') }
    await processarAtrasos(m.deps)
    expect(m.store.licencas[0].avisos_atraso).toBe(1)
    m.deps.enviarAvisoAtraso = ok
    await processarAtrasos(m.deps)
    expect(m.store.licencas[0].avisos_atraso).toBe(2)
  })
})

describe('F — recompra depois do arrependimento', () => {
  it('pagamento válido reativa a licença cancelada com nova janela de 7 dias', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessao()))
    const lic = () => m.store.licencas.find((l) => l.conta_gateway_id === CONTA)!
    m.avancar(2 * DIA)
    expect(await cancelarCompra(m.deps, 'bia@padaria.com')).toMatchObject({ ok: true })
    expect(lic().status).toBe('cancelada')
    m.avancar(10 * DIA) // fora da janela antiga
    await enviar(m, evento('checkout.session.completed', sessao({ id: 'cs_2', payment_intent: 'pi_novo', customer: 'cus_9' })))
    expect(lic()).toMatchObject({ status: 'ativa', gateway_assinatura_ref: null, gateway_cliente_ref: 'cus_9' })
    expect(lic().comprada_em).toEqual(m.deps.agora())
    expect(m.store.pagamentos.find((p) => p.gateway_ref === 'pi_novo')?.status).toBe('pago')
    // nova janela: dá para desistir de novo
    expect(await cancelarCompra(m.deps, 'bia@padaria.com')).toMatchObject({ ok: true })
  })
  it('reentrega da compra já estornada não reativa a licença', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessao()))
    await cancelarCompra(m.deps, 'bia@padaria.com')
    await enviar(m, evento('checkout.session.async_payment_succeeded', sessao()))
    expect(m.store.licencas.find((l) => l.conta_gateway_id === CONTA)?.status).toBe('cancelada')
  })
})
