import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Admin } from './Admin'
import { criarAdminFixture } from './admin-fixture'
import { criarAdminApi, CHAVE_SESSAO_ADMIN, type AdminApi } from './admin-api'
import { resumirMapa } from './AdminMapa'
import { ESTADOS } from './mapa-brasil'
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
    expect(r.mapa.total).toBe(cad.cadastros.length)
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
    expect(within(mapa).getByRole('button', { name: /São Paulo — SP: 4 clientes \(6 compras\)/ })).toBeInTheDocument()
    const rank = screen.getByRole('region', { name: 'Ranking por estado' })
    const linhas = within(rank).getAllByRole('button')
    expect(linhas[0]).toHaveAccessibleName(/São Paulo: SP: 4 clientes/)
    expect(linhas).toHaveLength(7)
    await userEvent.click(linhas[0])
    expect(linhas[0]).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.ad-mapa-info')).toHaveTextContent('São Paulo — SP: 4 clientes (6 compras)')
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
