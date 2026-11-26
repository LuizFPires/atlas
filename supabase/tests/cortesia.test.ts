// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { lerEmailsAdmin } from '../functions/_shared/admin.ts'
import { montarCortesia } from '../functions/_shared/emails.ts'
import { verificar } from '../functions/_shared/verificar.ts'
import { chamar, comDoisClientes, JWT_ANA } from './helpers-portal.ts'
import { H1, montar, TOKEN } from './helpers.ts'
import { assinarStripe, CONTA, evento, montarPag } from './helpers-pagamento.ts'
import { processarWebhook } from '../functions/_shared/pagamento/webhook.ts'

const JWT_LUIZ = 'jwt-luiz'
const DIA = 24 * 3600_000

async function montarAdmin() {
  const m = await comDoisClientes()
  m.sessoes.set(JWT_LUIZ, { auth_user_id: 'auth-luiz', email: 'luiz@atlas.com' })
  const admin = { ...m.deps, autenticarPortal: m.deps.autenticarPortal, emailsAdmin: lerEmailsAdmin('luiz@atlas.com') }
  const em = (dias: number) => new Date(m.deps.agora().getTime() + dias * DIA).toISOString()
  const liberar = (corpo: object) => chamar(m.ctx({ admin }), '/admin/cortesia', JWT_LUIZ, corpo)
  return { ...m, admin, em, liberar }
}

describe('cortesia — liberar pelo painel', () => {
  it('cria cliente e licença de cortesia (e-mail normalizado), grava auditoria e é idempotente', async () => {
    const a = await montarAdmin()
    const r = await a.liberar({ email: '  Novo@Amigo.COM ', validade_em: a.em(10), nome: 'Novo' })
    expect(r.status).toBe(200)
    const cli = a.store.clientes.find((c) => c.email_compra === 'novo@amigo.com')
    expect(cli).toBeTruthy()
    const lic = a.store.licencas.find((l) => l.cliente_id === cli!.id)!
    expect(lic).toMatchObject({ tipo: 'cortesia', status: 'ativa' })
    expect(lic.validade_em!.toISOString()).toBe(a.em(10))
    expect(a.store.ocorrencias.some((o) => o.tipo === 'cortesia' && o.autor === 'luiz@atlas.com')).toBe(true)
    // de novo: renova a mesma licença, não duplica
    const n = a.store.licencas.length
    expect((await a.liberar({ email: 'novo@amigo.com', validade_em: a.em(15) })).status).toBe(200)
    expect(a.store.licencas).toHaveLength(n)
    expect(a.store.licencas.find((l) => l.id === lic.id)!.validade_em!.toISOString()).toBe(a.em(15))
  })

  it('renovar uma cortesia vencida/cancelada a reativa', async () => {
    const a = await montarAdmin()
    await a.liberar({ email: 'x@y.com', validade_em: a.em(5) })
    const lic = a.store.licencas.find((l) => l.tipo === 'cortesia')!
    lic.status = 'cancelada'
    await a.liberar({ email: 'x@y.com', validade_em: a.em(20) })
    expect(a.store.licencas.find((l) => l.id === lic.id)!.status).toBe('ativa')
  })

  it('valida no servidor: e-mail, vencimento no passado, longe demais, tipos errados', async () => {
    const a = await montarAdmin()
    const antes = a.store.licencas.length
    const casos: Array<[object, string]> = [
      [{ email: 'sem-arroba', validade_em: a.em(5) }, 'email_invalido'],
      [{ email: ['a@b.com'], validade_em: a.em(5) }, 'email_invalido'],
      [{ email: 'a@b.com', validade_em: a.em(-1) }, 'validade_no_passado'],
      [{ email: 'a@b.com', validade_em: a.em(181) }, 'validade_longe_demais'],
      [{ email: 'a@b.com', validade_em: 'amanhã' }, 'validade_invalida'],
      [{ email: 'a@b.com' }, 'validade_invalida'],
    ]
    for (const [corpo, erro] of casos) {
      const r = await a.liberar(corpo)
      expect(r.status, erro).toBe(400)
      expect((await r.json()).erro).toBe(erro)
    }
    expect((await a.liberar({ email: 'a@b.com', validade_em: a.em(180) })).status).toBe(200)
    expect(a.store.licencas).toHaveLength(antes + 1)
  })

  it('quem já tem licença paga não é alterado (409) e cliente comum não consegue liberar', async () => {
    const a = await montarAdmin()
    const ana = a.store.licencas.find((l) => l.cliente_id === a.store.clientes.find((c) => c.email_compra === 'ana@loja.com')!.id)!
    const r = await a.liberar({ email: 'ana@loja.com', validade_em: a.em(10) })
    expect(r.status).toBe(409)
    const depois = a.store.licencas.find((l) => l.id === ana.id)!
    expect(depois.tipo).toBeUndefined()
    expect(depois.validade_em).toBeUndefined()
    expect((await chamar(a.ctx({ admin: a.admin }), '/admin/cortesia', JWT_ANA, { email: 'z@z.com', validade_em: a.em(5) })).status).toBe(403)
  })
})

