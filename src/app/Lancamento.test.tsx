import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lancamento, Lancamentos } from './Lancamento'
import { criarLancamentoFixture } from './ponte-lancamento'

const obra = { nome: 'Ponto', pasta: 'ponto' }

describe('lançamento (M60, LC1)', () => {
  it('começar: opcional, explica Incorporador e Síndico e mostra os preços sugeridos', async () => {
    render(<Lancamento obra={obra} lancamento={criarLancamentoFixture()} onGuia={() => {}} />)
    expect(await screen.findByText(/OPCIONAL · VENDER O PONTO/)).toBeInTheDocument()
    expect(screen.getByText(/Incorporador/)).toBeInTheDocument()
    expect(screen.getByText(/Síndico/)).toBeInTheDocument()
    for (const p of ['Grátis', 'Mensal', 'Anual']) expect(screen.getByText(new RegExp(`^${p}`))).toBeInTheDocument()
    expect(screen.getByText(/nada muda/)).toBeInTheDocument()
  })

  it('Stripe e Asaas lado a lado; escolher abre o passo a passo da conta e "Já criei" fecha a etapa', async () => {
    const onGuia = vi.fn()
    render(<Lancamento obra={obra} lancamento={criarLancamentoFixture()} onGuia={onGuia} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Começar o lançamento →' }))
    const stripe = await screen.findByRole('region', { name: 'Stripe' })
    const asaas = screen.getByRole('region', { name: 'Asaas' })
    expect(within(stripe).getByText(/não dá para cobrar a mensalidade no Pix/)).toBeInTheDocument()
    expect(within(asaas).getByText(/Pix Automático/)).toBeInTheDocument()
    await userEvent.click(within(asaas).getByRole('button', { name: 'Escolher o Asaas →' }))
    await userEvent.click(await screen.findByRole('button', { name: /Criar a conta do Asaas/ }))
    expect(onGuia).toHaveBeenCalledWith(expect.objectContaining({ id: 'asaas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Já criei a conta' }))
    expect(await screen.findByText(/PRONTO PARA A PÁGINA DE VENDAS/)).toBeInTheDocument()
  })

  it('a tela Lançamentos mostra só as obras que o cliente decidiu vender', async () => {
    const l = criarLancamentoFixture()
    const { unmount } = render(<Lancamentos lancamento={l} onAbrir={() => {}} />)
    expect(await screen.findByText(/Só aparecem aqui as obras que você decidiu vender/)).toBeInTheDocument()
    expect(screen.getByText(/Nenhuma obra à venda ainda/)).toBeInTheDocument()
    unmount()
    await l.comecar('ponto')
    const abrir = vi.fn()
    render(<Lancamentos lancamento={l} onAbrir={abrir} />)
    await userEvent.click(await screen.findByRole('button', { name: /ponto/ }))
    expect(abrir).toHaveBeenCalledWith('ponto')
  })
})

describe('uso interno que vira venda (M64)', () => {
  it('avisa da obra de adaptação (leva mais tempo) e só começa adaptando', async () => {
    const l = criarLancamentoFixture({ usoInterno: ['ponto'] })
    const comecar = vi.spyOn(l, 'comecar')
    render(<Lancamento obra={obra} lancamento={l} onGuia={() => {}} />)
    expect(await screen.findByText(/OBRA DE ADAPTAÇÃO · LEVA MAIS TEMPO/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Adaptar e começar o lançamento →' }))
    expect(comecar).toHaveBeenCalledWith('ponto', true)
    expect(await screen.findByText(/A obra de adaptação foi para a linha/)).toBeInTheDocument()
  })
})
