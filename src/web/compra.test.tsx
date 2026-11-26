import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { medicaoAnonima } from './medicao'
import { ModalCompra } from './ModalCompra'
import { iniciarCompra } from './compra'

const cfg = { api: 'https://api.atlas.test/functions/v1', contaId: 'conta-1' }
const resp = (status: number, corpo: unknown) => Promise.resolve(new Response(JSON.stringify(corpo), { status }))

describe('compra', () => {
  test('chama o checkout de implantação do M3 e devolve a URL do gateway', async () => {
    const f = vi.fn(() => resp(200, { url: 'https://checkout.stripe.com/c/pay/cs_1' }))
    const r = await iniciarCompra(' Ana@Loja.com ', cfg, f as unknown as typeof fetch, '1.0', 1, undefined, undefined, undefined, '529.982.247-25')
    expect(r).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/pay/cs_1' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.atlas.test/functions/v1/pagamento/checkout')
    expect(JSON.parse(init.body as string)).toEqual({ conta_id: 'conta-1', tipo: 'implantacao', email: 'ana@loja.com', parcelas: 1, aceite_termos: true, versao_termos: '1.0', documento: '52998224725' })
  })
  test('app pronto: manda tipo prateleira e o segmento ao checkout', async () => {
    const f = vi.fn(() => resp(200, { url: 'https://checkout.stripe.com/c/pay/cs_2' }))
    await iniciarCompra('ana@loja.com', cfg, f as unknown as typeof fetch, '1.0', 4, 'barbearia', undefined, undefined, '52998224725')
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
    const erro = await iniciarCompra('ana@loja.com', cfg, (() => resp(429, { mensagem: 'Muitas tentativas. Espere uns minutos.' })) as unknown as typeof fetch, '1.0', 1, undefined, undefined, undefined, '52998224725')
    expect(erro).toEqual({ ok: false, mensagem: 'Muitas tentativas. Espere uns minutos.' })
    expect((await iniciarCompra('ana@loja.com', cfg, (() => resp(200, { url: 'http://x.test' })) as unknown as typeof fetch, '1.0', 1, undefined, undefined, undefined, '52998224725')).ok).toBe(false)
  })
  test('o modal avisa quando o e-mail está errado', async () => {
    render(<ModalCompra aberto onFechar={() => {}} abrirPagamento={() => {}} />)
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ana')
    await userEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }))
    await userEvent.click(screen.getByRole('button', { name: /Ir para o pagamento/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Confira o e-mail/)
  })
})

describe('real só com CPF (M31)', () => {
  test('sem CPF/CNPJ válido a compra em real nem sai do navegador, e a tela explica', async () => {
    const f = vi.fn()
    for (const d of [undefined, '', '529.982.247-24']) {
      const r = await iniciarCompra('ana@loja.com', cfg, f as unknown as typeof fetch, '1.0', 1, undefined, undefined, undefined, d)
      expect(r).toEqual({ ok: false, mensagem: expect.stringMatching(/CPF ou o CNPJ.*em dólar/) })
    }
    expect(f).not.toHaveBeenCalled()
  })
  test('em dólar não pede documento', async () => {
    const f = vi.fn(() => resp(200, { url: 'https://checkout.stripe.com/c/pay/cs_3' }))
    expect((await iniciarCompra('ana@loja.com', cfg, f as unknown as typeof fetch, '1.0', 1, undefined, undefined, 'us')).ok).toBe(true)
  })
  test('o modal em real tem o campo CPF ou CNPJ, com a pontuação automática e o aviso de quem não tem documento', async () => {
    render(<ModalCompra aberto onFechar={() => {}} abrirPagamento={() => {}} />)
    const campo = screen.getByLabelText(/CPF ou CNPJ de quem compra/)
    await userEvent.type(campo, '11222333000181')
    expect(campo).toHaveValue('11.222.333/0001-81')
    expect(screen.getByText(/de fora do Brasil, a compra é pela página em inglês, em dólar/)).toBeInTheDocument()
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

describe('medição', () => {
  test('a medição é anônima e não depende de consentimento (sem banner)', () => {
    // Contagem agregada e cookieless: roda sob interesse legítimo (LGPD), sem pedir nada.
    expect(medicaoAnonima()).toBe(true)
  })
})

test('compra feita de dentro do app manda a origem "app"; pelo site não manda origem', async () => {
  const f = vi.fn(async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/x' }), { status: 200 }))
  const cfg = { api: 'https://x.test', contaId: 'c1' }
  await iniciarCompra('ana@loja.com', cfg, f as unknown as typeof fetch, '1.0', 2, undefined, 'app', undefined, '52998224725')
  await iniciarCompra('ana@loja.com', cfg, f as unknown as typeof fetch, '1.0', 2, undefined, undefined, undefined, '52998224725')
  const corpos = (f.mock.calls as unknown as [string, RequestInit][]).map((c) => JSON.parse(c[1].body as string))
  expect(corpos[0]).toMatchObject({ origem: 'app', tipo: 'implantacao', parcelas: 2 })
  expect('origem' in corpos[1]).toBe(false)
})

describe('compra em dólar (M31)', () => {
  test('mercado us: manda "mercado: us" ao checkout e as mensagens saem em inglês', async () => {
    const f = vi.fn(() => resp(200, { url: 'https://checkout.stripe.com/c/pay/cs_us' }))
    await iniciarCompra('john@shop.com', cfg, f as unknown as typeof fetch, '1.2', 1, undefined, undefined, 'us')
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({ tipo: 'implantacao', mercado: 'us', parcelas: 1 })
    expect(await iniciarCompra('john', cfg, f as unknown as typeof fetch, '1.2', 1, undefined, undefined, 'us')).toEqual({ ok: false, mensagem: 'Check the email: it needs an @ and an ending, like .com.' })
  })
  test('modal em inglês: $1,700 à vista, sem parcelas, e nenhum texto em português', () => {
    render(<ModalCompra idioma="en" aberto onFechar={() => {}} abrirPagamento={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Where should we send your access?' })).toBeInTheDocument()
    expect(screen.getByText(/\$1,700, one payment/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByRole('dialog').textContent).not.toMatch(/[ãõçáéíóúâêô]|R\$|Pix/)
  })
})
