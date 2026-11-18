// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { processarAtrasos } from '../functions/_shared/pagamento/atraso.ts'
import { cancelarCompra, cancelarMensalidade } from '../functions/_shared/pagamento/cancelamento.ts'
import { CONTA, montarPag, SK_TESTE } from './helpers-pagamento.ts'
import { H1, TOKEN } from './helpers.ts'
import { verificar } from '../functions/_shared/verificar.ts'

const DIA = 24 * 3600_000
const email = 'ana@loja.com'

/** Compra paga (implantação pi_1 + 1 mensalidade pi_m1) na conta do cliente, licença l1 ativada. */
async function cenario() {
  const m = montarPag()
  const agora = m.deps.agora()
  Object.assign(m.store.licencas[0], { conta_gateway_id: CONTA, gateway_cliente_ref: 'cus_1', gateway_assinatura_ref: 'sub_1', comprada_em: agora })
  await m.store.gravarPagamento({ licenca_id: 'l1', conta_gateway_id: CONTA, tipo: 'implantacao', valor: 4800, status: 'pago', gateway_ref: 'pi_1', gateway_pi: 'pi_1', pago_em: agora })
  await m.store.gravarPagamento({ licenca_id: 'l1', conta_gateway_id: CONTA, tipo: 'mensalidade', valor: 200, status: 'pago', gateway_ref: 'in_1', gateway_pi: 'pi_m1', pago_em: agora })
  await m.ativar(H1)
  const pode = async () => (await verificar(m.deps, { email, computador_hash: H1, token_dispositivo: TOKEN })).pode_construir
  return { m, pode }
}

describe('cancelar compra (arrependimento, 7 dias)', () => {
  it('dentro de 7 dias: cancela a assinatura, estorna tudo na conta do cliente e encerra a licença', async () => {
    const { m, pode } = await cenario()
    expect(await pode()).toBe(true)
    m.avancar(6 * DIA + 23 * 3600_000)
    expect(await cancelarCompra(m.deps, email)).toEqual({ ok: true, estornados: 2 })
    expect(m.store.licencas[0].status).toBe('cancelada')
    expect(m.store.pagamentos.every((p) => p.status === 'estornado')).toBe(true)
    const urls = m.chamadas.map((c) => `${c.method} ${c.url.replace('https://api.stripe.com', '')}`)
    expect(urls).toEqual(['DELETE /v1/subscriptions/sub_1', 'POST /v1/refunds', 'POST /v1/refunds'])
    expect(m.chamadas.every((c) => c.headers.Authorization === `Bearer ${SK_TESTE}`)).toBe(true)
    expect(new URLSearchParams(m.chamadas[1].body).get('payment_intent')).toBe('pi_1')
    expect(m.chamadas[1].headers['Idempotency-Key']).toBe('arrependimento-l1-pi_1')
    expect(m.store.ocorrencias.at(-1)?.tipo).toBe('compra_cancelada')
    expect(await pode()).toBe(false)
  })
  it('depois de 7 dias não estorna e orienta cancelar a mensalidade', async () => {
    const { m } = await cenario()
    m.avancar(7 * DIA + 1000)
    await expect(cancelarCompra(m.deps, email)).rejects.toMatchObject({ codigo: 'fora_do_prazo', status: 409 })
    expect(m.store.licencas[0].status).toBe('ativa')
    expect(m.chamadas).toHaveLength(0)
  })
  it('se o estorno falha na Stripe, nada muda no nosso lado e dá para tentar de novo', async () => {
    const { m } = await cenario()
    m.chamadas.length = 0
    let n = 0
    const original = m.deps.stripe
    m.deps.stripe = (sk) => {
      const api = original(sk)
      return { ...api, reembolsar: async (...a) => { if (++n === 1) throw new Error('rede'); return api.reembolsar(...a) } }
    }
    await expect(cancelarCompra(m.deps, email)).rejects.toThrow('rede')
    expect(m.store.licencas[0].status).toBe('ativa')
    expect(m.store.pagamentos.every((p) => p.status === 'pago')).toBe(true)
    expect(await cancelarCompra(m.deps, email)).toMatchObject({ ok: true })
    expect(m.store.licencas[0].status).toBe('cancelada')
  })
  it('já cancelada, sem compra paga e sem licença são recusadas', async () => {
    const { m } = await cenario()
    await cancelarCompra(m.deps, email)
    await expect(cancelarCompra(m.deps, email)).rejects.toMatchObject({ codigo: 'ja_cancelada' })
    m.store.licencas[0].status = 'ativa'
    m.store.licencas[0].comprada_em = null
    await expect(cancelarCompra(m.deps, email)).rejects.toMatchObject({ codigo: 'sem_compra_paga' })
    await expect(cancelarCompra(m.deps, 'ninguem@x.com')).rejects.toMatchObject({ codigo: 'sem_licenca', status: 404 })
  })
})

