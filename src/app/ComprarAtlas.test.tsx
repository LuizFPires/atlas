import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComprarAtlas } from './ComprarAtlas'
import { VERSAO_TERMOS } from '../web/textos-legais'

const EMAIL = 'ana@loja.com'
const URL_PAGAMENTO = 'https://checkout.stripe.com/c/pay/cs_test_1'
type Iniciar = Parameters<typeof ComprarAtlas>[0]['iniciar']

function montar(iniciar: Iniciar = vi.fn(async () => ({ ok: true as const, url: URL_PAGAMENTO })), abrirPagamento = vi.fn(async () => {})) {
  const onFechar = vi.fn(), onPagamentoAberto = vi.fn()
  render(<ComprarAtlas aberto email={EMAIL} onFechar={onFechar} iniciar={iniciar} abrirPagamento={abrirPagamento} onPagamentoAberto={onPagamentoAberto} />)
  return { iniciar, abrirPagamento, onFechar, onPagamentoAberto }
}
const aceitar = () => userEvent.click(screen.getByRole('checkbox'))
const ir = () => userEvent.click(screen.getByRole('button', { name: /Ir para o pagamento/ }))

test('mostra o preço do site e o e-mail da ativação, que não pode ser trocado', () => {
  montar()
  expect(screen.getByRole('dialog', { name: 'Ficar com o Atlas' })).toBeInTheDocument()
  expect(screen.getByText(/À vista: R\$\s4\.800,00\..*R\$ 200\/mês/)).toBeInTheDocument()
  expect(screen.getByText(EMAIL)).toBeInTheDocument()
  // O e-mail não é campo: só o CPF/CNPJ ("real só com CPF", M31).
  expect(screen.getAllByRole('textbox')).toHaveLength(1)
  expect(screen.getByLabelText(/CPF ou CNPJ de quem compra/)).toBeInTheDocument()
})

test('sem aceitar os termos não vai ao pagamento', async () => {
  const { iniciar } = montar()
  expect(screen.getByRole('button', { name: /Ir para o pagamento/ })).toBeDisabled()
  expect(iniciar).not.toHaveBeenCalled()
})

test('dá para ler a Política de Privacidade e os Termos de Uso sem sair do app', async () => {
  montar()
  await userEvent.click(screen.getByRole('button', { name: 'Termos de Uso' }))
  expect(screen.getByRole('region', { name: 'Termos de Uso' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Política de Privacidade' }))
  expect(screen.getByRole('region', { name: 'Política de Privacidade' })).toBeInTheDocument()
})

test('com aceite: pede o pagamento com o e-mail fixo, as parcelas escolhidas, a versão dos termos e a origem "app", e abre a Stripe', async () => {
  const { iniciar, abrirPagamento, onPagamentoAberto } = montar()
  await userEvent.type(screen.getByLabelText(/CPF ou CNPJ/), '52998224725')
  expect(screen.getByLabelText(/CPF ou CNPJ/)).toHaveValue('529.982.247-25')
  await userEvent.selectOptions(screen.getByRole('combobox'), '3')
  await aceitar()
  await ir()
  expect(iniciar).toHaveBeenCalledWith({ email: EMAIL, parcelas: 3, versaoTermos: VERSAO_TERMOS, origem: 'app', documento: '529.982.247-25' })
  expect(abrirPagamento).toHaveBeenCalledWith(URL_PAGAMENTO)
  expect(onPagamentoAberto).toHaveBeenCalledTimes(1)
  expect(await screen.findByRole('status')).toHaveTextContent('Abri a página de pagamento no seu navegador. Quando você pagar, eu aviso aqui.')
})

test('duplo clique abre um pagamento só', async () => {
  let soltar: (v: { ok: true; url: string }) => void = () => {}
  const iniciar = vi.fn(() => new Promise<{ ok: true; url: string }>((r) => { soltar = r }))
  montar(iniciar)
  await aceitar()
  const botao = screen.getByRole('button', { name: /Ir para o pagamento/ })
  await userEvent.click(botao)
  await userEvent.click(screen.getByRole('button', { name: /Abrindo o pagamento/ }))
  soltar({ ok: true, url: URL_PAGAMENTO })
  expect(await screen.findByRole('status')).toBeInTheDocument()
  expect(iniciar).toHaveBeenCalledTimes(1)
})

test('o servidor recusou: o recado aparece e dá para tentar de novo', async () => {
  const { abrirPagamento } = montar(vi.fn(async () => ({ ok: false as const, mensagem: 'Muitas tentativas. Espere uns minutos.' })))
  await aceitar()
  await ir()
  expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas. Espere uns minutos.')
  expect(abrirPagamento).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /Ir para o pagamento/ })).toBeEnabled()
})

test('o navegador não abriu a página (endereço recusado): avisa, sem dizer que abriu', async () => {
  const { onPagamentoAberto } = montar(undefined, vi.fn(async () => { throw new Error('host-nao-permitido') }))
  await aceitar()
  await ir()
  expect(await screen.findByRole('alert')).toHaveTextContent(/^Não consegui abrir a página de pagamento\. Isso é um defeito do Atlas.*Falar com o Atlas.*\(código: host-nao-permitido\)$/)
  expect(onPagamentoAberto).not.toHaveBeenCalled()
  expect(screen.queryByRole('status')).toBeNull()
})

test('fechado não mostra nada', () => {
  render(<ComprarAtlas aberto={false} email={EMAIL} onFechar={() => {}} iniciar={vi.fn()} abrirPagamento={vi.fn()} onPagamentoAberto={() => {}} />)
  expect(screen.queryByRole('dialog')).toBeNull()
})
