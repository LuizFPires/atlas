// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { criarCheckout } from '../functions/_shared/pagamento/checkout.ts'
import { planoPrateleira } from '../functions/_shared/pagamento/config.ts'
import { processarWebhook } from '../functions/_shared/pagamento/webhook.ts'
import { assinarStripe, CONTA, evento, montarPag } from './helpers-pagamento.ts'

const corpoDe = (c: { body?: string }) => new URLSearchParams(c.body)
type M = ReturnType<typeof montarPag>
async function enviar(m: M, ev: object) {
  const corpo = JSON.stringify(ev)
  return processarWebhook(m.deps, CONTA, corpo, await assinarStripe(corpo))
}
const sessao = (extra: Record<string, unknown> = {}) => ({
  id: 'cs_p1', mode: 'payment', payment_status: 'paid', amount_total: 730000, currency: 'brl',
  metadata: { atlas_tipo: 'prateleira', atlas_segmento: 'barbearia', atlas_conta: CONTA }, customer: 'cus_p', payment_intent: 'pi_p1',
  customer_details: { email: 'Caio@Barba.com', name: 'Caio Lima' }, ...extra,
})

describe('checkout da prateleira (M32)', () => {
  it('à vista: R$ 7.300, Pix + cartão, metadata com tipo e segmento', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'prateleira', segmento: 'barbearia', email: 'Caio@Barba.com', aceite_termos_versao: '1.0', documento: '52998224725' })
    const f = corpoDe(m.chamadas[0])
    expect(f.get('line_items[0][price_data][unit_amount]')).toBe('730000')
    expect(f.get('payment_method_types[1]')).toBe('pix')
    expect(f.get('metadata[atlas_tipo]')).toBe('prateleira')
    expect(f.get('metadata[atlas_segmento]')).toBe('barbearia')
    expect(f.get('payment_intent_data[metadata][atlas_segmento]')).toBe('barbearia')
    expect(f.get('customer_email')).toBe('caio@barba.com')
  })
  it('parcelado com juros (6x): total do PMT e só cartão', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'prateleira', segmento: 'academia', parcelas: 6, email: 'a@b.co', aceite_termos_versao: '1.0', documento: '52998224725' })
    const f = corpoDe(m.chamadas[0])
    expect(f.get('line_items[0][price_data][unit_amount]')).toBe(String(Math.round(planoPrateleira(6).total * 100)))
    expect(f.get('payment_method_types[1]')).toBeNull()
  })
  it('segmento inválido ou ausente é recusado antes de abrir o pagamento', async () => {
    const m = montarPag()
    for (const segmento of [undefined, '', 'padaria']) {
      await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'prateleira', segmento, email: 'a@b.co', aceite_termos_versao: '1.0', documento: '52998224725' })).rejects.toMatchObject({ codigo: 'segmento_invalido' })
    }
    expect(m.chamadas).toHaveLength(0)
  })
})

describe('trava de integridade da prateleira (M32)', () => {
  it('à vista pagando R$ 7.300 concede a licença', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessao()))
    expect(m.store.licencas).toHaveLength(2)
    expect(m.store.pagamentos[0]).toMatchObject({ status: 'pago', valor: 7300, segmento: 'barbearia' })
  })
  it('segmento desconhecido no metadata não é gravado', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessao({ metadata: { atlas_tipo: 'prateleira', atlas_segmento: 'xpto', atlas_conta: CONTA } })))
    expect(m.store.pagamentos[0].segmento).toBeNull()
  })
  it('pagar o preço da implantação (R$ 4.800) numa sessão de prateleira NÃO concede', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessao({ amount_total: 480000 })))
    expect(m.store.licencas).toHaveLength(1)
    expect(m.store.pagamentos).toHaveLength(0)
  })
  it('10x pagando o preço sem juros NÃO concede; 4x pagando o total com juros concede', async () => {
    const m = montarPag()
    m.parcelasPorPi.set('pi_p1', 10)
    await enviar(m, evento('checkout.session.completed', sessao()))
    expect(m.store.licencas).toHaveLength(1)
    const m2 = montarPag()
    m2.parcelasPorPi.set('pi_p1', 4)
    await enviar(m2, evento('checkout.session.completed', sessao({ amount_total: Math.round(planoPrateleira(4).total * 100) })))
    expect(m2.store.licencas).toHaveLength(2)
  })
  it('tipo desconhecido no metadata é ignorado', async () => {
    const m = montarPag()
    await enviar(m, evento('checkout.session.completed', sessao({ metadata: { atlas_tipo: 'outro', atlas_conta: CONTA } })))
    expect(m.store.licencas).toHaveLength(1)
  })
})
