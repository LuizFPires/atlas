// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { chamar, comDoisClientes, JWT_ANA, JWT_BETO, JWT_INTRUSO } from './helpers-portal.ts'

const DIA = 24 * 3600_000
const urls = (m: Awaited<ReturnType<typeof comDoisClientes>>) => m.chamadas.map((c) => `${c.method} ${c.url.replace('https://api.stripe.com', '')}`)

describe('portal — cancelar compra e mensalidade (item 4)', () => {
  it('desistir da compra em 7 dias: estorna na conta do cliente e encerra SÓ a licença de quem pediu', async () => {
    const m = await comDoisClientes()
    m.avancar(5 * DIA)
    const r = await chamar(m.ctx(), '/portal/compra/cancelar', JWT_ANA, { confirmar: true })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, estornados: 1 })
    expect(m.store.licencas.find((l) => l.id === 'l1')?.status).toBe('cancelada')
    expect(m.store.licencas.find((l) => l.id === 'l2')?.status).toBe('ativa') // outro cliente intacto
    expect(m.store.pagamentos.find((p) => p.gateway_ref === 'pi_beto')?.status).toBe('pago')
    expect(urls(m)).toEqual(['DELETE /v1/subscriptions/sub_ana', 'POST /v1/refunds'])
    expect(new URLSearchParams(m.chamadas[1].body).get('payment_intent')).toBe('pi_ana')
    expect(m.chamadas.every((c) => c.headers.Authorization === 'Bearer sk_test_fixture_da_conta_1')).toBe(true)
  })

  it('depois dos 7 dias o servidor recusa (mesmo que alguém chame a rota direto)', async () => {
    const m = await comDoisClientes()
    m.avancar(8 * DIA)
    const r = await chamar(m.ctx(), '/portal/compra/cancelar', JWT_ANA, { confirmar: true })
    expect(r.status).toBe(409)
    expect((await r.json()).erro).toBe('fora_do_prazo')
    expect(m.chamadas).toHaveLength(0)
    expect(m.store.licencas.find((l) => l.id === 'l1')?.status).toBe('ativa')
  })

  it('cancelar mensalidade: para de cobrar e a licença vale até o fim do período pago', async () => {
    const m = await comDoisClientes()
    const r = await chamar(m.ctx(), '/portal/mensalidade/cancelar', JWT_ANA, { confirmar: true })
    expect(r.status).toBe(200)
    expect((await r.json()).encerra_em).toBe('2026-12-05T00:00:00.000Z')
    expect(urls(m)).toEqual(['POST /v1/subscriptions/sub_ana'])
    expect(new URLSearchParams(m.chamadas[0].body).get('cancel_at_period_end')).toBe('true')
    const l = m.store.licencas.find((x) => x.id === 'l1')!
    expect(l.status).toBe('ativa')
    expect(l.mensalidade_encerra_em).toEqual(new Date('2026-12-05T00:00:00Z'))
    expect(m.store.licencas.find((x) => x.id === 'l2')?.mensalidade_encerra_em ?? null).toBeNull()
    const c = await (await chamar(m.ctx(), '/portal/conta', JWT_ANA)).json()
    expect(c.licenca).toMatchObject({ pode_cancelar_mensalidade: false, proxima_cobranca_em: null })
  })

  it('sem confirmar: true não cancela nada', async () => {
    const m = await comDoisClientes()
    for (const corpo of [{}, { confirmar: 'true' }, { confirmar: 1 }, { confirmar: false }]) {
      for (const rota of ['/portal/compra/cancelar', '/portal/mensalidade/cancelar']) {
        expect((await chamar(m.ctx(), rota, JWT_ANA, corpo)).status).toBe(400)
      }
    }
    expect(m.chamadas).toHaveLength(0)
  })

  it('IDOR: e-mail, licença ou cliente no corpo são ignorados; quem cancela é sempre o dono do login', async () => {
    const m = await comDoisClientes()
    const r = await chamar(m.ctx(), '/portal/compra/cancelar', JWT_ANA, { confirmar: true, email: 'beto@outra.com', licenca_id: 'l2', cliente_id: 'c2', pagamento_id: 'pi_beto' })
    expect(r.status).toBe(200)
    expect(m.store.licencas.find((l) => l.id === 'l1')?.status).toBe('cancelada')
    expect(m.store.licencas.find((l) => l.id === 'l2')?.status).toBe('ativa')
    expect(urls(m).join(' ')).not.toMatch(/beto/)
    expect(m.chamadas.map((c) => c.body ?? '').join(' ')).not.toMatch(/pi_beto/)
  })

  it('sem login, com login de quem não comprou ou com o token de serviço: nada acontece', async () => {
    const m = await comDoisClientes()
    for (const jwt of [null, 'lixo', JWT_INTRUSO]) {
      for (const rota of ['/portal/compra/cancelar', '/portal/mensalidade/cancelar']) {
        const r = await chamar(m.ctx({ autorizarServico: () => true }), rota, jwt, { confirmar: true, email: 'ana@loja.com' })
        expect([401, 403]).toContain(r.status)
      }
    }
    expect(m.chamadas).toHaveLength(0)
    expect(m.store.licencas.every((l) => l.status === 'ativa')).toBe(true)
  })

  it('o Beto cancela a dele sem tocar na da Ana', async () => {
    const m = await comDoisClientes()
    expect((await chamar(m.ctx(), '/portal/mensalidade/cancelar', JWT_BETO, { confirmar: true })).status).toBe(200)
    expect(m.store.licencas.find((l) => l.id === 'l1')?.mensalidade_encerra_em ?? null).toBeNull()
    expect(urls(m)).toEqual(['POST /v1/subscriptions/sub_beto'])
  })

  it('repetir é seguro: compra já cancelada responde 409 e não estorna de novo', async () => {
    const m = await comDoisClientes()
    await chamar(m.ctx(), '/portal/compra/cancelar', JWT_ANA, { confirmar: true })
    const n = m.chamadas.length
    const r = await chamar(m.ctx(), '/portal/compra/cancelar', JWT_ANA, { confirmar: true })
    expect(r.status).toBe(409)
    expect(m.chamadas).toHaveLength(n)
  })

  it('gateway fora do ar: avisa, não muda nada e dá para tentar de novo', async () => {
    const m = await comDoisClientes()
    m.falhar.proxima = true
    const r = await chamar(m.ctx(), '/portal/compra/cancelar', JWT_ANA, { confirmar: true })
    expect(r.status).toBe(502)
    expect(m.store.licencas.find((l) => l.id === 'l1')?.status).toBe('ativa')
    expect((await chamar(m.ctx(), '/portal/compra/cancelar', JWT_ANA, { confirmar: true })).status).toBe(200)
  })
})
