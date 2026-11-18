// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clienteLogado } from '../functions/_shared/portal.ts'
import { chamar, comDoisClientes, JWT_ANA, JWT_BETO, JWT_INTRUSO, montarPortal } from './helpers-portal.ts'

describe('portal — login próprio (item 1)', () => {
  it('sem token, token inválido ou vazio: 401, sem dizer nada sobre clientes', async () => {
    const m = montarPortal()
    for (const jwt of [null, '', 'lixo']) {
      const r = await chamar(m.ctx(), '/portal/eu', jwt)
      expect(r.status).toBe(401)
    }
  })

  it('o serviço (token de serviço) NÃO vira login de cliente', async () => {
    const m = montarPortal()
    const r = await chamar(m.ctx({ autorizarServico: () => true }), '/portal/eu', 'qualquer-token-de-servico')
    expect(r.status).toBe(401)
  })

  it('primeiro acesso liga o login ao cliente pelo e-mail confirmado (sem diferenciar maiúsculas)', async () => {
    const m = montarPortal()
    const r = await chamar(m.ctx(), '/portal/eu', JWT_ANA)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ nome: 'Ana', empresa: '', email: 'ana@loja.com' })
    expect(m.store.clientes.find((c) => c.id === 'c1')?.auth_user_id).toBe('auth-ana')
    expect((await chamar(m.ctx(), '/portal/eu', JWT_ANA)).status).toBe(200) // segundo acesso: pelo vínculo
  })

  it('e-mail sem compra não entra, e a resposta é igual à de "compra de outro login"', async () => {
    const m = montarPortal()
    const sem = await chamar(m.ctx(), '/portal/eu', JWT_INTRUSO)
    expect(sem.status).toBe(403)
    // Beto já ligado a auth-beto; outro login com o MESMO e-mail do Beto não pode roubar o vínculo.
    await chamar(m.ctx(), '/portal/eu', JWT_BETO)
    m.sessoes.set('jwt-clone', { auth_user_id: 'auth-clone', email: 'beto@outra.com' })
    const clone = await chamar(m.ctx(), '/portal/eu', 'jwt-clone')
    expect(clone.status).toBe(403)
    expect(await clone.json()).toEqual(await sem.json())
  })

  it('a resposta nunca traz vínculo, hash nem referência do gateway', async () => {
    const m = montarPortal()
    const txt = JSON.stringify(await (await chamar(m.ctx(), '/portal/eu', JWT_ANA)).json())
    expect(txt).not.toMatch(/auth-|cus_|sub_|token|hash/)
  })

  it('limita rajadas por usuário', async () => {
    const m = montarPortal()
    let ultimo = 200
    for (let i = 0; i < 125; i++) ultimo = (await chamar(m.ctx(), '/portal/eu', JWT_ANA)).status
    expect(ultimo).toBe(429)
  })

  it('CORS do portal aceita o cabeçalho Authorization só da origem do site', async () => {
    const m = montarPortal()
    const { tratar } = await import('../functions/_shared/http.ts')
    const ok = await tratar(m.ctx({ origemWeb: 'https://site.test' }), new Request('https://x.test/portal/eu', { method: 'OPTIONS', headers: { Origin: 'https://site.test' } }))
    expect(ok.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    const mau = await tratar(m.ctx({ origemWeb: 'https://site.test' }), new Request('https://x.test/portal/eu', { method: 'OPTIONS', headers: { Origin: 'https://mau.test' } }))
    expect(mau.status).toBe(403)
  })

  it('clienteLogado devolve a licença do próprio cliente', async () => {
    const m = montarPortal()
    const s = await clienteLogado({ ...m.deps }, JWT_BETO)
    expect(s.cliente.id).toBe('c2')
    expect(s.licenca.id).toBe('l2')
  })
})