describe('cancelar mensalidade (sem fidelidade)', () => {
  it('em dia: para de cobrar já (fim do período) e a licença vale até lá; depois encerra', async () => {
    const { m, pode } = await cenario()
    m.avancar(30 * DIA) // fora do prazo de arrependimento, mas sem fidelidade
    const r = await cancelarMensalidade(m.deps, email)
    expect(r.encerra_em).toEqual(new Date('2026-12-05T00:00:00Z'))
    const c = m.chamadas[0]
    expect(c).toMatchObject({ method: 'POST' })
    expect(c.url).toContain('/v1/subscriptions/sub_1')
    expect(new URLSearchParams(c.body).get('cancel_at_period_end')).toBe('true')
    expect(m.store.licencas[0].status).toBe('ativa')
    expect(m.store.pagamentos.every((p) => p.status === 'pago')).toBe(true) // sem estorno
    expect(await pode()).toBe(true)
    await cancelarMensalidade(m.deps, email) // repetir não chama a Stripe de novo
    expect(m.chamadas).toHaveLength(1)
    m.avancar(5 * DIA) // já passou de 5/12? (18/11 + 30 + 5 = 23/12)
    expect(await processarAtrasos(m.deps)).toMatchObject({ encerradas: 1 })
    expect(m.store.licencas[0].status).toBe('cancelada')
    expect(await pode()).toBe(false)
  })
  it('em atraso: cancela na hora (nada pago para respeitar)', async () => {
    const { m } = await cenario()
    m.store.licencas[0].status = 'atrasada'
    m.store.licencas[0].pausa_prevista_em = new Date(m.deps.agora().getTime() + 3 * DIA)
    await cancelarMensalidade(m.deps, email)
    expect(m.chamadas[0].method).toBe('DELETE')
    expect(m.store.licencas[0].status).toBe('cancelada')
  })
  it('sem assinatura ou já cancelada são recusadas', async () => {
    const { m } = await cenario()
    m.store.licencas[0].gateway_assinatura_ref = null
    await expect(cancelarMensalidade(m.deps, email)).rejects.toMatchObject({ codigo: 'sem_mensalidade' })
    m.store.licencas[0].status = 'cancelada'
    await expect(cancelarMensalidade(m.deps, email)).rejects.toMatchObject({ codigo: 'ja_cancelada' })
  })
  it('licença sem conta de pagamento ligada dá 503 (nunca usa conta central)', async () => {
    const { m } = await cenario()
    m.store.licencas[0].conta_gateway_id = null
    await expect(cancelarMensalidade(m.deps, email)).rejects.toMatchObject({ codigo: 'gateway_nao_configurado', status: 503 })
    expect(m.chamadas).toHaveLength(0)
  })
})

describe('rotas HTTP de cancelamento', () => {
  it('exigem credencial de serviço', async () => {
    const { m } = await cenario()
    const c = { deps: m.deps, pagamento: m.deps, carregarKit: async () => [], autorizarServico: (r: Request) => r.headers.get('Authorization') === 'Bearer s' }
    const req = (rota: string, h: Record<string, string> = {}) => tratar(c, new Request(`https://x.test/functions/v1${rota}`, { method: 'POST', headers: h, body: JSON.stringify({ email }) }))
    expect((await req('/compra/cancelar')).status).toBe(401)
    expect((await req('/mensalidade/cancelar')).status).toBe(401)
    expect((await req('/mensalidade/cancelar', { Authorization: 'Bearer s' })).status).toBe(200)
    expect((await req('/compra/cancelar', { Authorization: 'Bearer s' })).status).toBe(200)
  })
})
