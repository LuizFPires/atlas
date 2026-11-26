// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { criarCheckout } from '../functions/_shared/pagamento/checkout.ts'
import { codificarForm } from '../functions/_shared/pagamento/stripe-api.ts'
import { CONTA, montarPag, SK_TESTE } from './helpers-pagamento.ts'

const urls = {}
const corpoDe = (c: { body?: string }) => new URLSearchParams(c.body)

describe('checkout (Stripe do cliente)', () => {
  it('codifica objetos aninhados no formato da Stripe', () => {
    expect(codificarForm({ a: { b: [1, { c: 2 }] }, x: undefined }).join('&')).toBe('a%5Bb%5D%5B0%5D=1&a%5Bb%5D%5B1%5D%5Bc%5D=2')
  })

  it('compra feita de dentro do app: a Stripe devolve o cliente à página "pode voltar para o Atlas", não ao cadastro', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'ana@loja.com', aceite_termos_versao: '1.0', documento: '52998224725', origem: 'app' })
    const f = corpoDe(m.chamadas[0])
    expect(f.get('success_url')).toBe('https://loja.atlas.test/compra/pelo-app')
    expect(f.get('cancel_url')).toBe('https://loja.atlas.test/compra/pelo-app/cancelada')
  })

  it('compra pelo site: retorno de sempre (cadastro)', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'ana@loja.com', aceite_termos_versao: '1.0', documento: '52998224725' })
    const f = corpoDe(m.chamadas[0])
    expect(f.get('success_url')).toBe('https://loja.atlas.test/compra/sucesso?session_id={CHECKOUT_SESSION_ID}')
    expect(f.get('cancel_url')).toBe('https://loja.atlas.test/compra/cancelada')
  })

  it('http: origem só vale quando é exatamente "app"', async () => {
    const m = montarPag()
    const c = { deps: m.deps, pagamento: m.deps, carregarKit: async () => [], autorizarServico: () => false }
    const pedir = (extra: object) => tratar(c, new Request('https://x.test/pagamento/checkout', { method: 'POST', body: JSON.stringify({ conta_id: CONTA, tipo: 'implantacao', email: 'ana@loja.com', aceite_termos: true, versao_termos: '1.0', documento: '52998224725', ...extra }) }))
    expect((await pedir({ origem: 'app' })).status).toBe(200)
    expect((await pedir({ origem: 'https://golpe.test' })).status).toBe(200)
    expect(corpoDe(m.chamadas[0]).get('success_url')).toBe('https://loja.atlas.test/compra/pelo-app')
    expect(corpoDe(m.chamadas[1]).get('success_url')).toBe('https://loja.atlas.test/compra/sucesso?session_id={CHECKOUT_SESSION_ID}')
  })

  it('implantação: pagamento único R$ 4.800 com Pix e cartão, usando a chave da conta do cliente', async () => {
    const m = montarPag()
    const r = await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'Ana@Loja.com', aceite_termos_versao: '1.0', documento: '52998224725', ...urls })
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

  it('não vaza sessao_id e duas chamadas com o mesmo e-mail geram sessões distintas', async () => {
    const m = montarPag()
    const a = await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'ana@loja.com', aceite_termos_versao: '1.0', documento: '52998224725' })
    const b = await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'ana@loja.com', aceite_termos_versao: '1.0', documento: '52998224725' })
    expect(Object.keys(a)).toEqual(['url'])
    expect(a).not.toHaveProperty('sessao_id')
    expect(m.chamadas[0].headers['Idempotency-Key']).not.toBe(m.chamadas[1].headers['Idempotency-Key'])
    expect(a.url).not.toBe(b.url)
    expect(new Set(m.store.sessoes.map((s) => s.sessao_id)).size).toBe(2)
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
    await expect(criarCheckout(m.deps, { conta_id: 'x', tipo: 'implantacao', email: 'a@b.co', aceite_termos_versao: '1.0', documento: '52998224725', ...urls })).rejects.toMatchObject({ codigo: 'conta_desconhecida' })
    await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'nao-e-email', aceite_termos_versao: '1.0', documento: '52998224725', ...urls })).rejects.toMatchObject({ codigo: 'email_invalido' })
    await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'mensalidade', licenca_id: 'l1', ...urls })).rejects.toMatchObject({ codigo: 'sem_licenca' })
    m.store.contas.push({ id: 'sem-segredo', conta_stripe_id: 'acct_2', segredo_ref: 'NAO_EXISTE', modo: 'teste' })
    await expect(criarCheckout(m.deps, { conta_id: 'sem-segredo', tipo: 'implantacao', email: 'a@b.co', aceite_termos_versao: '1.0', documento: '52998224725', ...urls })).rejects.toMatchObject({ codigo: 'gateway_nao_configurado', status: 503 })
    expect(m.chamadas).toHaveLength(0)
  })

  it('falha da Stripe vira erro 502 amigável', async () => {
    const m = montarPag()
    m.falhar.proxima = true
    await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'a@b.co', aceite_termos_versao: '1.0', documento: '52998224725', ...urls })).rejects.toMatchObject({ codigo: 'gateway_erro', status: 502 })
  })
})

