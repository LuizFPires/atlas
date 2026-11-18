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
    const r = await iniciarCompra(' Ana@Loja.com ', cfg, f as unknown as typeof fetch)
    expect(r).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/pay/cs_1' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.atlas.test/functions/v1/pagamento/checkout')
    expect(JSON.parse(init.body as string)).toEqual({ conta_id: 'conta-1', tipo: 'implantacao', email: 'ana@loja.com' })
  })
  test('e-mail ruim, sem configuração, erro do servidor e URL não https não vão ao pagamento', async () => {
    const f = vi.fn()
    expect((await iniciarCompra('ana', cfg, f)).ok).toBe(false)
    expect((await iniciarCompra('ana@loja.com', null, f)).ok).toBe(false)
    expect(f).not.toHaveBeenCalled()
    const erro = await iniciarCompra('ana@loja.com', cfg, (() => resp(429, { mensagem: 'Muitas tentativas. Espere uns minutos.' })) as unknown as typeof fetch)
    expect(erro).toEqual({ ok: false, mensagem: 'Muitas tentativas. Espere uns minutos.' })
    expect((await iniciarCompra('ana@loja.com', cfg, (() => resp(200, { url: 'http://x.test' })) as unknown as typeof fetch)).ok).toBe(false)
  })
  test('o modal avisa quando o e-mail está errado', async () => {
    render(<ModalCompra aberto onFechar={() => {}} abrirPagamento={() => {}} />)
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ana')
    await userEvent.click(screen.getByRole('button', { name: /Ir para o pagamento/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Confira o e-mail/)
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
