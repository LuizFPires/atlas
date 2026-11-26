// @vitest-environment node
// M31 (Luiz, 26/11/2026): fora do Brasil, em dólar — US$ 1.700 de implantação, US$ 2.400 o app pronto, US$ 70/mês.
import { describe, expect, it } from 'vitest'
import { criarCheckout } from '../functions/_shared/pagamento/checkout.ts'
import { processarWebhook } from '../functions/_shared/pagamento/webhook.ts'
import { assinarStripe, CONTA, evento, montarPag } from './helpers-pagamento.ts'

const corpoDe = (c: { body?: string }) => new URLSearchParams(c.body)
type M = ReturnType<typeof montarPag>
async function enviar(m: M, ev: object) {
  const corpo = JSON.stringify(ev)
  return processarWebhook(m.deps, CONTA, corpo, await assinarStripe(corpo))
}
const sessaoUs = (extra: Record<string, unknown> = {}) => ({
  id: 'cs_us1', mode: 'payment', payment_status: 'paid', amount_total: 170000, currency: 'usd',
  metadata: { atlas_tipo: 'implantacao', atlas_conta: CONTA, atlas_mercado: 'us' }, customer: 'cus_us', payment_intent: 'pi_us1',
  customer_details: { email: 'John@Shop.com', name: 'John Smith' }, ...extra,
})

describe('checkout em dólar (M31)', () => {
  it('implantação: US$ 1.700, só cartão, sem parcelas, página da Stripe em inglês', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'john@shop.com', aceite_termos_versao: '1.2', parcelas: 6, mercado: 'us' })
    const f = corpoDe(m.chamadas[0])
    expect(f.get('line_items[0][price_data][currency]')).toBe('usd')
    expect(f.get('line_items[0][price_data][unit_amount]')).toBe('170000')
    expect(f.get('payment_method_types[0]')).toBe('card')
    expect(f.get('payment_method_types[1]')).toBeNull()
    expect(f.get('payment_method_options[card][installments][enabled]')).toBeNull()
    expect(f.get('locale')).toBe('en')
    expect(f.get('metadata[atlas_mercado]')).toBe('us')
    expect(f.get('line_items[0][price_data][product_data][name]')).toBe('Atlas — setup')
  })
  it('app pronto: US$ 2.400', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'prateleira', segmento: 'academia', email: 'a@b.co', aceite_termos_versao: '1.2', mercado: 'us' })
    expect(corpoDe(m.chamadas[0]).get('line_items[0][price_data][unit_amount]')).toBe('240000')
  })
  it('sem mercado (ou desconhecido) continua em real, como sempre', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'a@b.co', aceite_termos_versao: '1.2', mercado: 'xx' as 'us' })
    const f = corpoDe(m.chamadas[0])
    expect(f.get('line_items[0][price_data][currency]')).toBe('brl')
    expect(f.get('line_items[0][price_data][unit_amount]')).toBe('480000')
    expect(f.get('metadata[atlas_mercado]')).toBeNull()
  })
})

describe('webhook em dólar (M31)', () => {
  it('pagou US$ 1.700: concede a licença em inglês', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessaoUs()))
    expect(m.store.licencas).toHaveLength(2)
    expect(m.store.licencas[1].idioma).toBe('en')
  })
  it('em dólar com valor menor que US$ 1.700 não concede', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessaoUs({ amount_total: 169999 })))
    expect(m.store.licencas).toHaveLength(1)
  })
  it('sessão em dólar sem o mercado "us" (ou em real com o mercado "us") não concede', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessaoUs({ metadata: { atlas_tipo: 'implantacao', atlas_conta: CONTA } })))
    await enviar(m, evento('checkout.session.completed', sessaoUs({ id: 'cs_us2', payment_intent: 'pi_us2', currency: 'brl', amount_total: 480000 })))
    expect(m.store.licencas).toHaveLength(1)
  })
  it('compra em real segue criando a licença em português', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessaoUs({ currency: 'brl', amount_total: 480000, metadata: { atlas_tipo: 'implantacao', atlas_conta: CONTA } })))
    expect(m.store.licencas).toHaveLength(2)
    expect(m.store.licencas[1].idioma ?? 'pt').toBe('pt')
  })
})

describe('mensalidade segue o idioma da licença (M31)', () => {
  it('licença em inglês: US$ 70/mês; em português: R$ 200/mês', async () => {
    const m = montarPag()
    const lic = m.store.licencas[0]
    lic.conta_gateway_id = CONTA
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'mensalidade', licenca_id: lic.id })
    expect(corpoDe(m.chamadas[0]).get('line_items[0][price_data][currency]')).toBe('brl')
    await m.store.definirIdiomaLicenca(lic.id, 'en')
    lic.gateway_assinatura_ref = null
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'mensalidade', licenca_id: lic.id })
    const f = corpoDe(m.chamadas[1])
    expect(f.get('line_items[0][price_data][currency]')).toBe('usd')
    expect(f.get('line_items[0][price_data][unit_amount]')).toBe('7000')
  })
})
