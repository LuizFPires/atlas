import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginaVendas } from './PaginaVendas'
import { criarVendasFixture } from './ponte-vendas'

const obra = { nome: 'Ponto', pasta: 'ponto' }

describe('página de vendas (M61, LC4)', () => {
  it('desenha a versão 1 num quadro protegido (sem script)', async () => {
    render(<PaginaVendas obra={obra} gateway="asaas" vendas={criarVendasFixture({ passoMs: 5 })} onGuia={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: /Desenhar a página de vendas/ }))
    const quadro = await screen.findByTitle('Página de vendas do Ponto, versão 1')
    expect(quadro).toHaveAttribute('sandbox', '')
    expect(quadro.getAttribute('srcdoc')).toMatch(/Content-Security-Policy/)
  })

  it('tocar na página cria uma marcação; escrever e mandar faz a versão 2', async () => {
    render(<PaginaVendas obra={obra} gateway="asaas" vendas={criarVendasFixture({ passoMs: 5 })} onGuia={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: /Desenhar a página de vendas/ }))
    const camada = await screen.findByRole('button', { name: 'Tocar para marcar um ponto da página' })
    fireEvent.click(camada, { clientX: 120, clientY: 80 })
    await userEvent.type(screen.getByRole('textbox', { name: /Marcação 1/ }), 'Trocar o título')
    await userEvent.click(screen.getByRole('button', { name: 'Mandar 1 ajuste para o Atlas' }))
    expect(await screen.findByTitle('Página de vendas do Ponto, versão 2')).toBeInTheDocument()
    expect(screen.getByText(/Fiz 1 ajuste/)).toBeInTheDocument()
  })

  it('aprovar pede a chave de TESTE, faz a compra de teste e só então deixa abrir com a chave de verdade', async () => {
    const onGuia = vi.fn()
    render(<PaginaVendas obra={obra} gateway="asaas" vendas={criarVendasFixture({ passoMs: 5 })} onGuia={onGuia} intervaloMs={10} />)
    await userEvent.click(await screen.findByRole('button', { name: /Desenhar a página de vendas/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar e publicar a página →' }))
    await userEvent.click(screen.getByRole('button', { name: /Pegar a chave de teste do Asaas/ }))
    expect(onGuia).toHaveBeenCalledWith(expect.objectContaining({ id: 'chave-asaas-teste' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Chave de teste do Asaas' }), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Construir e testar' }))
    expect(await screen.findByText(/não parece certa/)).toBeInTheDocument()
    await userEvent.clear(screen.getByRole('textbox', { name: 'Chave de teste do Asaas' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Chave de teste do Asaas' }), '$aact_hmlg_' + 'x'.repeat(30))
    await userEvent.click(screen.getByRole('button', { name: 'Construir e testar' }))
    expect(await screen.findByText(/A conta da empresa foi criada/, {}, { timeout: 3000 })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Chave de verdade do Asaas' }), '$aact_prod_' + 'y'.repeat(30))
    await userEvent.click(screen.getByRole('button', { name: 'Abrir as vendas →' }))
    expect(await screen.findByText(/AS VENDAS ESTÃO ABERTAS/)).toBeInTheDocument()
  })
})

describe('o painel do Síndico (M62, LC5)', () => {
  it('vendas abertas: monta o painel do dono e mostra os números do topo, lidos do sistema do cliente', async () => {
    const vendas = criarVendasFixture({ passoMs: 5 })
    await vendas.desenhar('ponto', 'Ponto')
    await vendas.aprovar('ponto', 'sk_test_' + 'x'.repeat(30))
    await new Promise((r) => setTimeout(r, 30))
    await vendas.abrir('ponto', 'sk_live_' + 'x'.repeat(30))
    const abrir = vi.spyOn(vendas, 'abrirPainel')
    render(<PaginaVendas obra={obra} gateway="stripe" vendas={vendas} onGuia={() => {}} intervaloMs={10} />)
    await userEvent.click(await screen.findByRole('button', { name: /Montar o meu painel de dono/ }))
    const numeros = await screen.findByRole('group', { name: 'Números do painel do dono' }, { timeout: 3000 })
    expect(numeros).toHaveTextContent('38')
    expect(numeros).toHaveTextContent('R$ 1.862')
    expect(numeros).toHaveTextContent('3')
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o meu painel de dono →' }))
    expect(abrir).toHaveBeenCalledWith('ponto')
  })
})