describe('consentimento LGPD no checkout', () => {
  it('sem aceite (ou versão inválida) recusa, não abre pagamento e não grava nada', async () => {
    for (const v of [undefined, '', '   ', '1.0; drop table', 'x'.repeat(30)]) {
      const m = montarPag()
      await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'ana@loja.com', aceite_termos_versao: v, documento: '52998224725' })).rejects.toMatchObject({ codigo: 'aceite_obrigatorio', status: 400 })
      expect(m.chamadas).toHaveLength(0)
      expect(m.store.consentimentos).toHaveLength(0)
    }
  })
  it('com aceite grava versão + e-mail + data e só então abre o pagamento', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'Ana@Loja.com', aceite_termos_versao: '1.0', documento: '52998224725' })
    expect(m.store.consentimentos).toEqual([{ email: 'ana@loja.com', cliente_id: null, versao_termos: '1.0', origem: 'checkout', aceito_em: m.deps.agora() }])
    expect(m.chamadas).toHaveLength(1)
  })
  it('fail-closed: se o aceite não pôde ser gravado, o pagamento não é aberto', async () => {
    const m = montarPag()
    m.store.registrarConsentimento = async () => { throw new Error('banco fora') }
    await expect(criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'ana@loja.com', aceite_termos_versao: '1.0', documento: '52998224725' })).rejects.toThrow('banco fora')
    expect(m.chamadas).toHaveLength(0)
  })
  it('pela rota HTTP: só aceite_termos === true vale', async () => {
    for (const aceite of [false, 'true', undefined]) {
      const m = montarPag()
      const c = { deps: m.deps, pagamento: m.deps, carregarKit: async () => [], autorizarServico: () => false }
      const r = await tratar(c, new Request('https://x.test/pagamento/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conta_id: CONTA, tipo: 'implantacao', email: 'a@b.co', aceite_termos: aceite, versao_termos: '1.0', documento: '52998224725' }) }))
      expect(r.status).toBe(400)
      expect(m.chamadas).toHaveLength(0)
    }
  })
})

describe('checkout com a cara do Atlas', () => {
  it('toda sessão leva as cores e o nome do Atlas (fundo grafite, botão lima, cantos arredondados)', async () => {
    for (const tipo of ['implantacao', 'mensalidade'] as const) {
      const m = montarPag()
      Object.assign(m.store.licencas[0], { conta_gateway_id: CONTA, gateway_cliente_ref: 'cus_1' })
      await criarCheckout(m.deps, { conta_id: CONTA, tipo, email: 'ana@loja.com', aceite_termos_versao: '1.0', documento: '52998224725', licenca_id: 'l1', ...urls })
      const f = corpoDe(m.chamadas[0])
      expect(f.get('branding_settings[display_name]')).toBe('Atlas')
      expect(f.get('branding_settings[background_color]')).toBe('#141619')
      expect(f.get('branding_settings[button_color]')).toBe('#C6F135')
      expect(f.get('branding_settings[border_style]')).toBe('rounded')
      expect(f.get('branding_settings[font_family]')).toBe('inter')
    }
  })

  it('a criação da sessão fixa a versão da API que aceita branding_settings (não depende da versão padrão da conta)', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { conta_id: CONTA, tipo: 'implantacao', email: 'ana@loja.com', aceite_termos_versao: '1.0', documento: '52998224725', ...urls })
    expect(m.chamadas[0].headers['Stripe-Version']).toBe('2025-09-30.clover')
  })
})
