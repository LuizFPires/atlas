import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Admin } from './Admin'
import { criarAdminFixture } from './admin-fixture'
import { criarAdminApi, CHAVE_SESSAO_ADMIN, type AdminApi } from './admin-api'
import { RAIO_MAX, RAIO_MIN, VISTA_INICIAL, ZOOM_CIDADES, ZOOM_MAX, caixaUf, raioBolha, resumirMapa, vistaDoEstado, zoomar } from './AdminMapa'
import { CIDADES, LONLAT_UF, acharCidade, posicaoCidade, projetar } from './cidades-brasil'
import { CENTRO_UF, ESTADOS } from './mapa-brasil'
import type { ConfigPortal } from './portal-api'

const montar = (api: AdminApi) => render(<TemaProvider><Admin api={api} /></TemaProvider>)
const irParaMapa = async () => { await userEvent.click(await screen.findByRole('link', { name: 'Mapa' })) }
const cfg: ConfigPortal = { api: 'https://x.test/api', authUrl: 'https://x.test/auth', anonKey: 'anon' } as ConfigPortal

describe('aba Mapa', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear() })

  it('o fixture cobre as 27 UFs e soma certo por UF e por região', async () => {
    const api = criarAdminFixture()
    const r = await api.mapaClientes()
    if (!r.ok) throw new Error('falhou')
    expect(r.mapa.ligado).toBe(true)
    expect(r.mapa.por_uf).toHaveLength(27)
    expect(ESTADOS).toHaveLength(27)
    expect(new Set(r.mapa.por_uf.map((l) => l.uf)).size).toBe(27)
    const soma = r.mapa.por_uf.reduce((s, l) => s + l.clientes, 0)
    expect(soma).toBe(r.mapa.total)
    const cad = await api.cadastros()
    if (!cad.ok) throw new Error('falhou')
    expect(cad.cadastros.length).toBeGreaterThan(0)
    // por cidade bate com por estado
    for (const l of r.mapa.por_uf) expect((r.mapa.por_cidade ?? []).filter((c) => c.uf === l.uf).reduce((s, c) => s + c.clientes, 0)).toBe(l.clientes)
    expect(r.mapa.por_cidade?.every((c) => acharCidade(c.uf, c.cidade))).toBe(true)
    const res = resumirMapa(r.mapa.por_uf)
    expect(res.regioes.reduce((s, g) => s + g.clientes, 0)).toBe(soma)
    expect(res.lider?.uf).toBe('SP')
    expect(res.regiaoLider?.regiao).toBe('SE')
    expect(res.ranking.map((l) => l.clientes)).toEqual([...res.ranking.map((l) => l.clientes)].sort((a, b) => b - a))
    expect(r.mapa.por_uf.every((l) => l.compras >= l.clientes)).toBe(true)
  })

  it('tem o item Mapa no menu, o mapa com 27 estados e o ranking', async () => {
    montar(criarAdminFixture())
    await irParaMapa()
    expect(await screen.findByRole('heading', { name: 'Mapa' })).toBeInTheDocument()
    const mapa = screen.getByRole('group', { name: /Mapa do Brasil/ })
    expect(mapa.querySelectorAll('path[data-uf]')).toHaveLength(27)
    expect(within(mapa).getByRole('button', { name: /São Paulo — SP: 98 clientes \(128 compras\)/ })).toBeInTheDocument()
    const rank = screen.getByRole('region', { name: 'Ranking por estado' })
    const linhas = within(rank).getAllByRole('button')
    expect(linhas[0]).toHaveAccessibleName(/São Paulo: SP: 98 clientes/)
    expect(linhas).toHaveLength(10)
    await userEvent.click(linhas[0])
    expect(linhas[0]).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.ad-mapa-info')).toHaveTextContent('São Paulo — SP: 98 clientes (128 compras)')
    expect(screen.getByRole('region', { name: 'Resumo por região' })).toHaveTextContent('Sudeste')
  })

  it('sem a rota no servidor, mostra "ainda não ligado" e não pinta nada', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'tok')
    const f = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/admin/eu')) return new Response(JSON.stringify({ email: 'a@b.com' }), { status: 200 })
      if (String(url).endsWith('/admin/painel')) return new Response(JSON.stringify({ gerado_em: '2026-01-01T00:00:00Z', indicadores: { clientes_ativos: 0, receita: { recorrente_mensal: 0, recebida_no_mes: 0, implantacoes_recebidas_no_mes: 0 }, ativacoes: { no_mes: 0, meta: 10, computadores_ativos: 0 }, inadimplencia: { atrasadas: 0, pausadas: 0, valor_em_aberto: 0 }, travados: 0 }, atencao: [], clientes: [] }), { status: 200 })
      if (String(url).endsWith('/admin/mapa')) return new Response('{}', { status: 404 })
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    montar(criarAdminApi(cfg, f))
    await irParaMapa()
    const aviso = await screen.findByRole('region', { name: 'Mapa ainda não ligado' })
    expect(aviso).toHaveTextContent(/guardar o estado de quem compra/)
    expect(screen.queryByRole('group', { name: /Mapa do Brasil/ })).toBeNull()
  })
})

