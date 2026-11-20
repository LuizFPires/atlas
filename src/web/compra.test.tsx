import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BannerCookies, lerEscolha, medicaoPermitida } from './Cookies'
import { ModalCompra } from './ModalCompra'
import { iniciarCompra } from './compra'

const cfg = { api: 'https://api.atlas.test/functions/v1', contaId: 'conta-1' }
const resp = (status: number, corpo: unknown) => Promise.resolve(new Response(JSON.stringify(corpo), { status }))

describe('compra', () => {
  test('chama o checkout de implantação do M3 e devolve a URL do gateway', async () => {
    const f = vi.fn(() => resp(200, { url: 'https://checkout.stripe.com/c/pay/cs_1' }))
    const r = await iniciarCompra(' Ana@Loja.com ', cfg, f as unknown as typeof fetch, '1.0')
    expect(r).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/pay/cs_1' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.atlas.test/functions/v1/pagamento/checkout')
    expect(JSON.parse(init.body as string)).toEqual({ conta_id: 'conta-1', tipo: 'implantacao', email: 'ana@loja.com', parcelas: 1, aceite_termos: true, versao_termos: '1.0' })
  })
  test('app pronto: manda tipo prateleira e o segmento ao checkout', async () => {
    const f = vi.fn(() => resp(200, { url: 'https://checkout.stripe.com/c/pay/cs_2' }))
    await iniciarCompra('ana@loja.com', cfg, f as unknown as typeof fetch, '1.0', 4, 'barbearia')
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({ tipo: 'prateleira', segmento: 'barbearia', parcelas: 4 })
  })
  test('modal da prateleira mostra R$ 7.300 e as parcelas do app pronto', async () => {
    render(<ModalCompra aberto segmento="academia" onFechar={() => {}} abrirPagamento={() => {}} />)
    expect(screen.getByText(/À vista: R\$\s7\.300,00/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /3x de R\$\s2\.433,33 \(sem juros\)/ })).toBeInTheDocument()
    expect(screen.getByText(/de uma empresa só/)).toBeInTheDocument()
  })
  test('e-mail ruim, sem configuração, erro do servidor e URL não https não vão ao pagamento', async () => {
    const f = vi.fn()
    expect((await iniciarCompra('ana', cfg, f, '1.0')).ok).toBe(false)
    expect((await iniciarCompra('ana@loja.com', null, f, '1.0')).ok).toBe(false)
    expect(f).not.toHaveBeenCalled()
    const erro = await iniciarCompra('ana@loja.com', cfg, (() => resp(429, { mensagem: 'Muitas tentativas. Espere uns minutos.' })) as unknown as typeof fetch, '1.0')
    expect(erro).toEqual({ ok: false, mensagem: 'Muitas tentativas. Espere uns minutos.' })
    expect((await iniciarCompra('ana@loja.com', cfg, (() => resp(200, { url: 'http://x.test' })) as unknown as typeof fetch, '1.0')).ok).toBe(false)
  })
  test('o modal avisa quando o e-mail está errado', async () => {
    render(<ModalCompra aberto onFechar={() => {}} abrirPagamento={() => {}} />)
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ana')
    await userEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }))
    await userEvent.click(screen.getByRole('button', { name: /Ir para o pagamento/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Confira o e-mail/)
  })
})

describe('consentimento (LGPD)', () => {
  test('sem aceite a compra nem sai do navegador', async () => {
    const f = vi.fn()
    const r = await iniciarCompra('ana@loja.com', cfg, f as unknown as typeof fetch)
    expect(r).toMatchObject({ ok: false })
    expect(f).not.toHaveBeenCalled()
  })
  test('o botão de pagamento fica desligado até marcar a caixa, que tem links para a política e os termos', async () => {
    const abrir = vi.fn()
    render(<ModalCompra aberto onFechar={() => {}} abrirPagamento={abrir} />)
    const botao = screen.getByRole('button', { name: /Ir para o pagamento/ })
    expect(botao).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/privacidade')
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos')
    await userEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }))
    expect(botao).toBeEnabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }))
    expect(botao).toBeDisabled()
    expect(abrir).not.toHaveBeenCalled()
  })
})

describe('cookies', () => {
  beforeEach(() => localStorage.clear())
  test('sem escolha a medição fica desligada e a opção privada é a principal', async () => {
    render(<BannerCookies />)
    expect(medicaoPermitida()).toBe(false)
    const botoes = screen.getAllByRole('button')
    expect(botoes[0]).toHaveTextContent('Só o necessário')
    await userEvent.click(botoes[0])
    expect(lerEscolha()).toBe('essenciais')
    expect(medicaoPermitida()).toBe(false)
    expect(screen.queryByRole('region')).toBeNull()
  })
  test('aceitar a contagem liga a medição', async () => {
    render(<BannerCookies />)
    await userEvent.click(screen.getByRole('button', { name: /Aceitar a contagem/ }))
    expect(medicaoPermitida()).toBe(true)
  })
})
