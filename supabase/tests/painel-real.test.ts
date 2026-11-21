// @vitest-environment node
// M33 — números reais do painel: mapa por cidade, fluxo de caixa, cancelamentos e radar de pirataria.
import { describe, expect, it } from 'vitest'
import { lerEmailsAdmin } from '../functions/_shared/admin.ts'
import type { Pagamento } from '../functions/_shared/tipos.ts'
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

describe('POST /admin/fluxo-caixa', () => {
  const pag = (m: M, p: Partial<Pagamento> & { ref: string }) =>
    m.store.pagamentos.push({ licenca_id: 'l1', conta_gateway_id: 'conta-1', tipo: 'implantacao', valor: 0, status: 'pago', gateway_ref: p.ref, gateway_pi: null, pago_em: null, ...p })

  it('só admin', async () => {
    const m = await montar()
    expect((await chamar(m.ctx(), '/admin/fluxo-caixa', JWT_ANA)).status).toBe(403)
  })

  it('soma por mês e por componente (implantação, prateleira, mensalidade) com os 12 meses, zeros inclusos', async () => {
    const m = await montar() // agora = 2026-11-18
    m.store.pagamentos.length = 0
    pag(m, { ref: 'a', valor: 4800, pago_em: new Date('2026-11-02T15:00:00Z') })
    pag(m, { ref: 'b', valor: 297, segmento: 'academia', pago_em: new Date('2026-11-10T15:00:00Z') })
    pag(m, { ref: 'c', tipo: 'mensalidade', valor: 99.9, pago_em: new Date('2026-11-12T15:00:00Z') })
    pag(m, { ref: 'd', tipo: 'mensalidade', valor: 99.9, pago_em: new Date('2026-10-12T15:00:00Z') })
    pag(m, { ref: 'e', valor: 4800, pago_em: new Date('2026-10-31T01:00:00Z') }) // 22h de 30/10 em Brasília: ainda é outubro
    pag(m, { ref: 'f', valor: 4800, pago_em: new Date('2026-11-01T01:00:00Z') }) // 22h de 31/10 em Brasília: outubro
    const r = await m.post('/admin/fluxo-caixa')
    expect(r.ligado).toBe(true)
    expect(r.meses).toHaveLength(12)
    expect(r.meses[0].mes).toBe('2025-12')
    expect(r.meses[11].mes).toBe('2026-11')
    expect(r.meses[11]).toEqual({ mes: '2026-11', implantacoes: 4800, prateleira: 297, mensalidades: 99.9, total: 5196.9 })
    expect(r.meses[10]).toEqual({ mes: '2026-10', implantacoes: 9600, prateleira: 0, mensalidades: 99.9, total: 9699.9 })
    expect(r.meses[5]).toEqual({ mes: '2026-05', implantacoes: 0, prateleira: 0, mensalidades: 0, total: 0 })
    expect(r.saidas_ligado).toBe(false)
  })

  it('estornado, falhou, pendente e fora da janela não entram', async () => {
    const m = await montar()
    m.store.pagamentos.length = 0
    const quando = new Date('2026-11-05T15:00:00Z')
    pag(m, { ref: 'a', valor: 4800, status: 'estornado', pago_em: quando })
    pag(m, { ref: 'b', valor: 4800, status: 'falhou', pago_em: quando })
    pag(m, { ref: 'c', valor: 4800, status: 'pendente', pago_em: null })
    pag(m, { ref: 'd', valor: 4800, pago_em: new Date('2024-01-05T15:00:00Z') })
    const r = await m.post('/admin/fluxo-caixa')
    expect(r.meses.every((x: { total: number }) => x.total === 0)).toBe(true)
  })

  it('não vaza referência do gateway nem conta', async () => {
    const m = await montar()
    const txt = JSON.stringify(await m.post('/admin/fluxo-caixa'))
    expect(txt).not.toMatch(/pi_|conta-1|acct_|cus_|sub_/)
  })
})
