import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Ativacao, DICAS, falaParaCodigo, type AtivacaoTela } from './Ativacao'

const api = (o: Partial<AtivacaoTela> = {}): AtivacaoTela => ({
  pedirCodigo: vi.fn(async () => ({ ok: true }) as const),
  confirmar: vi.fn(async () => ({ ok: true, nome: 'Zé' }) as const),
  ...o,
})
const montar = (a: AtivacaoTela, p: Partial<React.ComponentProps<typeof Ativacao>> = {}) => {
  const onContinuar = vi.fn()
  render(<TemaProvider><Ativacao api={a} computador="DESKTOP-ZE · Windows 11" onContinuar={onContinuar} {...p} /></TemaProvider>)
  return onContinuar
}

test('e-mail da compra tem microfone e leva ao código de 6 números', async () => {
  const a = api()
  montar(a)
  expect(screen.getByRole('button', { name: 'Falar' })).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText(/E-mail da compra/), 'ze@barbeariadoze.com.br')
  await userEvent.click(screen.getByRole('button', { name: 'Receber o código' }))
  expect(a.pedirCodigo).toHaveBeenCalledWith('ze@barbeariadoze.com.br')
  expect(await screen.findByRole('heading', { name: 'Confirme que é você' })).toBeInTheDocument()
  expect(screen.getByText(/código de 6 números para/)).toHaveTextContent('ze@barbeariadoze.com.br')
  expect(screen.getByText('Este computador vai ficar com a sua licença')).toBeInTheDocument()
  expect(screen.getByText(/DESKTOP-ZE · Windows 11/)).toBeInTheDocument()
})

test('só confirma com 6 números; depois mostra as 3 coisas e o Continuar', async () => {
  const a = api()
  const onContinuar = montar(a, { faseInicial: 'codigo', emailInicial: 'ze@x.com.br' })
  const botao = screen.getByRole('button', { name: 'Confirmar e instalar' })
  expect(botao).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Código de 6 números'), '482071')
  await userEvent.click(botao)
  expect(a.confirmar).toHaveBeenCalledWith('ze@x.com.br', '482071')
  expect(await screen.findByRole('heading', { name: /Enquanto instala, 3 coisas para saber, Zé\./ })).toBeInTheDocument()
  for (const d of DICAS) expect(screen.getByText(d.titulo)).toBeInTheDocument()
  expect(screen.getByText(/Atlas\\Obras/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Continuar/ }))
  expect(onContinuar).toHaveBeenCalled()
})

test('código errado mostra o recado e fica na tela do código', async () => {
  montar(api({ confirmar: vi.fn(async () => ({ ok: false, mensagem: 'Código incorreto ou vencido. Peça um novo.' }) as const) }), { faseInicial: 'codigo', emailInicial: 'ze@x.com.br' })
  await userEvent.type(screen.getByLabelText('Código de 6 números'), '000000')
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar e instalar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Código incorreto')
  expect(screen.getByRole('heading', { name: 'Confirme que é você' })).toBeInTheDocument()
})

test('reenviar código pede de novo', async () => {
  const a = api()
  montar(a, { faseInicial: 'codigo', emailInicial: 'ze@x.com.br' })
  await userEvent.click(screen.getByRole('button', { name: 'Reenviar código' }))
  await waitFor(() => expect(a.pedirCodigo).toHaveBeenCalledWith('ze@x.com.br'))
  expect(await screen.findByRole('status')).toHaveTextContent('código novo')
})

test('a barra de instalação mostra o progresso vindo do instalador', () => {
  montar(api(), { faseInicial: 'instalando', progresso: { percentual: 78, restante: 'faltam ~2 min' } })
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '78')
  expect(screen.getByText('faltam ~2 min')).toBeInTheDocument()
})

test('os 5 passos do painel e o passo atual', () => {
  montar(api())
  expect(screen.getAllByRole('listitem')).toHaveLength(5)
  expect(screen.getByText('Confirmar e-mail').closest('li')).toHaveAttribute('aria-current', 'step')
})

test('falaParaCodigo entende números falados', () => {
  expect(falaParaCodigo('quatro oito dois zero sete um')).toBe('482071')
  expect(falaParaCodigo('482 071')).toBe('482071')
})