describe('cortesia — listar e estender', () => {
  const listar = (a: Awaited<ReturnType<typeof montarAdmin>>, jwt = JWT_LUIZ) => chamar(a.ctx({ admin: a.admin }), '/admin/cortesias', jwt)

  it('lista só as cortesias em vigor (exclui vencida, paga e cancelada) e só com e-mail, nome e validade', async () => {
    const a = await montarAdmin()
    await a.liberar({ email: 'vigor@x.com', validade_em: a.em(10), nome: 'Vigor' })
    await a.liberar({ email: 'vencida@x.com', validade_em: a.em(5) })
    await a.liberar({ email: 'cancelada@x.com', validade_em: a.em(5) })
    const cli = (e: string) => a.store.clientes.find((c) => c.email_compra === e)!
    const lic = (e: string) => a.store.licencas.find((l) => l.cliente_id === cli(e).id)!
    lic('vencida@x.com').validade_em = new Date(a.deps.agora().getTime() - 1000)
    lic('cancelada@x.com').status = 'cancelada'
    const r = await listar(a)
    expect(r.status).toBe(200)
    const corpo = await r.json()
    expect(corpo.cortesias).toEqual([{ email: 'vigor@x.com', nome: 'Vigor', validade_em: a.em(10) }])
    expect(Object.keys(corpo.cortesias[0]).sort()).toEqual(['email', 'nome', 'validade_em'])
  })

  it('não-admin recebe 403', async () => {
    const a = await montarAdmin()
    expect((await listar(a, JWT_ANA)).status).toBe(403)
  })

  it('estender (liberar de novo) muda só a validade e a lista mostra a nova data', async () => {
    const a = await montarAdmin()
    await a.liberar({ email: 'amigo@x.com', validade_em: a.em(5) })
    const n = a.store.licencas.length
    const r = await a.liberar({ email: 'amigo@x.com', validade_em: a.em(12) })
    expect((await r.json()).nova).toBe(false)
    expect(a.store.licencas).toHaveLength(n)
    expect((await (await listar(a)).json()).cortesias).toEqual([expect.objectContaining({ email: 'amigo@x.com', validade_em: a.em(12) })])
  })
})

