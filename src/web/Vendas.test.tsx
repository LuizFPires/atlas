import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Vendas } from './Vendas'

const montar = (onComprar = vi.fn()) => {
  const r = render(<TemaProvider><Vendas onComprar={onComprar} /></TemaProvider>)
  return { onComprar, ...r }
}

test('mostra as seções da página de vendas e o preço confirmado', () => {
  montar()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sem saber programar')
  for (const t of ['Se dá para explicar, dá para construir.', 'Fazer um sistema é igual construir uma casa.', 'Perguntas de quem nunca programou']) {
    expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
  }
  expect(screen.getByText('R$ 4.800')).toBeInTheDocument()
  expect(screen.getByText(/Espaço para depoimentos reais/)).toBeInTheDocument()
  expect(screen.getAllByAltText(/canteiro 3D/i).length).toBeGreaterThan(0)
})

test('os botões de compra chamam onComprar', async () => {
  const { onComprar } = montar()
  await userEvent.click(screen.getAllByRole('button', { name: /Quero construir o meu/ })[0])
  expect(onComprar).toHaveBeenCalled()
})

test('não usa emoji nem promete atendimento humano', () => {
  const { container } = montar()
  expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
  expect(container.textContent).not.toMatch(/atendente|suporte humano|falar com (uma )?pessoa/i)
})

test('vitrine Comece pronto: 4 segmentos, preço e botão que abre a compra do segmento', async () => {
  const onComprarPronto = vi.fn()
  render(<TemaProvider><Vendas onComprar={vi.fn()} onComprarPronto={onComprarPronto} /></TemaProvider>)
  for (const n of ['Barbearia', 'Restaurante', 'Mercearia', 'Academia']) expect(screen.getByRole('button', { name: `Começar pronto: ${n}` })).toBeInTheDocument()
  expect(screen.getAllByText('R$ 7.300')).toHaveLength(4)
  expect(screen.getByText(/de uma empresa só/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Começar pronto: Mercearia' }))
  expect(onComprarPronto).toHaveBeenCalledWith('mercearia')
})

test('perto do preço: o Atlas só funciona com uma assinatura do Claude, paga à parte, e plano maior anda mais rápido', () => {
  render(<Vendas onComprar={() => {}} />)
  const aviso = screen.getByRole('note', { name: 'Assinatura do Claude' })
  expect(aviso).toHaveTextContent('O Atlas só funciona com uma assinatura do Claude')
  expect(aviso).toHaveTextContent('paga direto à Anthropic, à parte do Atlas')
  expect(aviso).toHaveTextContent('Quanto maior o plano, mais rápido a obra anda')
  expect(aviso).not.toHaveTextContent(/plano Pro|no Max/)
})