describe('portal — licença, pagamentos e computador (item 2)', () => {
  it('mostra a licença, os pagamentos e o computador ativo do cliente logado', async () => {
    const m = await comDoisClientes()
    m.avancar(3 * 24 * 3600_000)
    const r = await chamar(m.ctx(), '/portal/conta', JWT_ANA)
    expect(r.status).toBe(200)
    const c = await r.json()
    expect(c.perfil.email).toBe('ana@loja.com')
    expect(c.licenca).toMatchObject({ status: 'ativa', mensalidade_valor: 200, mensalidade_ativa: true, pode_cancelar_compra: true, pode_cancelar_mensalidade: true, pode_mudar_pagamento: true })
    expect(c.licenca.proxima_cobranca_em).toBe('2026-12-18T12:00:00.000Z')
    expect(c.licenca.arrependimento_ate).toBe('2026-11-25T12:00:00.000Z')
    expect(c.pagamentos).toEqual([{ data: '2026-11-18T12:00:00.000Z', descricao: 'Implantação do Atlas (curso, treinamento e licença)', valor: 4800, status: 'pago', tipo: 'implantacao' }])
    expect(c.computador).toEqual({ ativado_em: '2026-11-18T12:00:00.000Z' })
    expect(c.troca).toEqual({ pode_agora: true, proxima_troca_em: null })
  })

  it('NÃO vaza dados de outro cliente nem segredos: cada um vê só o seu', async () => {
    const m = await comDoisClientes()
    const ana = JSON.stringify(await (await chamar(m.ctx(), '/portal/conta', JWT_ANA)).json())
    const beto = JSON.stringify(await (await chamar(m.ctx(), '/portal/conta', JWT_BETO)).json())
    for (const txt of [ana, beto]) expect(txt).not.toMatch(/cus_|sub_|pi_|in_1|acct_|token|hash|SEGREDO|auth-|conta-1|STRIPE|sk_/i)
    expect(ana).toContain('ana@loja.com')
    expect(ana).not.toContain('beto')
    expect(beto).toContain('beto@outra.com')
    expect(beto).not.toContain('ana@')
  })

  it('o corpo da requisição nunca escolhe o dono (IDOR): ids e e-mail de outro são ignorados', async () => {
    const m = await comDoisClientes()
    const r = await chamar(m.ctx(), '/portal/conta', JWT_ANA, { licenca_id: 'l2', cliente_id: 'c2', email: 'beto@outra.com' })
    expect((await r.json()).perfil.email).toBe('ana@loja.com')
  })

  it('compra cancelada ou fora dos 7 dias: sem botão de arrependimento; mensalidade já cancelada: sem botão', async () => {
    const m = await comDoisClientes()
    m.avancar(8 * 24 * 3600_000)
    let c = await (await chamar(m.ctx(), '/portal/conta', JWT_ANA)).json()
    expect(c.licenca.pode_cancelar_compra).toBe(false)
    await m.store.atualizarLicencaSe('l1', { mensalidade_encerra_em: new Date('2026-12-05T00:00:00Z') }, {})
    c = await (await chamar(m.ctx(), '/portal/conta', JWT_ANA)).json()
    expect(c.licenca).toMatchObject({ mensalidade_ativa: false, pode_cancelar_mensalidade: false, proxima_cobranca_em: null, mensalidade_encerra_em: '2026-12-05T00:00:00.000Z' })
  })

  it('trocar forma de pagamento abre o portal de cobrança da conta Stripe do próprio cliente', async () => {
    const m = await comDoisClientes()
    const r = await chamar(m.ctx(), '/portal/forma-pagamento', JWT_ANA)
    expect(await r.json()).toEqual({ url: 'https://billing.stripe.com/p/session/bps_1' })
    const c = m.chamadas.at(-1)!
    expect(c.headers.Authorization).toBe('Bearer sk_test_fixture_da_conta_1')
    const f = new URLSearchParams(c.body)
    expect(f.get('customer')).toBe('cus_ana') // nunca o cus_beto
    expect(f.get('return_url')).toBe('https://loja.atlas.test/conta')
  })
})
