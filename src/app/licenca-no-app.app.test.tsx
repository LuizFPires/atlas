import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import type { ResumoLicenca } from './licenca-resumo'

const AGORA = '2026-11-21T15:00:00.000Z'
const teste: ResumoLicenca = { tipo: 'cortesia', origem: 'degustacao', validade_em: '2026-11-24T15:00:00.000Z', vencida: false, agora: AGORA }
const paga: ResumoLicenca = { tipo: 'paga', origem: null, validade_em: null, vencida: false, agora: AGORA }
const ativado = () => criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'ana@loja.com', nome: 'Ana' }) }))
const api = { pedirCodigo: async () => ({ ok: true as const }), confirmar: async () => ({ ok: true as const, nome: 'Ana' }) }

test('app em teste grátis: a lateral mostra o contador e o botão abre a compra com o e-mail da ativação', async () => {
  const iniciar = vi.fn(async () => ({ ok: true as const, url: 'https://checkout.stripe.com/c/pay/x' }))
  const abrir = vi.fn(async () => {})
  render(<TemaProvider><AppDesktop ponte={{ ...ativado(), pagamento: { abrir } }} api={api} resumoLicenca={async () => teste} iniciarCompraNoApp={iniciar} /></TemaProvider>)
  const cartao = await screen.findByRole('status', { name: 'Seu acesso ao Atlas' })
  expect(cartao).toHaveTextContent('Faltam 3 dias')
  await userEvent.click(within(cartao).getByRole('button', { name: 'Quero o Atlas' }))
  const dialogo = await screen.findByRole('dialog', { name: 'Ficar com o Atlas' })
  expect(within(dialogo).getByText('ana@loja.com')).toBeInTheDocument()
  await userEvent.click(within(dialogo).getByRole('checkbox'))
  await userEvent.click(within(dialogo).getByRole('button', { name: /Ir para o pagamento/ }))
  expect(iniciar).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@loja.com', origem: 'app' }))
  expect(abrir).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/x')
})

test('licença paga: sem contador e sem botão de compra', async () => {
  render(<TemaProvider><AppDesktop ponte={ativado()} api={api} resumoLicenca={async () => paga} /></TemaProvider>)
  expect(await screen.findByText('Licença ativa · este computador')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Quero o Atlas' })).toBeNull()
})

test('sem resposta do servidor: nenhum prazo inventado', async () => {
  render(<TemaProvider><AppDesktop ponte={ativado()} api={api} resumoLicenca={async () => null} /></TemaProvider>)
  expect(await screen.findByText('Licença ativa · este computador')).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Seu acesso ao Atlas' })).toBeNull()
})

test('pagou: a tela de compra some sozinha e a lateral volta a "Licença ativa"', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    let atual: ResumoLicenca = teste
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TemaProvider><AppDesktop ponte={{ ...ativado(), pagamento: { abrir: async () => {} } }} api={api} resumoLicenca={async () => atual} iniciarCompraNoApp={async () => ({ ok: true, url: 'https://checkout.stripe.com/c/pay/x' })} /></TemaProvider>)
    await user.click(await screen.findByRole('button', { name: 'Quero o Atlas' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Ficar com o Atlas' })
    await user.click(within(dialogo).getByRole('checkbox'))
    await user.click(within(dialogo).getByRole('button', { name: /Ir para o pagamento/ }))
    await within(dialogo).findByRole('status')
    atual = paga
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await screen.findByText('Licença ativa · este computador')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Ficar com o Atlas' })).toBeNull()
  } finally { vi.useRealTimers() }
})

const vencida: ResumoLicenca = { tipo: 'cortesia', origem: null, validade_em: '2026-11-22T15:00:00.000Z', vencida: true, agora: AGORA }

describe('cortesia ou teste vencido: o Atlas inteiro fica travado', () => {
  beforeEach(() => { localStorage.clear() })

  test('mostra só o aviso no meio da tela e o botão de compra; menu, microfone e o resto somem', async () => {
    render(<TemaProvider><AppDesktop ponte={ativado()} api={api} resumoLicenca={async () => vencida} /></TemaProvider>)
    const aviso = await screen.findByRole('alertdialog', { name: 'Sua cortesia acabou' })
    expect(within(aviso).getByRole('button', { name: 'Quero o Atlas' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByText('Minhas obras')).toBeNull()
    expect(screen.queryByRole('button', { name: /Falar com o Atlas/ })).toBeNull()
  })

  test('teste grátis vencido usa o texto do teste', async () => {
    render(<TemaProvider><AppDesktop ponte={ativado()} api={api} resumoLicenca={async () => ({ ...vencida, origem: 'degustacao' })} /></TemaProvider>)
    expect(await screen.findByRole('alertdialog', { name: 'Seu teste acabou' })).toBeInTheDocument()
  })

  test('o botão abre a compra com o e-mail da ativação', async () => {
    render(<TemaProvider><AppDesktop ponte={ativado()} api={api} resumoLicenca={async () => vencida} iniciarCompraNoApp={async () => ({ ok: true, url: 'https://checkout.stripe.com/c/pay/x' })} /></TemaProvider>)
    await userEvent.click(await screen.findByRole('button', { name: 'Quero o Atlas' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Ficar com o Atlas' })
    expect(within(dialogo).getByText('ana@loja.com')).toBeInTheDocument()
  })

  test('abrir de novo sem internet continua travado', async () => {
    const { unmount } = render(<TemaProvider><AppDesktop ponte={ativado()} api={api} resumoLicenca={async () => vencida} /></TemaProvider>)
    await screen.findByRole('alertdialog', { name: 'Sua cortesia acabou' })
    unmount()
    render(<TemaProvider><AppDesktop ponte={ativado()} api={api} resumoLicenca={async () => null} /></TemaProvider>)
    expect(await screen.findByRole('alertdialog', { name: /acabou/ })).toBeInTheDocument()
    expect(screen.queryByText('Minhas obras')).toBeNull()
  })

  test('pagou: destrava sozinho', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let atual: ResumoLicenca = vencida
      render(<TemaProvider><AppDesktop ponte={ativado()} api={api} resumoLicenca={async () => atual} /></TemaProvider>)
      await screen.findByRole('alertdialog', { name: 'Sua cortesia acabou' })
      atual = paga
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      expect(await screen.findByText('Licença ativa · este computador')).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).toBeNull()
    } finally { vi.useRealTimers() }
  })
})
