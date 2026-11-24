// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { chamar, montarPortal } from './helpers-portal.ts'

// Bug (Luiz, 24/11/2026): quem tem cortesia pedia o código no celular e o e-mail não chegava (o envio padrão do Supabase Auth
// é limitado). Agora o código de ENTRADA é gerado pelo Auth (admin, sem mandar e-mail) e sai pelo mesmo envio dos outros e-mails do Atlas.
function montar(status: 'ativa' | 'cancelada' = 'ativa') {
  const m = montarPortal(status)
  const gerados: string[] = []
  const enviados: Array<{ email: string; codigo: string }> = []
  const portal = {
    ...m.deps,
    gerarCodigoEntrada: async (email: string) => { gerados.push(email); return '482913' },
    enviarCodigoEntrada: async (email: string, codigo: string) => { enviados.push({ email, codigo }) },
  }
  return { ...m, gerados, enviados, ctx2: () => m.ctx({ portal }) }
}

describe('portal — código de entrada (celular e /conta) pelo e-mail do Atlas', () => {
  it('cliente com licença (inclusive cortesia) recebe o código no e-mail da compra', async () => {
    const m = montar()
    const r = await chamar(m.ctx2(), '/portal/entrar/codigo', null, { email: '  Ana@Loja.com ' })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(m.enviados).toEqual([{ email: 'ana@loja.com', codigo: '482913' }])
  })

  it('e-mail que não é de cliente: responde igual (não revela) e não gera nem manda nada', async () => {
    const m = montar()
    const r = await chamar(m.ctx2(), '/portal/entrar/codigo', null, { email: 'ninguem@nada.com' })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(m.gerados).toEqual([])
    expect(m.enviados).toEqual([])
  })

  it('licença cancelada não recebe código', async () => {
    const m = montar('cancelada')
    await chamar(m.ctx2(), '/portal/entrar/codigo', null, { email: 'ana@loja.com' })
    expect(m.enviados.filter((e) => e.email === 'ana@loja.com')).toEqual([])
  })

  it('limita pedidos: muitos seguidos do mesmo lugar recebem 429 com recado simples', async () => {
    const m = montar()
    let ultimo: Response | null = null
    for (let i = 0; i < 12; i++) ultimo = await chamar(m.ctx2(), '/portal/entrar/codigo', null, { email: 'ana@loja.com' })
    expect(ultimo!.status).toBe(429)
    expect((await ultimo!.json()).mensagem).toMatch(/códigos demais/)
    expect(m.enviados.length).toBeLessThanOrEqual(5)
  })

  it('e-mail inválido: 400', async () => {
    const m = montar()
    expect((await chamar(m.ctx2(), '/portal/entrar/codigo', null, { email: 'sem-arroba' })).status).toBe(400)
  })
})
