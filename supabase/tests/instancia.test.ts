// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { H2, TOKEN } from './helpers.ts'
import { comDoisClientes } from './helpers-portal.ts'

async function preparar() {
  const m = await comDoisClientes()
  const c = m.ctx()
  const validar = (corpo: object, h: Record<string, string> = { 'X-Atlas-Dispositivo': TOKEN }) =>
    tratar(c, new Request('https://x.test/functions/v1/instancia/validar', { method: 'POST', headers: h, body: JSON.stringify(corpo) }))
  const pedido = (extra: object = {}) => ({ email: 'ana@loja.com', computador_hash: 'a'.repeat(64), ...extra })
  return { m, validar, pedido }
}

describe('/instancia/validar — trava single-tenant', () => {
  it('a instância do dono passa', async () => {
    const { validar, pedido } = await preparar()
    const r = await validar(pedido())
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
  })
  it('2ª instância (outro computador, mesma licença) é recusada', async () => {
    const { validar, pedido } = await preparar()
    const r = await validar(pedido({ computador_hash: H2 }))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: false, motivo: 'outra_instancia' })
  })
  it('licença cancelada não valida', async () => {
    const { m, validar, pedido } = await preparar()
    m.store.licencas[0].status = 'cancelada'
    expect(await (await validar(pedido())).json()).toEqual({ ok: false, motivo: 'licenca_invalida' })
  })
  it('alinha ao /verificar: pausada, atrasada (sem carência / vencida) e cortesia vencida negam; atrasada na carência passa', async () => {
    const neg = { ok: false, motivo: 'licenca_invalida' }
    const { m, validar, pedido } = await preparar()
    const lic = m.store.licencas[0] as unknown as Record<string, unknown>
    const agora = m.deps.agora().getTime()
    lic.status = 'pausada'
    expect(await (await validar(pedido())).json()).toEqual(neg)
    lic.status = 'atrasada'; lic.pausa_prevista_em = null
    expect(await (await validar(pedido())).json()).toEqual(neg)
    lic.pausa_prevista_em = new Date(agora - 60_000)
    expect(await (await validar(pedido())).json()).toEqual(neg)
    lic.pausa_prevista_em = new Date(agora + 86_400_000)
    expect(await (await validar(pedido())).json()).toEqual({ ok: true })
    lic.status = 'ativa'; lic.tipo = 'cortesia'; lic.validade_em = new Date(agora - 1000)
    expect(await (await validar(pedido())).json()).toEqual(neg)
    lic.validade_em = new Date(agora + 86_400_000)
    expect(await (await validar(pedido())).json()).toEqual({ ok: true })
  })
  it('corpo sem e-mail string: 403', async () => {
    const { validar, pedido } = await preparar()
    expect((await validar(pedido({ email: 123 }))).status).toBe(403)
    expect((await validar({ computador_hash: 'a'.repeat(64) })).status).toBe(403)
  })
  it('anti-IDOR: licenca_id no corpo é ignorado e token de outro dono não vale', async () => {
    const { validar, pedido } = await preparar()
    expect(await (await validar(pedido({ licenca_id: 'l2' }))).json()).toEqual({ ok: true })
    // e-mail do Beto + computador/token da Ana: 403, nunca valida
    expect((await validar(pedido({ email: 'beto@outra.com' }))).status).toBe(403)
  })
  it('sem auth: 403 (sem token, token errado, e-mail desconhecido)', async () => {
    const { validar, pedido } = await preparar()
    expect((await validar(pedido(), {})).status).toBe(403)
    expect((await validar(pedido(), { 'X-Atlas-Dispositivo': 'errado' })).status).toBe(403)
    expect((await validar(pedido({ email: 'x@y.com' }))).status).toBe(403)
    expect((await validar(pedido({ computador_hash: 'curto' }))).status).toBe(400)
  })
  it('limita a frequência por licença', async () => {
    const { validar, pedido } = await preparar()
    let ultimo = 200
    for (let i = 0; i < 125; i++) ultimo = (await validar(pedido())).status
    expect(ultimo).toBe(429)
  })
})