describe('bolhas e zoom do mapa', () => {
  it('raio: área proporcional, com mínimo e máximo; zero não tem bolha', () => {
    expect(raioBolha(0, 10)).toBe(0)
    expect(raioBolha(10, 10)).toBe(RAIO_MAX)
    expect(raioBolha(1, 1000)).toBeGreaterThanOrEqual(RAIO_MIN)
    expect(raioBolha(4, 16)).toBeGreaterThan(raioBolha(1, 16))
  })
  it('zoom respeita limites e volta ao centro ao afastar tudo', () => {
    let v = VISTA_INICIAL
    for (let i = 0; i < 20; i++) v = zoomar(v, 1.5)
    expect(v.k).toBe(ZOOM_MAX)
    for (let i = 0; i < 20; i++) v = zoomar(v, 1 / 1.5, { x: 10, y: 10 })
    expect(v).toEqual(VISTA_INICIAL)
  })
  it('cada estado tem centro', () => {
    expect(ESTADOS.every((e) => CENTRO_UF[e.uf])).toBe(true)
  })
})

describe('projeção e cidades', () => {
  it('projetar o lon/lat de cada estado cai perto do centro dele no mapa', () => {
    for (const uf of Object.keys(LONLAT_UF)) {
      const [x, y] = projetar(...LONLAT_UF[uf])
      expect(Math.hypot(x - CENTRO_UF[uf][0], y - CENTRO_UF[uf][1]), uf).toBeLessThan(15)
    }
  })
  it('cidades caem dentro do mapa e na ordem geográfica certa', () => {
    for (const c of CIDADES) {
      const [x, y] = projetar(c.lon, c.lat)
      expect(x, c.nome).toBeGreaterThan(0); expect(x, c.nome).toBeLessThan(660)
      expect(y, c.nome).toBeGreaterThan(0); expect(y, c.nome).toBeLessThan(597)
    }
    const bh = posicaoCidade('MG', 'Belo Horizonte')!, udi = posicaoCidade('MG', 'uberlandia')!, moc = posicaoCidade('MG', 'Montes Claros')!
    expect(udi[0]).toBeLessThan(bh[0]) // Uberlândia fica a oeste
    expect(moc[1]).toBeLessThan(bh[1]) // Montes Claros fica ao norte
    expect(posicaoCidade('MG', 'Cidade Inventada')).toBeNull()
  })
  it('o enquadramento de um estado já está no nível de cidade', () => {
    expect(caixaUf('MG')).not.toBeNull()
    expect(vistaDoEstado('MG').k).toBeGreaterThanOrEqual(ZOOM_CIDADES)
    expect(vistaDoEstado('DF').k).toBeLessThanOrEqual(ZOOM_MAX)
  })
})

describe('nível por zoom no mapa', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear() })

  it('afastado mostra estados; clicar em Minas mostra as cidades; centralizar volta ao Brasil', async () => {
    montar(criarAdminFixture())
    await irParaMapa()
    const mapa = await screen.findByRole('group', { name: /Mapa do Brasil/ })
    expect(mapa).toHaveAttribute('data-nivel', 'estado')
    await userEvent.click(mapa.querySelector('path[data-uf="MG"]')!)
    expect(mapa).toHaveAttribute('data-nivel', 'cidade')
    const nomes = Array.from(mapa.querySelectorAll('circle[data-cidade]')).map((c) => c.getAttribute('data-cidade'))
    expect(nomes).toEqual(expect.arrayContaining(['Uberlândia', 'Montes Claros', 'Belo Horizonte', 'Itabira']))
    expect(mapa).toHaveTextContent('Uberlândia · 30')
    expect(screen.queryByText(/O detalhe por cidade aparece/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Centralizar o mapa' }))
    expect(mapa).toHaveAttribute('data-nivel', 'estado')
    expect(mapa.querySelectorAll('circle[data-cidade]')).toHaveLength(0)
  })

  it('sem por_cidade (servidor real), aproximar não quebra e avisa com honestidade', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'tok')
    const f = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/admin/eu')) return new Response(JSON.stringify({ email: 'a@b.com' }), { status: 200 })
      if (String(url).endsWith('/admin/painel')) return new Response(JSON.stringify({ gerado_em: '2026-01-01T00:00:00Z', indicadores: { clientes_ativos: 0, receita: { recorrente_mensal: 0, recebida_no_mes: 0, implantacoes_recebidas_no_mes: 0 }, ativacoes: { no_mes: 0, meta: 10, computadores_ativos: 0 }, inadimplencia: { atrasadas: 0, pausadas: 0, valor_em_aberto: 0 }, travados: 0 }, atencao: [], clientes: [] }), { status: 200 })
      if (String(url).endsWith('/admin/mapa')) return new Response(JSON.stringify({ total: 3, por_uf: [{ uf: 'MG', regiao: 'SE', clientes: 3, compras: 3 }], atualizado_em: '2026-01-01T00:00:00Z' }), { status: 200 })
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    const api = criarAdminApi(cfg, f)
    const r = await api.mapaClientes()
    if (!r.ok) throw new Error('falhou')
    expect(r.mapa.por_cidade).toBeUndefined()
    montar(api)
    await irParaMapa()
    const mapa = await screen.findByRole('group', { name: /Mapa do Brasil/ })
    await userEvent.click(mapa.querySelector('path[data-uf="MG"]')!)
    expect(mapa).toHaveAttribute('data-nivel', 'cidade')
    expect(screen.getByText(/O detalhe por cidade aparece quando o Atlas começar a guardar a cidade de quem compra/)).toBeInTheDocument()
    expect(mapa.querySelectorAll('circle[data-cidade]')).toHaveLength(0)
    expect(mapa.querySelector('circle[data-bolha="MG"]')).not.toBeNull() // continua a bolha do estado
  })
})
