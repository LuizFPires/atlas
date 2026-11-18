// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { criarCheckout } from '../functions/_shared/pagamento/checkout.ts'
import { codificarForm } from '../functions/_shared/pagamento/stripe-api.ts'
import { CONTA, montarPag, SK_TESTE } from './helpers-pagamento.ts'

const urls = {}
const corpoDe = (c: { body?: string }) => new URLSearchParams(c.body)

describe('checkout (Stripe do cliente)', () => {
  it('codifica objetos aninhados no formato da Stripe', () => {
    expect(codificarForm({ a: { b: [1, { c: 2 }] }, x: undefined }).join('&')).toBe('a%5Bb%5D%5B0%5D=1&a%5Bb%5D%5B1%5D%5Bc%5D=2')
  })

  it('implantação: pagamento único R$ 4.800 com Pix e cartão, usando a chave da conta do cliente', async () => {
    const m = montarPag()
    const r = await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'Ana@Loja.com', ...urls })
    expect(r.url).toContain('checkout.stripe.com')
    const c = m.chamadas[0]
    expect(c.url).toBe('https://api.stripe.com/v1/checkout/sessions')
    expect(c.headers.Authorization).toBe(`Bearer ${SK_TESTE}`)
    expect(c.headers['Idempotency-Key']).toBeTruthy()
    const f = corpoDe(c)
    expect(f.get('mode')).toBe('payment')
    expect(f.get('payment_method_types[0]')).toBe('card')
    expect(f.get('payment_method_types[1]')).toBe('pix')
    expect(f.get('line_items[0][price_data][unit_amount]')).toBe('480000')
    expect(f.get('line_items[0][price_data][currency]')).toBe('brl')
    expect(f.get('customer_email')).toBe('ana@loja.com')
    expect(f.get('metadata[atlas_tipo]')).toBe('implantacao')
  })

  it('mensalidade: assinatura mensal R$ 200 para licença da mesma conta, reaproveitando o customer', async () => {
    const m = montarPag()
    Object.assign(m.store.licencas[0], { conta_gateway_id: CONTA, gateway_cliente_ref: 'cus_1' })
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'mensalidade', licenca_id: 'l1', ...urls })
    const f = corpoDe(m.chamadas[0])
    expect(f.get('mode')).toBe('subscription')
    expect(f.get('customer')).toBe('cus_1')
    expect(f.get('line_items[0][price_data][recurring][interval]')).toBe('month')
    expect(f.get('line_items[0][price_data][unit_amount]')).toBe('20000')
    expect(f.get('subscription_data[metadata][atlas_licenca]')).toBe('l1')
  })

  it('recusa conta desconhecida, e-mail inválido, segredo ausente e licença de outra conta', async () => {
    const m = montarPag()
    await expect(criarCheckout(m.deps, { conta_id: 'x', tipo: 'implantacao', email: 'a@b.co', ...urls })).rejects.toMatchObject({ codigo: 'conta_desconhecida' })
    await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'nao-e-email', ...urls })).rejects.toMatchObject({ codigo: 'email_invalido' })
    await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'mensalidade', licenca_id: 'l1', ...urls })).rejects.toMatchObject({ codigo: 'sem_licenca' })
    m.store.contas.push({ id: 'sem-segredo', conta_stripe_id: 'acct_2', segredo_ref: 'NAO_EXISTE', modo: 'teste' })
    await expect(criarCheckout(m.deps, { conta_id: 'sem-segredo', tipo: 'implantacao', email: 'a@b.co', ...urls })).rejects.toMatchObject({ codigo: 'gateway_nao_configurado', status: 503 })
    expect(m.chamadas).toHaveLength(0)
  })

  it('falha da Stripe vira erro 502 amigável', async () => {
    const m = montarPag()
    m.falhar.proxima = true
    await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'a@b.co', ...urls })).rejects.toMatchObject({ codigo: 'gateway_erro', status: 502 })
  })
})
