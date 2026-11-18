// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clienteLogado } from '../functions/_shared/portal.ts'
import { chamar, JWT_ANA, JWT_BETO, JWT_INTRUSO, montarPortal } from './helpers-portal.ts'

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
