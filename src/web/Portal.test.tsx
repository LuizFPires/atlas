import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Portal } from './Portal'
import { criarPortalApi, CHAVE_SESSAO, type ConfigPortal } from './portal-api'

const cfg: ConfigPortal = { api: 'https://api.test', authUrl: 'https://auth.test/auth/v1', anonKey: 'anon' }
const resp = (corpo: unknown, status = 200) => ({ ok: status < 400, status, json: async () => corpo }) as Response

beforeEach(() => sessionStorage.clear())

describe('login do portal', () => {
  test('e-mail e código: pede o código ao Auth do Atlas e abre a conta com o token', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.endsWith('/otp')) return resp({})
      if (url.endsWith('/verify')) return resp({ access_token: 'jwt-ana' })
      return resp({ nome: 'Zé', empresa: 'Barbearia do Zé', email: 'ze@barbearia.com' })
    })
    const api = criarPortalApi(cfg, f as unknown as typeof fetch)
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    expect(screen.getByRole('heading', { name: 'Entrar na minha conta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Falar' })).toBeInTheDocument() // microfone no campo
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ze@barbearia.com')
    await userEvent.click(screen.getByRole('button', { name: /Receber o código/ }))
    await userEvent.type(await screen.findByLabelText(/Código que chegou/), '123456')
    await userEvent.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(await screen.findByRole('heading', { name: 'Minha conta' })).toBeInTheDocument()
    expect(screen.getByText('Zé · Barbearia do Zé')).toBeInTheDocument()
    // a chamada ao servidor leva o token no cabeçalho, nunca e-mail/id no corpo
    const chamada = (f.mock.calls as unknown as Array<[string, RequestInit]>).find(([u]) => u.endsWith('/portal/eu'))!
    expect(chamada[1].headers).toMatchObject({ Authorization: 'Bearer jwt-ana' })
    expect(chamada[1].body).toBe('{}')
    expect(sessionStorage.getItem(CHAVE_SESSAO)).toBe('jwt-ana')
  })

  test('código errado mostra mensagem amiga e não abre a conta', async () => {
    const f = vi.fn(async (url: string) => (url.endsWith('/otp') ? resp({}) : resp({ msg: 'x' }, 403)))
    render(<TemaProvider><Portal api={criarPortalApi(cfg, f as unknown as typeof fetch)} /></TemaProvider>)
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ze@barbearia.com')
    await userEvent.click(screen.getByRole('button', { name: /Receber o código/ }))
    await userEvent.type(await screen.findByLabelText(/Código que chegou/), '000000')
    await userEvent.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorreto ou vencido')
    expect(screen.queryByRole('heading', { name: 'Minha conta' })).toBeNull()
  })

  test('e-mail de quem não comprou: o servidor recusa e a sessão é descartada', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.endsWith('/otp')) return resp({})
      if (url.endsWith('/verify')) return resp({ access_token: 'jwt-x' })
      return resp({ erro: 'sem_compra', mensagem: 'Não achamos uma compra do Atlas para esse e-mail.' }, 403)
    })
    const api = criarPortalApi(cfg, f as unknown as typeof fetch)
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'x@y.com')
    await userEvent.click(screen.getByRole('button', { name: /Receber o código/ }))
    await userEvent.type(await screen.findByLabelText(/Código que chegou/), '123456')
    await userEvent.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não achamos uma compra')
    await waitFor(() => expect(api.logado()).toBe(false))
  })

  test('sem configuração, explica em vez de quebrar', async () => {
    render(<TemaProvider><Portal api={criarPortalApi(null)} /></TemaProvider>)
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ze@barbearia.com')
    await userEvent.click(screen.getByRole('button', { name: /Receber o código/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ainda não está aberto')
  })
})
