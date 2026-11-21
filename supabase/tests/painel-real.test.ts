// @vitest-environment node
// M33 — números reais do painel: mapa por cidade, fluxo de caixa, cancelamentos e radar de pirataria.
import { describe, expect, it } from 'vitest'
import { lerEmailsAdmin } from '../functions/_shared/admin.ts'
import type { Pagamento } from '../functions/_shared/tipos.ts'
import { cancelarCompra, cancelarMensalidade } from '../functions/_shared/pagamento/cancelamento.ts'
import { tratar } from '../functions/_shared/http.ts'
import { ufDoCabecalhoConfiavel } from '../functions/_shared/geo.ts'
import { H2, TOKEN } from './helpers.ts'
import { chamar, comDoisClientes, JWT_ANA } from './helpers-portal.ts'

const JWT_LUIZ = 'jwt-luiz'
const HORA = 3600_000
const DIA = 24 * HORA

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

describe('/admin/painel — cancelamentos_no_mes', () => {
  it('conta só quem cancelou neste mês (cancelada_em), inclusive pedido de saída que segue até o fim do período', async () => {
    const m = await montar() // 2026-11-18
    const p0 = await m.post('/admin/painel')
    expect(p0.indicadores.cancelamentos_no_mes).toBe(0)
    novoCliente(m, 'a', {}, { status: 'cancelada', cancelada_em: new Date('2026-11-03T12:00:00Z') })
    novoCliente(m, 'b', {}, { status: 'ativa', cancelada_em: new Date('2026-11-10T12:00:00Z'), mensalidade_encerra_em: new Date('2026-12-05T00:00:00Z') }) // pediu saída, ainda ativa
    novoCliente(m, 'c', {}, { status: 'cancelada', cancelada_em: new Date('2026-10-20T12:00:00Z') }) // mês passado
    novoCliente(m, 'd', {}, { status: 'cancelada' }) // antes da migration: sem data, fora da conta
    expect((await m.post('/admin/painel')).indicadores.cancelamentos_no_mes).toBe(2)
  })

  it('os fluxos reais de cancelamento gravam cancelada_em (arrependimento e cancelar mensalidade)', async () => {
    const m = await montar()
    await cancelarMensalidade(m.deps, 'beto@outra.com')
    expect(m.store.licencas.find((l) => l.id === 'l2')?.cancelada_em).toBeInstanceOf(Date)
    await cancelarCompra(m.deps, 'ana@loja.com')
    expect(m.store.licencas.find((l) => l.id === 'l1')?.cancelada_em).toBeInstanceOf(Date)
    expect((await m.post('/admin/painel')).indicadores.cancelamentos_no_mes).toBe(2)
  })
})

