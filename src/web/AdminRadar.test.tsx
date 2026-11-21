import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Admin, ordenarSinais } from './Admin'
import { criarAdminFixture } from './admin-fixture'
import { RESUMO_VAZIO, criarAdminApi, CHAVE_SESSAO_ADMIN, type AdminApi } from './admin-api'
import type { ConfigPortal } from './portal-api'

const montar = (api: AdminApi) => render(<TemaProvider><Admin api={api} /></TemaProvider>)
const irParaRadar = async () => { await userEvent.click(await screen.findByRole('link', { name: 'Radar' })) }
const cfg: ConfigPortal = { api: 'https://x.test/api', authUrl: 'https://x.test/auth', anonKey: 'anon' } as ConfigPortal

describe('aba Radar (pirataria)', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear() })

  it('o fixture devolve sinais de todos os tipos e o resumo bate', async () => {
    const r = await criarAdminFixture().radarPirataria()
    if (!r.ok) throw new Error('falhou')
    expect(r.radar.ligado).toBe(true)
    expect(new Set(r.radar.sinais.map((s) => s.tipo)).size).toBe(4)
    expect(r.radar.resumo.sinais_abertos).toBe(r.radar.sinais.length)
    expect(JSON.stringify(r.radar)).not.toMatch(/token|computador_hash/i)
  })

  it('ordena por gravidade e depois por recência', () => {
    const l = ordenarSinais([
      { id: 'a', gravidade: 'baixa', quando: '2026-01-03T00:00:00Z' }, { id: 'b', gravidade: 'alta', quando: '2026-01-01T00:00:00Z' },
      { id: 'c', gravidade: 'alta', quando: '2026-01-02T00:00:00Z' },
    ] as never)
    expect(l.map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })

  it('lista, filtra por tipo e gravidade e dá baixa', async () => {
    montar(criarAdminFixture())
    await irParaRadar()
    const sinais = await screen.findByRole('region', { name: 'Sinais' })
    expect(within(sinais).getAllByRole('article')).toHaveLength(8)
    await userEvent.selectOptions(within(sinais).getByLabelText('Mostrar'), 'troca_frequente')
    expect(within(sinais).getAllByRole('article')).toHaveLength(2)
    await userEvent.selectOptions(within(sinais).getByLabelText('Gravidade'), 'alta')
    expect(within(sinais).getByText('Nenhum sinal com esse filtro. Tente outro.')).toBeInTheDocument()
    await userEvent.selectOptions(within(sinais).getByLabelText('Gravidade'), 'todas')
    await userEvent.click(within(sinais).getByRole('button', { name: /Já verifiquei o sinal de Academia/ }))
    expect(await within(sinais).findAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('marquei como verificado')
  })

  it('"Ver detalhes" mostra só o hash curto', async () => {
    montar(criarAdminFixture())
    await irParaRadar()
    await userEvent.click((await screen.findAllByRole('button', { name: /Ver detalhes de Restaurante/ }))[0])
    expect(await screen.findByText(/Dispositivo \(código curto\): [0-9a-f]{8}$/)).toBeInTheDocument()
  })

  it('sem rota no servidor: diz que ainda não está ligado e não inventa número', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt')
    const f = (async (url: string) => (String(url).endsWith('/admin/eu')
      ? { ok: true, status: 200, json: async () => ({ email: 'a@b.com' }) }
      : { ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch
    const api = criarAdminApi(cfg, f)
    expect((await api.radarPirataria())).toMatchObject({ ok: true, radar: { ligado: false, resumo: RESUMO_VAZIO, sinais: [] } })
    montar(api)
    await irParaRadar()
    expect(await screen.findByRole('region', { name: 'Radar ainda não ligado' })).toHaveTextContent(/sendo ligado/)
    expect(screen.queryByRole('region', { name: 'Sinais' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Resumo do Radar' })).toBeNull()
  })
})

describe('Radar: privacidade', () => {
  it('mesmo com hash longo vindo do servidor, a tela mostra só 8 caracteres', async () => {
    const longo = 'a94f1c07deadbeefcafebabe0123456789abcdef0123456789abcdef01234567'
    const base = criarAdminFixture()
    const api: AdminApi = { ...base, radarPirataria: async () => {
      const r = await base.radarPirataria()
      if (!r.ok) return r
      return { ok: true, radar: { ...r.radar, sinais: r.radar.sinais.map((s) => (s.detalhes.dispositivo_hash ? { ...s, detalhes: { ...s.detalhes, dispositivo_hash: longo } } : s)) } }
    } }
    montar(api)
    await irParaRadar()
    await userEvent.click((await screen.findAllByRole('button', { name: /Ver detalhes de Restaurante/ }))[0])
    expect(await screen.findByText(/código curto\): a94f1c07$/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('deadbeef')
  })
})