describe('cortesia — e-mail com link de instalação', () => {
  type Envio = { email: string; token: string; expira_em: Date; validade_em: Date }
  async function comEmail(falha = false) {
    const m = await comDoisClientes()
    m.sessoes.set(JWT_LUIZ, { auth_user_id: 'auth-luiz', email: 'luiz@atlas.com' })
    const enviados: Envio[] = []
    const admin = {
      ...m.deps,
      emailsAdmin: lerEmailsAdmin('luiz@atlas.com'),
      enviarCortesia: async (email: string, d: Omit<Envio, 'email'>) => { if (falha) throw new Error('smtp fora do ar'); enviados.push({ email, ...d }) },
    }
    const em = (dias: number) => new Date(m.deps.agora().getTime() + dias * DIA).toISOString()
    const ch = (rota: string, corpo: object) => chamar(m.ctx({ admin }), rota, JWT_LUIZ, corpo)
    return { ...m, enviados, em, ch }
  }

  it('liberar envia o e-mail com link de uso único e devolve email_enviado: true', async () => {
    const a = await comEmail()
    const antes = a.store.links.length
    const r = await a.ch('/admin/cortesia', { email: 'Novo@Amigo.com', validade_em: a.em(10) })
    expect(r.status).toBe(200)
    expect((await r.json()).email_enviado).toBe(true)
    expect(a.enviados).toHaveLength(1)
    expect(a.enviados[0].email).toBe('novo@amigo.com')
    expect(a.enviados[0].token.length).toBeGreaterThan(20)
    expect(a.enviados[0].validade_em.toISOString()).toBe(a.em(10))
    expect(a.store.links).toHaveLength(antes + 1)
  })

  it('estender em silêncio renova a validade sem gerar link nem mandar e-mail; sem o flag, envia', async () => {
    const a = await comEmail()
    await a.ch('/admin/cortesia', { email: 'novo@amigo.com', validade_em: a.em(10) })
    expect(a.enviados).toHaveLength(1)
    const links = a.store.links.length
    const r = await a.ch('/admin/cortesia', { email: 'novo@amigo.com', validade_em: a.em(20), silencioso: true })
    const j = await r.json()
    expect(r.status).toBe(200)
    expect(j.nova).toBe(false)
    expect(j.email_enviado).toBe(false)
    expect(a.enviados).toHaveLength(1)
    expect(a.store.links).toHaveLength(links)
    // as validações continuam valendo no modo silencioso
    expect((await a.ch('/admin/cortesia', { email: 'novo@amigo.com', validade_em: a.em(400), silencioso: true })).status).toBe(400)
    // valor que não é o booleano true não silencia
    await a.ch('/admin/cortesia', { email: 'novo@amigo.com', validade_em: a.em(21), silencioso: 'true' })
    expect(a.enviados).toHaveLength(2)
  })

  it('o link novo substitui o anterior (só o mais novo vale) e o e-mail leva o nome de quem recebe', async () => {
    const a = await comEmail()
    await a.ch('/admin/cortesia', { email: 'novo@amigo.com', validade_em: a.em(10), nome: 'Guilherme Souza' })
    await a.ch('/admin/cortesia/reenviar', { email: 'novo@amigo.com' })
    const abertos = a.store.links.filter((l: { usado_em: Date | null }) => !l.usado_em)
    const doCliente = abertos.filter((l: { cliente_id: string }) => l.cliente_id === a.store.links.at(-1)!.cliente_id)
    expect(doCliente).toHaveLength(1)
    expect((a.enviados[0] as { nome?: string }).nome).toBe('Guilherme Souza')
  })

  it('reenviar manda de novo com um link novo; sem cortesia ativa dá 404', async () => {
    const a = await comEmail()
    await a.ch('/admin/cortesia', { email: 'novo@amigo.com', validade_em: a.em(10) })
    const r = await a.ch('/admin/cortesia/reenviar', { email: 'novo@amigo.com' })
    expect(r.status).toBe(200)
    expect((await r.json()).email_enviado).toBe(true)
    expect(a.enviados).toHaveLength(2)
    expect(a.enviados[1].token).not.toBe(a.enviados[0].token)
    expect((await a.ch('/admin/cortesia/reenviar', { email: 'ninguem@x.com' })).status).toBe(404)
    expect((await a.ch('/admin/cortesia/reenviar', { email: 'ana@loja.com' })).status).toBe(404) // paga, não é cortesia
    expect((await chamar(a.ctx({ admin: { ...a.deps, emailsAdmin: lerEmailsAdmin('luiz@atlas.com') } }), '/admin/cortesia/reenviar', JWT_ANA, { email: 'novo@amigo.com' })).status).toBe(403)
  })

  it('falha no envio NÃO quebra a liberação: licença criada e email_enviado: false (sem vazar o erro)', async () => {
    const a = await comEmail(true)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await a.ch('/admin/cortesia', { email: 'novo@amigo.com', validade_em: a.em(10) })
    expect(r.status).toBe(200)
    const corpo = await r.json()
    expect(corpo.email_enviado).toBe(false)
    expect(JSON.stringify(corpo)).not.toContain('smtp')
    // log: só etapa e nome do erro; nada de mensagem, token, chave ou e-mail
    const logado = log.mock.calls.map((c) => c.join(' ')).join('\n')
    log.mockRestore()
    expect(logado).toContain('cortesia_email_falhou etapa=enviar erro=Error')
    expect(logado).not.toMatch(/smtp|novo@amigo|re_|RESEND|token/i)
    const link = a.store.links[a.store.links.length - 1] as unknown as Record<string, unknown>
    for (const v of Object.values(link)) if (typeof v === 'string' && v.length > 20) expect(logado).not.toContain(v)
    const cli = a.store.clientes.find((c) => c.email_compra === 'novo@amigo.com')!
    expect(a.store.licencas.find((l) => l.cliente_id === cli.id)).toMatchObject({ tipo: 'cortesia', status: 'ativa' })
    const re = await a.ch('/admin/cortesia/reenviar', { email: 'novo@amigo.com' })
    expect(re.status).toBe(200)
    expect((await re.json()).email_enviado).toBe(false)
  })
})

