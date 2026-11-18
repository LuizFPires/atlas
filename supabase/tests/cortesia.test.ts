// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { lerEmailsAdmin } from '../functions/_shared/admin.ts'
import { verificar } from '../functions/_shared/verificar.ts'
import { chamar, comDoisClientes, JWT_ANA } from './helpers-portal.ts'
import { H1, montar, TOKEN } from './helpers.ts'

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
