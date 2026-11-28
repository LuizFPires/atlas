import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { ResendConta } from './ResendConta'
import { criarResendFixture, type PonteResend } from './ponte-resend'

// Resend, o carteiro (28/11/2026): chave → domínio → registros de DNS → verificado.
const montarV = (ponte: PonteResend) => { const user = userEvent.setup(); render(<TemaProvider><ResendConta ponte={ponte} sondagemMs={0} sondagemCompraMs={40} onde={() => ({ x: 0, y: 0, width: 400, height: 600 })} /></TemaProvider>); return { user } }
const montar = (ponte: PonteResend, sondagemMs = 0) => { const user = userEvent.setup(); render(<TemaProvider><ResendConta ponte={ponte} sondagemMs={sondagemMs} /></TemaProvider>); return { user } }

test('opcional: explica para que serve; ligar pede a chave com Full access e explica a chave errada', async () => {
  const { user } = montar(criarResendFixture())
  const g = await screen.findByRole('group', { name: 'Resend, o carteiro' })
  expect(g).toHaveTextContent('Opcional · recomendada')
  expect(g).toHaveTextContent('Grátis até 100 e-mails por dia')
  await user.click(within(g).getByRole('button', { name: 'Ligar o Resend' }))
  expect(g).toHaveTextContent('Full access')
  await user.type(screen.getByLabelText('Chave do Resend'), 'abc')
  await user.click(screen.getByRole('button', { name: 'Pronto' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('começa com re_')
})

test('chave boa → domínio (recusa .vercel.app) → registros com Copiar e "Esperando" → conferir agora fica verificado', async () => {
  const p = criarResendFixture({ verificaNa: 1 })
  const { user } = montar(p)
  await user.click(await screen.findByRole('button', { name: 'Ligar o Resend' }))
  await user.type(screen.getByLabelText('Chave do Resend'), 're_' + 'A'.repeat(30))
  await user.click(screen.getByRole('button', { name: 'Pronto' }))
  await user.click(await screen.findByRole('radio', { name: /Já tenho, em outro lugar/i }))
  const campo = await screen.findByLabelText('Seu domínio')
  await user.type(campo, 'ponto.vercel.app')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('precisa ser um domínio seu')
  await user.clear(campo)
  await user.type(campo, 'ampla.com.br')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByText('VERIFICAR AMPLA.COM.BR')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copiar o valor MX send' })).toBeInTheDocument()
  expect(screen.getAllByText('ESPERANDO').length).toBeGreaterThan(0)
  expect(screen.getByRole('status')).toHaveTextContent('Pode fechar o Atlas')
  await user.click(screen.getByRole('button', { name: 'Registro.br' }))
  expect(screen.getByText(/Editar zona/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Conferir agora' }))
  expect(await screen.findByText(/os e-mails dos seus sistemas saem de/)).toHaveTextContent('nao-responda@ampla.com.br')
})

test('domínio esperando: confere sozinho no intervalo', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const p = criarResendFixture({ ligado: true, dominio: 'ampla.com.br', verificaNa: 1 })
  montar(p, 1000)
  expect(await screen.findByText('VERIFICAR AMPLA.COM.BR')).toBeInTheDocument()
  await act(async () => { vi.advanceTimersByTime(1100) })
  expect(await screen.findByText(/os e-mails dos seus sistemas saem de/)).toBeInTheDocument()
  vi.useRealTimers()
})

test('domínio pela Vercel: três caminhos; comprar abre a Vercel ao lado com o aviso "da Vercel, não do Atlas" e liga sozinho quando a compra chega', async () => {
  const p = criarResendFixture({ ligado: true })
  const abrir = vi.spyOn(p, 'abrirSite')
  const { user } = montarV(p)
  const ops = await screen.findByRole('radiogroup', { name: 'Seu domínio está onde?' })
  expect(within(ops).getAllByRole('radio')).toHaveLength(3)
  expect(within(ops).getByRole('radio', { name: /Quero um agora/ })).toHaveAttribute('aria-checked', 'true')
  await user.type(screen.getByLabelText('Nome do domínio'), 'barbeariadoze')
  await user.click(screen.getByRole('button', { name: 'Procurar' }))
  expect(await screen.findByText('barbeariadoze.com')).toBeInTheDocument()
  expect(screen.getByText(/a Vercel não vende .com.br/)).toBeInTheDocument()
  expect(screen.getByText('Você está comprando da Vercel, não do Atlas.')).toBeInTheDocument()
  expect(screen.getByText(/não recebe nada por essa compra/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Comprar barbeariadoze.com na Vercel →' }))
  expect(abrir).toHaveBeenCalledWith('vercel-comprar', expect.anything(), 'barbeariadoze.com')
  expect(screen.getByRole('status')).toHaveTextContent('Esperando a sua compra na Vercel')
  expect(await screen.findByText(/O Atlas criou os registros do e-mail na sua Vercel/, {}, { timeout: 3000 })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Copiar o valor/ })).not.toBeInTheDocument()
})

test('domínio pela Vercel: "Comprei na Vercel" lista a conta; só usa o que está nos servidores da Vercel', async () => {
  const p = criarResendFixture({ ligado: true })
  const ligar = vi.spyOn(p, 'ligarPelaVercel')
  await p.abrirSite!('vercel-comprar', { x: 0, y: 0, width: 1, height: 1 }, 'pontoampla.com')
  const { user } = montarV(p)
  await user.click(await screen.findByRole('radio', { name: /Comprei na Vercel/ }))
  expect(await screen.findByText('pontoampla.com')).toBeInTheDocument()
  expect(screen.getByText(/os servidores \(DNS\) são de outro lugar/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Usar amplaconstrutora.com.br →' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Usar pontoampla.com →' }))
  expect(ligar).toHaveBeenCalledWith('pontoampla.com')
  expect(await screen.findByText('VERIFICAR PONTOAMPLA.COM')).toBeInTheDocument()
})
