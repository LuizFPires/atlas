// @vitest-environment node
// M31 — "real só com CPF" (Luiz, 26/11/2026): em real, só com CPF ou CNPJ válido; em dólar, não pede documento.
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { criarCheckout } from '../functions/_shared/pagamento/checkout.ts'
import { CONTA, montarPag } from './helpers-pagamento.ts'

const corpoDe = (c: { body?: string }) => new URLSearchParams(c.body)
const base = { conta_id: CONTA, tipo: 'implantacao' as const, email: 'ana@loja.com', aceite_termos_versao: '1.0' }

describe('checkout em real exige CPF ou CNPJ', () => {
  it('sem documento, ou inválido: recusa e explica (e nem abre a Stripe)', async () => {
    const m = montarPag()
    await expect(criarCheckout(m.deps, base)).rejects.toMatchObject({ codigo: 'documento_obrigatorio', message: expect.stringMatching(/CPF ou o CNPJ.*em dólar/) })
    await expect(criarCheckout(m.deps, { ...base, documento: '529.982.247-24' })).rejects.toMatchObject({ codigo: 'documento_obrigatorio' })
    expect(m.chamadas.length).toBe(0)
  })

  it('CPF ou CNPJ válido: abre o pagamento e o documento vai junto (só números) para a nota', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { ...base, documento: '529.982.247-25' })
    await criarCheckout(m.deps, { ...base, tipo: 'prateleira', segmento: 'barbearia', documento: '11.222.333/0001-81' })
    expect(corpoDe(m.chamadas[0]).get('metadata[atlas_documento]')).toBe('52998224725')
    expect(corpoDe(m.chamadas[1]).get('metadata[atlas_documento]')).toBe('11222333000181')
  })

  it('em dólar não pede documento', async () => {
    const m = montarPag()
    await criarCheckout(m.deps, { ...base, mercado: 'us' })
    expect(m.chamadas.length).toBe(1)
  })

  it('http: o campo documento chega ao checkout', async () => {
    const m = montarPag()
    const c = { deps: m.deps, pagamento: m.deps, carregarKit: async () => [], autorizarServico: () => false }
    const r = await tratar(c, new Request('https://x.test/pagamento/checkout', { method: 'POST', body: JSON.stringify({ conta_id: CONTA, tipo: 'implantacao', email: 'ana@loja.com', aceite_termos: true, versao_termos: '1.0', documento: '52998224725' }) }))
    expect(r.status).toBe(200)
  })
})
