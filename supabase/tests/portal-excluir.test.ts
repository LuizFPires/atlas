// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { chamar, comDoisClientes, JWT_ANA, JWT_BETO, JWT_INTRUSO } from './helpers-portal.ts'

const preparar = async () => {
  const m = await comDoisClientes()
  await m.store.registrarConsentimento('ana@loja.com', '1.0', 'checkout', m.deps.agora())
  await m.store.registrarConsentimento('beto@outra.com', '1.0', 'checkout', m.deps.agora())
  m.store.clientes[0].nome_tratamento = 'Ana'
  Object.assign(m.store.clientes[0], { empresa: 'Loja da Ana', ramo: 'roupas' })
  await chamar(m.ctx(), '/portal/conta', JWT_ANA) // primeiro acesso liga o login ao cliente
  await chamar(m.ctx(), '/portal/conta', JWT_BETO)
  m.chamadas.length = 0
  return m
}

describe('portal — excluir conta (LGPD art. 18, VI)', () => {
  it('exige confirmar: true e login; sem isso nada é apagado', async () => {
    const m = await preparar()
    for (const corpo of [{}, { confirmar: 'true' }, { confirmar: false }]) {
      const r = await chamar(m.ctx(), '/portal/conta/excluir', JWT_ANA, corpo)
      expect(r.status).toBe(400)
    }
    expect((await chamar(m.ctx(), '/portal/conta/excluir', null, { confirmar: true })).status).toBe(401)
    expect((await chamar(m.ctx(), '/portal/conta/excluir', JWT_INTRUSO, { confirmar: true })).status).toBe(403)
    expect(m.store.clientes[0].email_compra).toBe('ana@loja.com')
    expect(m.removidosAuth).toEqual([])
  })

  it('anonimiza o cliente, apaga o pessoal, para a cobrança e remove o login — só de quem pediu', async () => {
    const m = await preparar()
    const r = await chamar(m.ctx(), '/portal/conta/excluir', JWT_ANA, { confirmar: true })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    const ana = m.store.clientes.find((c) => c.id === 'c1')!
    expect(ana).toMatchObject({ nome_tratamento: 'Conta excluída', empresa: null, ramo: null })
    expect(ana.email_compra).toBe('excluido+c1@anonimo.invalid')
    expect(ana.excluido_em).toBeInstanceOf(Date)
    expect(JSON.stringify(m.store)).not.toMatch(/ana@loja\.com|Loja da Ana/i)
    // licença cancelada e sem refs do gateway; computador apagado; pagamento mantido (obrigação fiscal)
    expect(m.store.licencas.find((l) => l.id === 'l1')).toMatchObject({ status: 'cancelada', gateway_assinatura_ref: null, gateway_cliente_ref: null })
    expect(m.store.ativacoes.filter((a) => a.licenca_id === 'l1')).toHaveLength(0)
    expect(m.store.pagamentos.find((p) => p.gateway_ref === 'pi_ana')?.status).toBe('pago')
    // consentimento fica, sem o e-mail
    expect(m.store.consentimentos.find((c) => c.cliente_id === 'c1')).toMatchObject({ versao_termos: '1.0', email: 'excluido+c1@anonimo.invalid' })
    // cobrança parada na conta Stripe do cliente (imediato) e login removido
    expect(m.chamadas.map((c) => `${c.method} ${c.url.replace('https://api.stripe.com', '')}`)).toEqual(['DELETE /v1/subscriptions/sub_ana'])
    expect(m.removidosAuth).toEqual(['auth-ana'])
    // o outro cliente não é tocado
    expect(m.store.clientes.find((c) => c.id === 'c2')).toMatchObject({ email_compra: 'beto@outra.com', nome_tratamento: 'Beto' })
    expect(m.store.licencas.find((l) => l.id === 'l2')?.status).toBe('ativa')
    expect(m.store.ativacoes.filter((a) => a.licenca_id === 'l2')).toHaveLength(1)
    // auditoria sem dado pessoal
    expect(m.store.ocorrencias.find((o) => o.tipo === 'conta_excluida')).toMatchObject({ cliente_id: null, resolvida: true })
  })

  it('cliente logado SEM licença também consegue excluir a conta (sem chamar o gateway)', async () => {
    const m = await preparar()
    m.store.licencas = m.store.licencas.filter((l) => l.cliente_id !== 'c1')
    // as demais rotas do portal continuam exigindo licença
    expect((await chamar(m.ctx(), '/portal/conta', JWT_ANA)).status).toBe(404)
    const r = await chamar(m.ctx(), '/portal/conta/excluir', JWT_ANA, { confirmar: true })
    expect(r.status).toBe(200)
    expect(m.store.clientes.find((c) => c.id === 'c1')).toMatchObject({ nome_tratamento: 'Conta excluída', empresa: null })
    expect(m.chamadas).toEqual([])
    expect(m.removidosAuth).toEqual(['auth-ana'])
  })

  it('depois de excluída, o mesmo login não abre mais nada no portal', async () => {
    const m = await preparar()
    await chamar(m.ctx(), '/portal/conta/excluir', JWT_ANA, { confirmar: true })
    m.sessoes.set(JWT_ANA, { auth_user_id: 'auth-ana', email: 'ana@loja.com' }) // JWT ainda não vencido
    for (const rota of ['/portal/eu', '/portal/conta', '/portal/reenviar-acesso']) {
      expect((await chamar(m.ctx(), rota, JWT_ANA)).status).toBe(401)
    }
  })

  it('fail-closed: gateway fora = nada é apagado e o erro é dito', async () => {
    const m = await preparar()
    m.store.contas[0].segredo_ref = 'sem-segredo'
    const r = await chamar(m.ctx(), '/portal/conta/excluir', JWT_ANA, { confirmar: true })
    expect(r.status).toBe(503)
    expect(m.store.clientes[0].email_compra).toBe('ana@loja.com')
    expect(m.store.clientes[0].excluido_em).toBeFalsy()
    expect(m.removidosAuth).toEqual([])
  })

  it('fail-closed: se o login não saiu do Auth, devolve erro (não finge) e repetir termina o serviço', async () => {
    const m = await preparar()
    m.falhaAuth.ligado = true
    const r = await chamar(m.ctx(), '/portal/conta/excluir', JWT_ANA, { confirmar: true })
    expect(r.status).toBe(502)
    expect((await r.json()).erro).toBe('login_nao_removido')
    m.falhaAuth.ligado = false
    const r2 = await chamar(m.ctx(), '/portal/conta/excluir', JWT_ANA, { confirmar: true })
    expect(r2.status).toBe(200)
    expect(m.removidosAuth).toEqual(['auth-ana'])
    expect(m.chamadas).toHaveLength(1) // a assinatura não é cancelada duas vezes
  })

  it('uma pessoa nova com o mesmo e-mail pode comprar de novo (a linha antiga não conflita)', async () => {
    const m = await preparar()
    await chamar(m.ctx(), '/portal/conta/excluir', JWT_ANA, { confirmar: true })
    expect(await m.store.clientePorEmail('ana@loja.com')).toBeNull()
  })
})