describe('cortesia — link para copiar (mandar pelo WhatsApp se o e-mail cair no spam)', () => {
  async function comLink(falha = false) {
    const m = await comDoisClientes()
    m.sessoes.set(JWT_LUIZ, { auth_user_id: 'auth-luiz', email: 'luiz@atlas.com' })
    const enviados: { token: string }[] = []
    const admin = {
      ...m.deps,
      emailsAdmin: lerEmailsAdmin('luiz@atlas.com'),
      linkInstalar: (token: string) => `https://atlas.test/instalar?t=${encodeURIComponent(token)}`,
      enviarCortesia: async (_e: string, d: { token: string }) => { if (falha) throw new Error('smtp fora do ar'); enviados.push(d) },
    }
    const em = (dias: number) => new Date(m.deps.agora().getTime() + dias * DIA).toISOString()
    const ch = (rota: string, corpo: object) => chamar(m.ctx({ admin }), rota, JWT_LUIZ, corpo)
    return { ...m, enviados, em, ch }
  }

  it('liberar e reenviar devolvem ao gestor o MESMO link que foi no e-mail (o mais novo, que é o que vale)', async () => {
    const a = await comLink()
    const j = await (await a.ch('/admin/cortesia', { email: 'dudu@gmail.com', validade_em: a.em(10) })).json()
    expect(j.link).toBe(`https://atlas.test/instalar?t=${encodeURIComponent(a.enviados[0].token)}`)
    const r = await (await a.ch('/admin/cortesia/reenviar', { email: 'dudu@gmail.com' })).json()
    expect(r.link).toBe(`https://atlas.test/instalar?t=${encodeURIComponent(a.enviados[1].token)}`)
  })

  it('e-mail fora do ar: o link vem mesmo assim (o gestor manda por outro caminho)', async () => {
    const a = await comLink(true)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const j = await (await a.ch('/admin/cortesia', { email: 'dudu@gmail.com', validade_em: a.em(10) })).json()
    log.mockRestore()
    expect(j.email_enviado).toBe(false)
    expect(j.link).toMatch(/^https:\/\/atlas\.test\/instalar\?t=.{20,}/)
  })

  it('estender em silêncio não gera link nem devolve link', async () => {
    const a = await comLink()
    await a.ch('/admin/cortesia', { email: 'dudu@gmail.com', validade_em: a.em(10) })
    const j = await (await a.ch('/admin/cortesia', { email: 'dudu@gmail.com', validade_em: a.em(20), silencioso: true })).json()
    expect(j.link ?? null).toBeNull()
  })
})

