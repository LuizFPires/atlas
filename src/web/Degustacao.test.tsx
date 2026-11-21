import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { ConfirmarDegustacao } from './Degustacao'
import { criarDegustacaoApi, type DegustacaoApi } from './degustacao-api'
import { Vendas } from './Vendas'

const fake = (o: Partial<DegustacaoApi> = {}): DegustacaoApi => ({
  estado: async () => ({ ativa: true, dias: 5 }),
  pedir: async () => ({ ok: true }),
  confirmar: async () => ({ ok: true, dias: 5, linkToken: 'tok' }),
  ...o,
})
const montar = (api: DegustacaoApi) => render(<TemaProvider><Vendas onComprar={vi.fn()} degustacaoApi={api} /></TemaProvider>)

test('oferta ligada: mostra o bloco, pede o e-mail e avisa para clicar no link', async () => {
  const pedir = vi.fn(async () => ({ ok: true as const }))
  montar(fake({ pedir }))
  expect(await screen.findByRole('heading', { name: /Testar 5 dias grátis/ })).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ana@exemplo.com')
  await userEvent.click(screen.getByRole('button', { name: /Quero testar 5 dias grátis/ }))
  expect(pedir).toHaveBeenCalledWith('ana@exemplo.com')
  expect(await screen.findByRole('status')).toHaveTextContent(/Te enviei um e-mail.*Clica no link/)
})

test('oferta desligada: o bloco e o botão somem', async () => {
  const estado = vi.fn(async () => ({ ativa: false, dias: 5 }))
  montar(fake({ estado }))
  await waitFor(() => expect(estado).toHaveBeenCalled())
  expect(screen.queryByText(/Testar 5 dias grátis/)).toBeNull()
  expect(screen.queryByRole('button', { name: /testar/i })).toBeNull()
})

test('erro honesto do servidor aparece e o formulário continua', async () => {
  montar(fake({ pedir: async () => ({ ok: false, mensagem: 'Esse tipo de e-mail temporário não serve para o teste.' }) }))
  await userEvent.type(await screen.findByLabelText(/Qual o seu e-mail/), 'x@mailinator.com')
  await userEvent.click(screen.getByRole('button', { name: /Quero testar/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/e-mail temporário/)
})

test('sem servidor configurado a oferta não aparece (nunca promete o que não cumpre)', async () => {
  const api = criarDegustacaoApi(null)
  expect(await api.estado()).toMatchObject({ ativa: false })
})

test('texto do bloco sem emoji e sem atendimento humano', async () => {
  const { container } = montar(fake())
  await screen.findByRole('heading', { name: /Testar 5 dias/ })
  expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
  expect(container.textContent).not.toMatch(/atendente|suporte humano|falar com (uma )?pessoa/i)
})

test('página do link: confirma e leva à instalação; erro mostra o recado', async () => {
  const { unmount } = render(<ConfirmarDegustacao api={fake()} token={'a'.repeat(30)} />)
  expect(await screen.findByRole('heading', { name: /teste está liberado/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Instalar o Atlas/ })).toHaveAttribute('href', '/instalar?t=tok')
  unmount()
  render(<ConfirmarDegustacao api={fake({ confirmar: async () => ({ ok: false, mensagem: 'Esse link venceu.' }) })} token={'a'.repeat(30)} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Esse link venceu.')
})

test('o teste é grátis, mas o bloco avisa antes do e-mail que o Atlas só funciona com uma assinatura do Claude', async () => {
  montar(fake())
  await screen.findByRole('heading', { name: /Testar 5 dias grátis/ })
  const aviso = screen.getByRole('note', { name: 'Assinatura do Claude para o teste' })
  expect(aviso).toHaveTextContent('O teste do Atlas é grátis, mas o Atlas só funciona com uma assinatura do Claude')
  expect(aviso).toHaveTextContent('paga direto à Anthropic, à parte do Atlas')
  expect(aviso).toHaveTextContent('Quanto maior o plano, mais rápido a obra anda')
})
