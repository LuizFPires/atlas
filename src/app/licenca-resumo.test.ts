import { cartaoDaLicenca, lerResumo, type ResumoLicenca } from './licenca-resumo'
import type { Cofre } from './ponte'

const API = 'https://servidor.test/api'
const AGORA = '2026-11-21T15:00:00.000Z' // 12h em Brasília
const em = (iso: string, extra: Partial<ResumoLicenca> = {}): ResumoLicenca => ({ tipo: 'cortesia', origem: 'degustacao', validade_em: iso, vencida: false, agora: AGORA, ...extra })

describe('texto do cartão', () => {
  it('faltam 3 dias: contador e data de vencimento', () => {
    expect(cartaoDaLicenca(em('2026-11-24T15:00:00.000Z'))).toEqual({ estado: 'contando', rotulo: 'TESTE GRÁTIS', titulo: 'Faltam 3 dias', sub: 'Vence em 24/11' })
  })
  it('um dia: singular', () => {
    expect(cartaoDaLicenca(em('2026-11-22T15:00:00.000Z'))).toMatchObject({ titulo: 'Falta 1 dia', sub: 'Vence em 22/11' })
  })
  it('vence ainda hoje, daqui a duas horas: "Vence hoje", nunca "Faltam 0 dias"', () => {
    expect(cartaoDaLicenca(em('2026-11-21T17:00:00.000Z'))).toMatchObject({ estado: 'contando', titulo: 'Vence hoje', sub: 'Vence em 21/11' })
  })
  it('vence amanhã cedo, faltando menos de 24 h: "Falta 1 dia"', () => {
    expect(cartaoDaLicenca(em('2026-11-22T12:00:00.000Z'))).toMatchObject({ titulo: 'Falta 1 dia' })
  })
  it('cortesia do gestor usa o rótulo CORTESIA', () => {
    expect(cartaoDaLicenca(em('2026-11-24T15:00:00.000Z', { origem: null }))).toMatchObject({ rotulo: 'CORTESIA' })
  })
  it('prazo passou: avisa que acabou, com o texto de cada tipo', () => {
    expect(cartaoDaLicenca(em('2026-11-20T15:00:00.000Z', { vencida: true }))).toEqual({ estado: 'vencida', rotulo: 'TESTE GRÁTIS', titulo: 'Seu teste acabou', sub: null })
    expect(cartaoDaLicenca(em('2026-11-20T15:00:00.000Z', { vencida: true, origem: null }))).toMatchObject({ estado: 'vencida', titulo: 'Sua cortesia acabou' })
    expect(cartaoDaLicenca(em('2026-11-21T14:59:00.000Z'))).toMatchObject({ estado: 'vencida' })
  })
  it('licença paga, ou sem resposta do servidor: linha de sempre, sem contador', () => {
    expect(cartaoDaLicenca({ tipo: 'paga', origem: null, validade_em: null, vencida: false, agora: AGORA })).toEqual({ estado: 'ativa' })
    expect(cartaoDaLicenca(null)).toEqual({ estado: 'ativa' })
  })
  it('paga nos 7 dias de arrependimento: linha de sempre com a data em que a entrega libera', () => {
    const paga = (entrega_libera_em: string | null): ResumoLicenca => ({ tipo: 'paga', origem: null, validade_em: null, vencida: false, entrega_libera_em, agora: AGORA })
    expect(cartaoDaLicenca(paga('2026-11-25T12:00:00.000Z'))).toEqual({ estado: 'ativa', entrega: 'Entrega em produção libera em 25/11' })
    expect(cartaoDaLicenca(paga(null))).toEqual({ estado: 'ativa' })
    expect(cartaoDaLicenca(paga('2026-11-21T14:00:00.000Z'))).toEqual({ estado: 'ativa' }) // a data já passou pelo relógio do servidor
  })
  it('relógio do computador errado não muda a conta: quem manda é a hora do servidor', () => {
    const r = em('2026-11-24T15:00:00.000Z')
    expect(cartaoDaLicenca(r)).toEqual(cartaoDaLicenca({ ...r }))
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-30T00:00:00Z'))
    try { expect(cartaoDaLicenca(r)).toMatchObject({ estado: 'contando', titulo: 'Faltam 3 dias' }) } finally { vi.useRealTimers() }
  })
})

describe('ler o resumo no servidor', () => {
  const cofreCom = (valor: string | null): Cofre => ({ guardar: async () => {}, ler: async () => valor, apagar: async () => {} })
  const ativado = cofreCom(JSON.stringify({ token: 'tok-1', email: 'ana@loja.com', nome: 'Ana' }))
  const ponte = (cofre: Cofre) => ({ cofre, hashComputador: async () => 'a'.repeat(64) })
  const responder = (status: number, corpo: unknown) => vi.fn(async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch

  it('manda o e-mail da ativação, o computador e a credencial no cabeçalho', async () => {
    const f = responder(200, em('2026-11-24T15:00:00.000Z'))
    expect(await lerResumo(ponte(ativado), API, f)).toEqual(em('2026-11-24T15:00:00.000Z'))
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect(url).toBe(`${API}/licenca/resumo`)
    expect(JSON.parse(init.body as string)).toEqual({ email: 'ana@loja.com', computador_hash: 'a'.repeat(64) })
    expect(new Headers(init.headers).get('X-Atlas-Dispositivo')).toBe('tok-1')
  })

  it('qualquer dúvida vira null: não ativado, sem servidor, recusa, rede fora ou resposta estranha', async () => {
    expect(await lerResumo(ponte(cofreCom(null)), API, responder(200, em('2026-11-24T15:00:00.000Z')))).toBeNull()
    expect(await lerResumo(ponte(ativado), null, responder(200, {}))).toBeNull()
    expect(await lerResumo(ponte(ativado), API, responder(401, { erro: 'negado' }))).toBeNull()
    expect(await lerResumo(ponte(ativado), API, (async () => { throw new Error('rede') }) as unknown as typeof fetch)).toBeNull()
    for (const ruim of [{}, { ...em('nao-e-data') }, { ...em('2026-11-24T15:00:00.000Z'), tipo: 'vitalicia' }, { ...em('2026-11-24T15:00:00.000Z'), agora: 'x' }, { tipo: 'cortesia', origem: 'degustacao', validade_em: null, vencida: false, agora: AGORA }, 'texto', null]) {
      expect(await lerResumo(ponte(ativado), API, responder(200, ruim)), JSON.stringify(ruim)).toBeNull()
    }
  })

  it('paga: guarda a data da entrega; data estranha vira null (não inventa prazo)', async () => {
    const base = { tipo: 'paga', origem: null, validade_em: null, vencida: false, agora: AGORA }
    expect(await lerResumo(ponte(ativado), API, responder(200, { ...base, entrega_libera_em: '2026-11-25T12:00:00.000Z' }))).toMatchObject({ entrega_libera_em: '2026-11-25T12:00:00.000Z' })
    expect(await lerResumo(ponte(ativado), API, responder(200, { ...base, entrega_libera_em: 'x' }))).toMatchObject({ entrega_libera_em: null })
    expect(await lerResumo(ponte(ativado), API, responder(200, base))).toMatchObject({ entrega_libera_em: null })
  })

  it('cortesia vencida sem data gravada ainda é uma resposta válida', async () => {
    const r = { tipo: 'cortesia', origem: null, validade_em: null, vencida: true, agora: AGORA }
    expect(await lerResumo(ponte(ativado), API, responder(200, r))).toEqual(r)
  })
})