describe('Radar de pirataria', () => {
  const agora = (m: M) => m.deps.agora()
  const ev = (m: M, e: { tipo?: 'instancia_recusada' | 'acesso'; uf?: string | null; dispositivo?: string | null; antes: number; licenca?: string }) =>
    m.store.registrarEventoRadar({ licenca_id: e.licenca ?? 'l1', tipo: e.tipo ?? 'instancia_recusada', uf: e.uf ?? null, dispositivo: e.dispositivo ?? null, criado_em: new Date(agora(m).getTime() - e.antes) })
  const sinais = async (m: M) => (await m.post('/admin/radar')).sinais as Array<{ id: string; tipo: string; gravidade: string; cliente: string; licenca_id: string | null; detalhes: Record<string, unknown>; descricao: string }>

  describe('registro no /instancia/validar', () => {
    const validar = (m: M, hash: string, h: Record<string, string> = {}) =>
      tratar({ ...m.ctx(), ufDoAcesso: (r) => ufDoCabecalhoConfiavel(r.headers, 'x-geo-confiavel') }, new Request('https://x.test/functions/v1/instancia/validar', { method: 'POST', headers: { 'X-Atlas-Dispositivo': TOKEN, 'x-forwarded-for': '203.0.113.77', 'x-geo-confiavel': 'sp', ...h }, body: JSON.stringify({ email: 'ana@loja.com', computador_hash: hash }) }))

    it('2º computador: continua recusando e grava UF + dispositivo curto, SEM IP e sem pausar a licença', async () => {
      const m = await montar()
      const r = await validar(m, H2)
      expect(await r.json()).toEqual({ ok: false, motivo: 'outra_instancia' })
      expect(m.store.eventosDoRadar).toHaveLength(1)
      expect(m.store.eventosDoRadar[0]).toMatchObject({ licenca_id: 'l1', tipo: 'instancia_recusada', uf: 'SP' })
      expect(m.store.eventosDoRadar[0].dispositivo).toMatch(/^[0-9a-f]{8}$/)
      expect(m.store.eventosDoRadar[0].dispositivo).not.toBe(H2.slice(0, 8))
      expect(JSON.stringify(m.store.eventosDoRadar)).not.toMatch(/203\.0\.113|bbbbbbbb/)
      expect(m.store.licencas.find((l) => l.id === 'l1')?.status).toBe('ativa') // o Radar só avisa
    })
    it('acesso do dono grava só a UF (1 vez a cada 2 h); sem UF conhecida, não grava nada; cabeçalho de geo forjável é ignorado', async () => {
      const m = await montar()
      await validar(m, 'a'.repeat(64))
      await validar(m, 'a'.repeat(64))
      expect(m.store.eventosDoRadar).toHaveLength(1)
      expect(m.store.eventosDoRadar[0]).toMatchObject({ tipo: 'acesso', uf: 'SP', dispositivo: null })
      const n = await montar()
      await validar(n, 'a'.repeat(64), { 'x-geo-confiavel': '' })
      await validar(n, 'a'.repeat(64), { 'x-geo-confiavel': '', 'cf-region-code': 'SP', 'x-vercel-ip-country-region': 'SP' }) // cabeçalhos forjáveis são ignorados
      expect(n.store.eventosDoRadar).toHaveLength(0)
    })
    it('se gravar o evento falhar, o guardião responde igual', async () => {
      const m = await montar()
      m.store.registrarEventoRadar = async () => { throw new Error('banco fora') }
      expect(await (await validar(m, H2)).json()).toEqual({ ok: false, motivo: 'outra_instancia' })
    })
  })

  it('só admin e responde ligado com o shape do painel', async () => {
    const m = await montar()
    expect((await chamar(m.ctx(), '/admin/radar', JWT_ANA)).status).toBe(403)
    expect((await chamar(m.ctx(), '/admin/radar/resolver', JWT_ANA, { id: 'x' })).status).toBe(403)
    expect((await chamar(m.ctx(), '/admin/radar', null)).status).toBe(401)
    const r = await m.post('/admin/radar')
    expect(r).toEqual({ ligado: true, resumo: { licencas_sob_suspeita: 0, sinais_abertos: 0, por_tipo: { instancia_recusada: 0, troca_frequente: 0, regioes_distantes: 0, degustacao_repetida: 0 } }, sinais: [] })
  })

  it('(a) 2º computador barrado: 1 = baixa, 2 = média, 3+ = alta (janela de 7 dias)', async () => {
    const m = await montar()
    await ev(m, { antes: HORA, dispositivo: 'abcd1234' })
    expect((await sinais(m))[0]).toMatchObject({ tipo: 'instancia_recusada', gravidade: 'baixa', licenca_id: 'l1', cliente: 'Ana', detalhes: { tentativas: 1, dispositivo_hash: 'abcd1234' } })
    await ev(m, { antes: 2 * HORA, dispositivo: 'abcd1234' })
    expect((await sinais(m))[0].gravidade).toBe('media')
    await ev(m, { antes: 3 * HORA, dispositivo: 'abcd1234' })
    await ev(m, { antes: 9 * DIA, dispositivo: 'abcd1234' }) // fora da janela: não conta
    const s = await sinais(m)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ gravidade: 'alta', detalhes: { tentativas: 3 } })
  })

  it('(b) troca frequente: 3 em 30 dias = média, 5 = alta; troca liberada pelo Luiz e troca antiga não contam', async () => {
    const m = await montar()
    const troca = (dias: number, por_admin = false) => m.store.trocas.push({ licenca_id: 'l2', de_hash: 'x', para_hash: 'y', feita_em: new Date(agora(m).getTime() - dias * DIA), por_admin })
    troca(1); troca(8)
    troca(2, true); troca(40)
    expect(await sinais(m)).toEqual([])
    troca(15)
    expect((await sinais(m))[0]).toMatchObject({ tipo: 'troca_frequente', gravidade: 'media', licenca_id: 'l2', cliente: 'Beto', detalhes: { trocas: 3, dias: 30 } })
    troca(20); troca(25)
    expect((await sinais(m))[0]).toMatchObject({ gravidade: 'alta', detalhes: { trocas: 5 } })
  })

  it('(c) regiões distantes: UFs de macrorregiões diferentes em até 6 h = média; mesma região ou mais de 6 h = nada', async () => {
    const m = await montar()
    await ev(m, { tipo: 'acesso', uf: 'SP', antes: 3 * HORA })
    await ev(m, { tipo: 'acesso', uf: 'RJ', antes: 2 * HORA }) // mesma região (SE)
    await ev(m, { tipo: 'acesso', uf: 'PE', antes: 12 * HORA }) // longe no tempo
    expect(await sinais(m)).toEqual([])
    await ev(m, { tipo: 'acesso', uf: 'AM', antes: HORA / 2 })
    const s = await sinais(m)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ tipo: 'regioes_distantes', gravidade: 'media', licenca_id: 'l1', detalhes: { regioes: ['RJ', 'AM'] } })
    // a recusa também carrega UF e entra na conta
    const n = await montar()
    await ev(n, { tipo: 'acesso', uf: 'RS', antes: 4 * HORA })
    await ev(n, { tipo: 'instancia_recusada', uf: 'CE', antes: HORA, dispositivo: 'aaaa0000' })
    expect((await sinais(n)).map((x) => x.tipo).sort()).toEqual(['instancia_recusada', 'regioes_distantes'])
  })

  it('(d) teste grátis repetido (ledger): 1 barrada = baixa, 2+ = alta; só 8 caracteres do HMAC saem', async () => {
    const m = await montar()
    const hmac = 'f'.repeat(8) + 'segredo-longo-que-nao-pode-sair'
    m.store.dispositivosTeste.set(hmac, 'l2')
    await m.store.registrarBarradaDispositivo(hmac, new Date(agora(m).getTime() - HORA))
    const um = await sinais(m)
    expect(um[0]).toMatchObject({ tipo: 'degustacao_repetida', gravidade: 'baixa', licenca_id: 'l2', detalhes: { dispositivo_hash: 'ffffffff', tentativas: 1 } })
    await m.store.registrarBarradaDispositivo(hmac, new Date(agora(m).getTime() - 60_000))
    expect((await sinais(m))[0]).toMatchObject({ gravidade: 'alta', detalhes: { tentativas: 2 } })
    expect(JSON.stringify(await m.post('/admin/radar'))).not.toContain('segredo-longo')
  })

  it('resumo, ordem (mais grave primeiro) e licenças sob suspeita', async () => {
    const m = await montar()
    await ev(m, { antes: HORA, dispositivo: 'abcd1234' }) // l1 baixa
    const troca = (dias: number) => m.store.trocas.push({ licenca_id: 'l1', de_hash: 'x', para_hash: 'y', feita_em: new Date(agora(m).getTime() - dias * DIA), por_admin: false })
    troca(1); troca(2); troca(3); troca(4); troca(5) // l1 alta
    const r = await m.post('/admin/radar')
    expect(r.sinais.map((x: { tipo: string }) => x.tipo)).toEqual(['troca_frequente', 'instancia_recusada'])
    expect(r.resumo).toEqual({ licencas_sob_suspeita: 1, sinais_abertos: 2, por_tipo: { instancia_recusada: 1, troca_frequente: 1, regioes_distantes: 0, degustacao_repetida: 0 } })
  })

  describe('POST /admin/radar/resolver', () => {
    it('baixa o sinal, audita, não mexe na licença e não apaga o histórico; fato novo reabre', async () => {
      const m = await montar()
      await ev(m, { antes: 2 * HORA, dispositivo: 'abcd1234' })
      const id = (await sinais(m))[0].id
      expect(id).toBe('instancia_recusada:l1')
      const antes = JSON.stringify(m.store.licencas)
      expect(await m.post('/admin/radar/resolver', { id })).toEqual({ ok: true, ja_resolvido: false })
      expect(await sinais(m)).toEqual([])
      expect((await m.post('/admin/radar')).resumo.sinais_abertos).toBe(0)
      expect(JSON.stringify(m.store.licencas)).toBe(antes)
      expect(m.store.eventosDoRadar).toHaveLength(1) // histórico intacto
      expect(m.store.ocorrencias.find((o) => o.tipo === 'radar_baixa')).toMatchObject({ autor: 'luiz@atlas.com', resolvida: true, cliente_id: 'c1' })
      expect(await m.post('/admin/radar/resolver', { id })).toEqual({ ok: true, ja_resolvido: true })
      m.avancar(HORA)
      await ev(m, { antes: 0, dispositivo: 'abcd1234' }) // nova tentativa depois da baixa
      const s = await sinais(m)
      expect(s).toHaveLength(1)
      expect(s[0].detalhes.tentativas).toBe(2)
    })
    it('id inválido = 400; sinal que não existe = 404', async () => {
      const m = await montar()
      expect((await chamar(m.ctx(), '/admin/radar/resolver', JWT_LUIZ, { id: 123 })).status).toBe(400)
      expect((await chamar(m.ctx(), '/admin/radar/resolver', JWT_LUIZ, { id: "x'; drop table" })).status).toBe(400)
      expect((await chamar(m.ctx(), '/admin/radar/resolver', JWT_LUIZ, { id: 'troca_frequente:l1' })).status).toBe(404)
    })
  })

  it('retenção: o agendador diário apaga eventos com mais de 90 dias', async () => {
    const m = await montar()
    await ev(m, { antes: 100 * DIA }); await ev(m, { antes: DIA })
    const c = { ...m.ctx(), autorizarServico: () => true }
    const r = await (await tratar(c, new Request('https://x.test/degustacao/limpar-ips', { method: 'POST', body: '{}' }))).json()
    expect(r.radar_limpos).toBe(1)
    expect(m.store.eventosDoRadar).toHaveLength(1)
  })
})
