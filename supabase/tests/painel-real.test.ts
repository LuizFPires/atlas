// @vitest-environment node
// M33 — números reais do painel: mapa por cidade, fluxo de caixa, cancelamentos e radar de pirataria.
import { describe, expect, it } from 'vitest'
import { lerEmailsAdmin } from '../functions/_shared/admin.ts'
import { chamar, comDoisClientes, JWT_ANA } from './helpers-portal.ts'

const JWT_LUIZ = 'jwt-luiz'

async function montar() {
  const m = await comDoisClientes()
  m.sessoes.set(JWT_LUIZ, { auth_user_id: 'auth-luiz', email: 'luiz@atlas.com' })
  const admin = { ...m.deps, emailsAdmin: lerEmailsAdmin('luiz@atlas.com') }
  const ctx = () => m.ctx({ admin })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post = async (rota: string, corpo: object = {}): Promise<any> => (await chamar(ctx(), rota, JWT_LUIZ, corpo)).json()
  return { ...m, admin, ctx, post }
}
type M = Awaited<ReturnType<typeof montar>>

/** Mais um cliente pagante (id próprio) com cidade/UF. */
function novoCliente(m: M, id: string, local: { cidade?: string | null; uf?: string | null }, extra: Record<string, unknown> = {}) {
  m.store.clientes.push({ id: `c-${id}`, email_compra: `${id}@x.com`, nome_tratamento: id, ...local })
  m.store.licencas.push({ id: `l-${id}`, cliente_id: `c-${id}`, status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null, comprada_em: m.deps.agora(), ...extra })
}

describe('POST /admin/mapa', () => {
  it('só admin: cliente comum recebe 403 e sem token 401', async () => {
    const m = await montar()
    expect((await chamar(m.ctx(), '/admin/mapa', JWT_ANA)).status).toBe(403)
    expect((await chamar(m.ctx(), '/admin/mapa', null)).status).toBe(401)
  })

  it('agrega pagantes por UF e por cidade; sem cidade conta só no estado; as 27 UFs vêm (zero incluso)', async () => {
    const m = await montar()
    Object.assign(m.store.clientes[0], { cidade: 'Campinas', uf: 'SP' }) // Ana
    Object.assign(m.store.clientes[1], { cidade: 'campinas', uf: 'SP' }) // Beto (grafia diferente = mesma cidade)
    novoCliente(m, 'cris', { cidade: 'São Paulo', uf: 'SP' })
    novoCliente(m, 'davi', { uf: 'SP' }) // só estado
    novoCliente(m, 'edu', { cidade: 'Recife', uf: 'PE' })
    novoCliente(m, 'fabi', {}) // cadastro antigo: fora do mapa
    const r = await m.post('/admin/mapa')
    expect(r.ligado).toBe(true)
    expect(r.por_uf).toHaveLength(27)
    expect(r.por_uf.find((x: { uf: string }) => x.uf === 'SP')).toEqual({ uf: 'SP', regiao: 'SE', clientes: 4, compras: 2 })
    expect(r.por_uf.find((x: { uf: string }) => x.uf === 'PE')).toMatchObject({ regiao: 'NE', clientes: 1 })
    expect(r.por_uf.find((x: { uf: string }) => x.uf === 'AC')).toEqual({ uf: 'AC', regiao: 'N', clientes: 0, compras: 0 })
    expect(r.total).toBe(5)
    expect(r.por_cidade).toEqual([
      { uf: 'SP', cidade: 'Campinas', clientes: 2 },
      { uf: 'PE', cidade: 'Recife', clientes: 1 },
      { uf: 'SP', cidade: 'São Paulo', clientes: 1 },
    ])
    // soma por UF = total; cidades de um estado nunca passam do total dele
    expect(r.por_uf.reduce((t: number, x: { clientes: number }) => t + x.clientes, 0)).toBe(r.total)
    expect(typeof r.atualizado_em).toBe('string')
    expect(JSON.stringify(r)).not.toMatch(/@|ana|beto/i) // nada de e-mail/nome
  })

  it('não conta cortesia/teste, cancelada, conta excluída nem cliente sem compra', async () => {
    const m = await montar()
    novoCliente(m, 'cort', { cidade: 'Natal', uf: 'RN' }, { tipo: 'cortesia' })
    novoCliente(m, 'canc', { cidade: 'Natal', uf: 'RN' }, { status: 'cancelada' })
    novoCliente(m, 'excl', { cidade: 'Natal', uf: 'RN' })
    m.store.clientes.find((c) => c.id === 'c-excl')!.excluido_em = new Date()
    novoCliente(m, 'semcompra', { cidade: 'Natal', uf: 'RN' }, { comprada_em: null })
    const r = await m.post('/admin/mapa')
    expect(r.total).toBe(0)
    expect(r.por_cidade).toEqual([])
  })

  it('UF estranha guardada no banco é ignorada (não vira linha inventada)', async () => {
    const m = await montar()
    novoCliente(m, 'x', { cidade: 'Lugar', uf: 'ZZ' })
    const r = await m.post('/admin/mapa')
    expect(r.total).toBe(0)
    expect(r.por_uf).toHaveLength(27)
  })
})
