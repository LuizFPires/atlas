import { render, screen } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { MinhasObras } from './Obras'
import { criarPortalApi, CHAVE_SESSAO, type ConfigPortal } from './portal-api'
import { criarStatusObrasPortal, OBRAS_EXEMPLO } from './obras-status'

const cfg: ConfigPortal = { api: 'https://api.test', authUrl: 'https://auth.test/auth/v1', anonKey: 'anon' }
const montar = (resposta: { status: number; corpo: unknown } | 'rede') => {
  const f = vi.fn(async (...args: [string, RequestInit?]) => {
    void args
    if (resposta === 'rede') throw new Error('off')
    return { ok: resposta.status < 400, status: resposta.status, json: async () => resposta.corpo } as Response
  })
  return { f, ponte: criarStatusObrasPortal(criarPortalApi(cfg, f as unknown as typeof fetch)) }
}

describe('adaptador real do Portal (relay M30)', () => {
  afterEach(() => sessionStorage.clear())

  test('chama POST /portal/obras com o token e SEM id no corpo; lista e busca por id', async () => {
    sessionStorage.setItem(CHAVE_SESSAO, 'jwt-dele')
    const { f, ponte } = montar({ status: 200, corpo: { obras: OBRAS_EXEMPLO } })
    expect(await ponte.listarObras()).toHaveLength(3)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://api.test/portal/obras')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-dele')
    expect(init?.body).toBe('{}')
    expect((await ponte.obra('o2'))?.nome).toBe('Controle de Estoque')
    expect(await ponte.obra('de-outro')).toBeNull()
  })

  test('sem sessão ou com erro do servidor/rede: lança (a tela mostra o aviso), nunca finge obras', async () => {
    await expect(montar({ status: 200, corpo: { obras: [] } }).ponte.listarObras()).rejects.toThrow()
    sessionStorage.setItem(CHAVE_SESSAO, 'jwt')
    await expect(montar({ status: 500, corpo: {} }).ponte.listarObras()).rejects.toThrow()
    await expect(montar('rede').ponte.listarObras()).rejects.toThrow()
  })

  test('resposta vazia (computador ainda não publicou): lista vazia e mensagem amiga na tela', async () => {
    sessionStorage.setItem(CHAVE_SESSAO, 'jwt')
    const { ponte } = montar({ status: 200, corpo: { obras: [] } })
    expect(await ponte.listarObras()).toEqual([])
    render(<TemaProvider><MinhasObras ponte={ponte} /></TemaProvider>)
    expect(await screen.findByText(/ainda não tem obras/)).toBeInTheDocument()
  })
})