describe('cortesia — texto do e-mail', () => {
  it('destaca a validade em dd/mm/aaaa e avisa que acaba sozinho; traz o link', () => {
    const m = montarCortesia({ validade_em: new Date('2026-12-05T20:00:00Z'), link: 'https://x.test/instalar?t=abc', link_expira_em: new Date('2026-11-23T12:00:00Z') })
    for (const t of [m.texto, m.html]) {
      expect(t).toContain('05/12/2026')
      expect(t).toContain('acaba sozinho')
      expect(t).toContain('https://x.test/instalar?t=abc')
    }
  })
})

describe('cortesia — /verificar', () => {
  const arg = { email: 'ana@loja.com', computador_hash: H1, token_dispositivo: TOKEN }
  async function comCortesia(dias: number) {
    const m = montar()
    await m.ativar()
    Object.assign(m.store.licencas[0], { tipo: 'cortesia', validade_em: new Date(m.deps.agora().getTime() + dias * DIA) })
    return m
  }
  it('antes da validade libera; depois, nega com cortesia_expirada e encerra a licença', async () => {
    const m = await comCortesia(10)
    expect(await verificar(m.deps, arg)).toMatchObject({ pode_construir: true, motivo: 'ok' })
    m.avancar(10 * DIA + 1)
    expect(await verificar(m.deps, arg)).toMatchObject({ pode_construir: false, motivo: 'cortesia_expirada', licenca_id: 'l1' })
    expect(m.store.licencas[0].status).toBe('cancelada')
    expect((await verificar(m.deps, arg)).pode_construir).toBe(false)
  })
  it('cortesia sem prazo é tratada como vencida (fail-closed)', async () => {
    const m = await comCortesia(10)
    m.store.licencas[0].validade_em = null
    expect(await verificar(m.deps, arg)).toMatchObject({ pode_construir: false, motivo: 'cortesia_expirada' })
  })
  it('licença paga não muda: validade_em é ignorada e o caminho de sempre vale', async () => {
    const m = montar()
    await m.ativar()
    m.store.licencas[0].validade_em = new Date(m.deps.agora().getTime() - DIA) // lixo numa paga não derruba
    expect(await verificar(m.deps, arg)).toMatchObject({ pode_construir: true, motivo: 'ok' })
    m.store.licencas[0].tipo = 'paga'
    expect(await verificar(m.deps, arg)).toMatchObject({ pode_construir: true, motivo: 'ok' })
  })
})

describe('cortesia x compra — mesmo e-mail, um só cliente/licença (lock unificado, migration 0014)', () => {
  const dados = (m: Awaited<ReturnType<typeof montar>>) => ({ agora: m.deps.agora(), validade_em: new Date(m.deps.agora().getTime() + 10 * DIA) })

  it('cortesia e depois compra: compra vê a licença da cortesia, sem duplicar', async () => {
    const m = montar()
    const { agora, validade_em } = dados(m)
    await m.store.criarCortesia({ email: 'dup@x.com', nome: 'Dup', validade_em, agora })
    const r = await m.store.criarCompra({ email: 'dup@x.com', nome: 'Dup', agora, valor: 100, conta_gateway_id: 'c1', gateway_cliente_ref: 'cus' } as never)
    expect(r.nova).toBe(false)
    expect(m.store.clientes.filter((c) => c.email_compra === 'dup@x.com')).toHaveLength(1)
    expect(m.store.licencas.filter((l) => l.cliente_id === r.licenca.cliente_id)).toHaveLength(1)
  })

  it('compra e depois cortesia: cortesia não mexe na paga e não duplica', async () => {
    const m = montar()
    const { agora, validade_em } = dados(m)
    await m.store.criarCompra({ email: 'dup2@x.com', nome: 'Dup', agora, valor: 100, conta_gateway_id: 'c1', gateway_cliente_ref: 'cus' } as never)
    const r = await m.store.criarCortesia({ email: 'dup2@x.com', nome: 'Dup', validade_em, agora })
    expect(r.resultado).toBe('ja_tem_paga')
    expect(m.store.clientes.filter((c) => c.email_compra === 'dup2@x.com')).toHaveLength(1)
    expect(m.store.licencas.filter((l) => l.cliente_id === r.licenca.cliente_id)).toHaveLength(1)
  })

  it('a migration 0014 usa a MESMA chave de lock nas duas funções', async () => {
    const mod = (n: string): Promise<unknown> => import(/* @vite-ignore */ n)
    const fs = (await mod('node:fs')) as { readFileSync(p: string, e: string): string }
    const { fileURLToPath } = (await mod('node:url')) as { fileURLToPath(u: string | URL): string }
    const sql = fs.readFileSync(fileURLToPath(new URL('../migrations/0014_cortesia_lock_unificado.sql', import.meta.url)), 'utf8')
    const chave = "hashtextextended('cliente:' || lower(trim(p_email)), 0)"
    expect(sql.split(chave)).toHaveLength(3)
    expect(sql).not.toMatch(/'compra:'|'cortesia:'/)
  })
})

