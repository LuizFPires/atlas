// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { verificarAssinaturaStripe } from '../functions/_shared/pagamento/assinatura-stripe.ts'
import { processarWebhook } from '../functions/_shared/pagamento/webhook.ts'
import { tratar } from '../functions/_shared/http.ts'
import { verificar } from '../functions/_shared/verificar.ts'
import { assinarStripe, CONTA, evento, montarPag, WHSEC_TESTE } from './helpers-pagamento.ts'
import { H1, TOKEN } from './helpers.ts'

type M = ReturnType<typeof montarPag>
async function enviar(m: M, ev: object, conta = CONTA) {
  const corpo = JSON.stringify(ev)
  return processarWebhook(m.deps, conta, corpo, await assinarStripe(corpo))
}
const sessaoImpl = (extra: Record<string, unknown> = {}) => ({
  id: 'cs_1', mode: 'payment', payment_status: 'paid', amount_total: 480000, customer: 'cus_1', payment_intent: 'pi_1',
  customer_details: { email: 'Bia@Padaria.com', name: 'Bia Souza' }, ...extra,
})
const fatura = (extra: Record<string, unknown> = {}) => ({ id: 'in_1', customer: 'cus_1', subscription: 'sub_1', amount_paid: 20000, amount_due: 20000, payment_intent: 'pi_m1', ...extra })

async function comCompra() {
  const m = montarPag()
  await enviar(m, evento('checkout.session.completed', sessaoImpl()))
  return m
}

describe('assinatura do webhook', () => {
  const agora = Date.parse('2026-11-18T12:00:00Z')
  it('aceita assinatura correta e rejeita corpo adulterado, segredo errado, janela vencida e cabeçalho vazio', async () => {
    const corpo = '{"a":1}'
    const h = await assinarStripe(corpo)
    expect(await verificarAssinaturaStripe(corpo, h, WHSEC_TESTE, agora)).toBe(true)
    expect(await verificarAssinaturaStripe('{"a":2}', h, WHSEC_TESTE, agora)).toBe(false)
    expect(await verificarAssinaturaStripe(corpo, h, 'whsec_outro', agora)).toBe(false)
    expect(await verificarAssinaturaStripe(corpo, h, WHSEC_TESTE, agora + 6 * 60_000)).toBe(false)
    expect(await verificarAssinaturaStripe(corpo, null, WHSEC_TESTE, agora)).toBe(false)
    expect(await verificarAssinaturaStripe(corpo, 't=abc,v1=zz', WHSEC_TESTE, agora)).toBe(false)
  })
  it('processarWebhook recusa assinatura inválida, conta desconhecida e segredo ausente', async () => {
    const m = montarPag()
    const corpo = JSON.stringify(evento('invoice.paid', fatura()))
    await expect(processarWebhook(m.deps, CONTA, corpo, 't=1,v1=00')).rejects.toMatchObject({ codigo: 'assinatura_invalida', status: 400 })
    await expect(processarWebhook(m.deps, CONTA, corpo, await assinarStripe(corpo, 'whsec_de_outra_conta'))).rejects.toMatchObject({ codigo: 'assinatura_invalida' })
    await expect(processarWebhook(m.deps, 'nao-existe', corpo, await assinarStripe(corpo))).rejects.toMatchObject({ codigo: 'conta_desconhecida', status: 404 })
    m.store.contas.push({ id: 'sem', conta_stripe_id: 'acct_x', segredo_ref: 'FALTA', modo: 'teste' })
    await expect(processarWebhook(m.deps, 'sem', corpo, await assinarStripe(corpo))).rejects.toMatchObject({ codigo: 'gateway_nao_configurado', status: 503 })
    expect(m.store.licencas).toHaveLength(1) // nada mudou
  })
})

describe('webhook: implantação', () => {
  it('pagamento confirmado cria cliente+licença ativa e grava o pagamento (valor em reais)', async () => {
    const m = await comCompra()
    const cli = m.store.clientes.find((c) => c.email_compra === 'bia@padaria.com')
    expect(cli?.nome_tratamento).toBe('Bia')
    const lic = m.store.licencas.find((l) => l.cliente_id === cli?.id)
    expect(lic).toMatchObject({ status: 'ativa', conta_gateway_id: CONTA, gateway_cliente_ref: 'cus_1' })
    expect(lic?.comprada_em).toEqual(m.deps.agora())
    expect(m.store.pagamentos[0]).toMatchObject({ tipo: 'implantacao', valor: 4800, status: 'pago', gateway_ref: 'pi_1' })
  })
  it('Pix pendente não libera; só async_payment_succeeded libera', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessaoImpl({ payment_status: 'unpaid' })))
    expect(m.store.licencas).toHaveLength(1) // só a licença fixture l1
    expect(m.store.pagamentos).toHaveLength(0)
    await enviar(m, evento('checkout.session.async_payment_succeeded', sessaoImpl()))
    expect(m.store.pagamentos[0].status).toBe('pago')
    expect(m.store.licencas).toHaveLength(2)
  })
  it('evento repetido é ignorado (idempotente); falha libera o evento para reenvio', async () => {
    const m = montarPag()
    const ev = evento('checkout.session.completed', sessaoImpl(), 'evt_fixo')
    await enviar(m, ev)
    expect(await enviar(m, ev)).toMatchObject({ duplicado: true })
    expect(m.store.pagamentos).toHaveLength(1)
    // sessão sem e-mail: erro 400 e o mesmo id pode ser reprocessado depois
    const ruim = evento('checkout.session.completed', sessaoImpl({ customer_details: {} }), 'evt_ruim')
    await expect(enviar(m, ruim)).rejects.toMatchObject({ codigo: 'sessao_incompleta' })
    expect(await m.store.registrarEventoGateway(CONTA, 'evt_ruim')).toBe(true)
  })
  it('compra duplicada do mesmo e-mail não cria segunda licença', async () => {
    const m = await comCompra()
    await enviar(m, evento('checkout.session.completed', sessaoImpl({ payment_intent: 'pi_2' })))
    expect(m.store.licencas.filter((l) => l.conta_gateway_id === CONTA)).toHaveLength(1)
    expect(m.store.pagamentos).toHaveLength(2)
  })
})

