import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Admin } from './Admin'
import { MSG_RECUPERACAO, criarAdminApi, linkDeRecuperacaoComErro, tokenDeRecuperacao, validarNovaSenha } from './admin-api'
import type { ConfigPortal } from './portal-api'

const cfg: ConfigPortal = { api: 'https://api.test', authUrl: 'https://auth.test/auth/v1', anonKey: 'anon' }
const resp = (corpo: unknown, status = 200) => ({ ok: status < 400, status, json: async () => corpo }) as Response
function ambiente(status = 200) {
  const chamadas: Array<{ url: string; init: RequestInit }> = []
  const f = vi.fn(async (url: string, init: RequestInit) => { chamadas.push({ url, init }); return resp({}, status) })
  return { chamadas, api: criarAdminApi(cfg, f as unknown as typeof fetch) }
}
const montar = (api: ReturnType<typeof criarAdminApi>) => render(<TemaProvider><Admin api={api} /></TemaProvider>)

beforeEach(() => { sessionStorage.clear(); window.location.hash = '' })

describe('senha do admin', () => {
  it('o olho alterna o campo entre senha e texto', async () => {
    montar(ambiente().api)
    const campo = screen.getByLabelText('Senha')
    expect(campo).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(campo).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(campo).toHaveAttribute('type', 'password')
  })

  it('Esqueci minha senha: mensagem neutra, chamando /recover só com o e-mail', async () => {
    const { api, chamadas } = ambiente()
    montar(api)
    await userEvent.type(screen.getByLabelText(/Seu e-mail de administrador/), 'alguem@x.com')
    await userEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    expect(await screen.findByText(MSG_RECUPERACAO)).toBeInTheDocument()
    expect(chamadas[0].url).toContain('/auth/v1/recover?redirect_to=')
    expect(JSON.parse(String(chamadas[0].init.body))).toEqual({ email: 'alguem@x.com' })
  })

  it('recuperarSenha dá a mesma resposta mesmo se o servidor recusar o e-mail', async () => {
    expect(await ambiente(400).api.recuperarSenha('naoexiste@x.com')).toEqual({ ok: true })
  })

  it('valida mínimo e confirmação', () => {
    expect(validarNovaSenha('curta', 'curta')).toMatch(/pelo menos 8/)
    expect(validarNovaSenha('senha-longa-1', 'senha-longa-2')).toMatch(/não são iguais/)
    expect(validarNovaSenha('senha-longa-1', 'senha-longa-1')).toBe('')
  })

  it('definirNovaSenha manda PUT /user com o token e trata link vencido', async () => {
    const { api, chamadas } = ambiente()
    expect((await api.definirNovaSenha('tok', 'senha-longa-1')).ok).toBe(true)
    expect(chamadas[0].url).toBe('https://auth.test/auth/v1/user')
    expect(chamadas[0].init.method).toBe('PUT')
    expect(chamadas[0].init.headers).toMatchObject({ Authorization: 'Bearer tok' })
    const r = await ambiente(401).api.definirNovaSenha('tok', 'senha-longa-1')
    expect(r.ok).toBe(false)
  })

  it('detecta o token de recuperação no hash', () => {
    expect(tokenDeRecuperacao('#access_token=abc&type=recovery&expires_in=3600')).toBe('abc')
    expect(tokenDeRecuperacao('#access_token=abc&type=signup')).toBe('')
    expect(linkDeRecuperacaoComErro('#error=access_denied&error_code=otp_expired')).toBe(true)
  })

  it('link de recuperação abre a tela de senha nova, grava e volta ao login com aviso', async () => {
    window.location.hash = '#access_token=tok&type=recovery'
    const { api, chamadas } = ambiente()
    montar(api)
    expect(screen.getByRole('heading', { name: 'Crie uma senha nova' })).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    await userEvent.type(screen.getByLabelText('Senha nova'), 'senha-longa-1')
    await userEvent.type(screen.getByLabelText('Repita a senha nova'), 'diferente-123')
    await userEvent.click(screen.getByRole('button', { name: /Salvar senha nova/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/não são iguais/)
    expect(chamadas).toHaveLength(0)
    await userEvent.clear(screen.getByLabelText('Repita a senha nova'))
    await userEvent.type(screen.getByLabelText('Repita a senha nova'), 'senha-longa-1')
    await userEvent.click(screen.getByRole('button', { name: /Salvar senha nova/ }))
    expect(await screen.findByText('Senha atualizada, pode entrar.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrar no painel' })).toBeInTheDocument()
  })

  it('link vencido mostra o caminho de volta', () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired'
    montar(ambiente().api)
    expect(screen.getByRole('alert')).toHaveTextContent(/peça um link novo|peça um link novo/i)
  })
})
