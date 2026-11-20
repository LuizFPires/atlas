import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Vender } from './Vender'
import { criarDadosFixture } from './dados'
import { criarCupomFixture, textoDoCupom } from './cupom'

const H = '2026-01-10'

test('soma o total e fecha a venda dando baixa no estoque', async () => {
  const dados = criarDadosFixture(H)
  render(<Vender dados={dados} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Adicionar à venda: Arroz 5 kg' }))
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar à venda: Arroz 5 kg' }))
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar à venda: Café 500 g' }))
  expect(screen.getByTestId('total-venda')).toHaveTextContent('R$ 76,70') // 2x28,90 + 18,90
  await userEvent.click(screen.getByRole('button', { name: 'Fechar venda' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Venda fechada: R$ 76,70')
  const p = await dados.listarProdutos()
  expect(p.find((x) => x.id === 'p1')?.quantidade).toBe(22)
  expect(p.find((x) => x.id === 'p4')?.quantidade).toBe(17)
  expect(screen.getByTestId('total-venda')).toHaveTextContent('R$ 0,00')
})

test('não deixa vender mais do que tem', async () => {
  const dados = criarDadosFixture(H)
  render(<Vender dados={dados} />)
  const add = await screen.findByRole('button', { name: 'Adicionar à venda: Sabão em pó' }) // tem 2
  await userEvent.click(add); await userEvent.click(add); await userEvent.click(add)
  expect(screen.getByRole('alert')).toHaveTextContent('Só tem 2 de Sabão em pó')
  expect(screen.getByTestId('total-venda')).toHaveTextContent('R$ 25,00')
})

test('a porta recusa venda sem saldo e não baixa nada (tudo ou nada)', async () => {
  const dados = criarDadosFixture(H)
  const r = await dados.fecharVenda([{ produtoId: 'p1', qtd: 1 }, { produtoId: 'p5', qtd: 3 }])
  expect(r).toEqual({ ok: false, mensagem: 'Só tem 2 de Sabão em pó no estoque.' })
  expect((await dados.listarProdutos()).find((x) => x.id === 'p1')?.quantidade).toBe(24)
  expect((await dados.fecharVenda([])).ok).toBe(false)
  // mesmo produto em duas linhas é somado antes de conferir
  expect((await dados.fecharVenda([{ produtoId: 'p5', qtd: 2 }, { produtoId: 'p5', qtd: 1 }])).ok).toBe(false)
})

test('tirar da venda desfaz a linha e produto zerado não pode ser adicionado', async () => {
  const dados = criarDadosFixture(H)
  await dados.registrarSaida('p5', 2)
  render(<Vender dados={dados} />)
  expect(await screen.findByRole('button', { name: 'Adicionar à venda: Sabão em pó' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar à venda: Café 500 g' }))
  const itens = screen.getByRole('list', { name: 'Itens da venda' })
  await userEvent.click(within(itens).getByRole('button', { name: 'Tirar da venda: Café 500 g' }))
  expect(screen.getByText('Nenhum produto na venda ainda.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Fechar venda' })).toBeDisabled()
})

test('cupom é uma porta: o fixture não imprime de verdade e avisa', async () => {
  const cupom = criarCupomFixture()
  render(<Vender dados={criarDadosFixture(H)} cupom={cupom} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Adicionar à venda: Leite integral 1 L' }))
  await userEvent.click(screen.getByRole('button', { name: 'Fechar venda' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Imprimir cupom' }))
  expect(await screen.findByText(/nada foi impresso de verdade/)).toBeInTheDocument()
  expect(cupom.impressos[0]).toContain('1x Leite integral 1 L')
  expect(cupom.impressos[0]).toContain('TOTAL R$ 5,49')
  expect(textoDoCupom({ id: 'v', linhas: [], totalCentavos: 0 })).toContain('TOTAL R$ 0,00')
})

test('quando a porta rejeita, mostra aviso amigável', async () => {
  const dados = criarDadosFixture(H)
  vi.spyOn(dados, 'listarProdutos').mockRejectedValue(new Error('rede'))
  render(<Vender dados={dados} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar/salvar agora. Tente de novo.')
})