describe('webhook: mensalidade', () => {
  it('fatura paga grava mensalidade e mantém a licença em dia', async () => {
    const m = await comCompra()
    await enviar(m, evento('invoice.paid', fatura()))
    expect(m.store.pagamentos.find((p) => p.gateway_ref === 'in_1')).toMatchObject({ tipo: 'mensalidade', valor: 200, status: 'pago', gateway_pi: 'pi_m1' })
    expect(m.store.licencas.find((l) => l.conta_gateway_id === CONTA)?.gateway_assinatura_ref).toBe('sub_1')
  })
  it('checkout de assinatura concluído guarda sub_… na licença correta', async () => {
    const m = await comCompra()
    const lic = m.store.licencas.find((l) => l.conta_gateway_id === CONTA)!
    await enviar(m, evento('checkout.session.completed', { id: 'cs_2', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_9', metadata: { atlas_licenca: lic.id } }))
    expect(m.store.licencas.find((l) => l.id === lic.id)?.gateway_assinatura_ref).toBe('sub_9')
  })
  it('fatura de licença desconhecida dá erro 409 (Stripe reenvia) e libera o evento', async () => {
    const m = montarPag()
    await expect(enviar(m, evento('invoice.paid', fatura({ customer: 'cus_xx', subscription: 'sub_xx' }), 'evt_x'))).rejects.toMatchObject({ status: 409 })
    expect(await m.store.registrarEventoGateway(CONTA, 'evt_x')).toBe(true)
  })
  it('licença de OUTRA conta não é afetada por webhook desta conta', async () => {
    const m = await comCompra()
    m.store.contas.push({ id: 'conta-2', conta_stripe_id: 'acct_2', segredo_ref: 'CLIENTE1', modo: 'teste' })
    await expect(enviar(m, evento('invoice.paid', fatura()), 'conta-2')).rejects.toMatchObject({ codigo: 'licenca_nao_encontrada' })
  })
})

describe('webhook: estorno, cancelamento e eventos desconhecidos', () => {
  it('charge.refunded total marca estornado; parcial não', async () => {
    const m = await comCompra()
    await enviar(m, evento('charge.refunded', { payment_intent: 'pi_1', amount: 480000, amount_refunded: 1000 }))
    expect(m.store.pagamentos[0].status).toBe('pago')
    await enviar(m, evento('charge.refunded', { payment_intent: 'pi_1', amount: 480000, amount_refunded: 480000 }))
    expect(m.store.pagamentos[0].status).toBe('estornado')
  })
  it('assinatura encerrada cancela a licença', async () => {
    const m = await comCompra()
    await enviar(m, evento('invoice.paid', fatura()))
    await enviar(m, evento('customer.subscription.deleted', { id: 'sub_1' }))
    expect(m.store.licencas.find((l) => l.conta_gateway_id === CONTA)?.status).toBe('cancelada')
  })
  it('evento desconhecido responde ok/ignorado', async () => {
    expect(await enviar(montarPag(), evento('customer.created', { id: 'cus_9' }))).toMatchObject({ ok: true, ignorado: true })
  })
})

describe('rota HTTP do webhook', () => {
  it('usa o corpo bruto; 400 com assinatura ruim; 200 com assinatura certa', async () => {
    const m = montarPag()
    const c = { deps: m.deps, pagamento: m.deps, carregarKit: async () => [], autorizarServico: () => false }
    const corpo = JSON.stringify(evento('customer.created', { id: 'cus_1' }))
    const url = `https://x.test/functions/v1/webhook/stripe/${CONTA}`
    const ruim = await tratar(c, new Request(url, { method: 'POST', headers: { 'Stripe-Signature': 't=1,v1=ab' }, body: corpo }))
    expect(ruim.status).toBe(400)
    const bom = await tratar(c, new Request(url, { method: 'POST', headers: { 'Stripe-Signature': await assinarStripe(corpo) }, body: corpo }))
    expect(bom.status).toBe(200)
    const sem = await tratar({ ...c, pagamento: undefined }, new Request(url, { method: 'POST', body: corpo }))
    expect(sem.status).toBe(503)
  })
})

describe('integração com /verificar (M2)', () => {
  it('pagamento libera a licença e a falta de pagamento não', async () => {
    const m = await comCompra()
    const lic = m.store.licencas.find((l) => l.conta_gateway_id === CONTA)!
    const { sha256 } = await import('../functions/_shared/cripto.ts')
    await m.store.inserirAtivacao(lic.id, H1, m.deps.agora(), await sha256(TOKEN))
    const r = await verificar(m.deps, { email: 'bia@padaria.com', computador_hash: H1, token_dispositivo: TOKEN })
    expect(r).toMatchObject({ pode_construir: true, motivo: 'ok' })
  })
})