describe('cortesia -> compra: a compra converte a cortesia em paga (migration 0015)', () => {
  it('store: vira paga, sem validade, 1 cliente e 1 licença', async () => {
    const m = montar()
    const agora = m.deps.agora()
    await m.store.criarCortesia({ email: 'conv@x.com', nome: 'Conv', validade_em: new Date(agora.getTime() + 10 * DIA), agora })
    const r = await m.store.criarCompra({ email: 'conv@x.com', nome: 'Conv', agora, valor: 100, conta_gateway_id: 'c1', gateway_cliente_ref: 'cus' } as never)
    expect(r.licenca).toMatchObject({ tipo: 'paga', validade_em: null, status: 'ativa', conta_gateway_id: 'c1' })
    expect(m.store.clientes.filter((c) => c.email_compra === 'conv@x.com')).toHaveLength(1)
    expect(m.store.licencas.filter((l) => l.cliente_id === r.licenca.cliente_id)).toHaveLength(1)
  })

  it('webhook: grava o pagamento sem 409 conta_divergente e a licença segue válida após a validade antiga', async () => {
    const m = montarPag()
    const agora = m.deps.agora()
    await m.store.criarCortesia({ email: 'bia@padaria.com', nome: 'Bia', validade_em: new Date(agora.getTime() + 2 * DIA), agora })
    const ev = evento('checkout.session.completed', {
      id: 'cs_1', mode: 'payment', payment_status: 'paid', amount_total: 480000, currency: 'brl', metadata: { atlas_tipo: 'implantacao', atlas_conta: CONTA },
      customer: 'cus_1', payment_intent: 'pi_1', customer_details: { email: 'Bia@Padaria.com', name: 'Bia Souza' },
    })
    const corpo = JSON.stringify(ev)
    await expect(processarWebhook(m.deps, CONTA, corpo, await assinarStripe(corpo))).resolves.not.toThrow()
    expect(m.store.pagamentos.filter((p) => p.gateway_pi === 'pi_1')).toHaveLength(1)
    const lics = m.store.licencas.filter((l) => l.cliente_id === m.store.clientes.find((c) => c.email_compra === 'bia@padaria.com')!.id)
    expect(lics).toHaveLength(1)
    expect(lics[0]).toMatchObject({ tipo: 'paga', validade_em: null, conta_gateway_id: CONTA })
  })

  it('a migration 0015 mantém lock, security definer, search_path e grants', async () => {
    const mod = (n: string): Promise<unknown> => import(/* @vite-ignore */ n)
    const fs = (await mod('node:fs')) as { readFileSync(p: string, e: string): string }
    const { fileURLToPath } = (await mod('node:url')) as { fileURLToPath(u: string | URL): string }
    const sql = fs.readFileSync(fileURLToPath(new URL('../migrations/0015_cortesia_vira_paga.sql', import.meta.url)), 'utf8')
    expect(sql).toContain("hashtextextended('cliente:' || lower(trim(p_email)), 0)")
    expect(sql).toContain('security definer set search_path = public')
    expect(sql).toContain('revoke all on function criar_compra from public, anon, authenticated')
    expect(sql).toContain('grant execute on function criar_compra to service_role')
  })
})
