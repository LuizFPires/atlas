import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Restaurante } from './Restaurante'
import { PERSONALIZACAO_EXEMPLO, personalizacaoSegura, variaveisDoTema } from './personalizacao'

test('a personalização troca nome e cores do tema', () => {
  const { rerender } = render(<Restaurante personalizacao={PERSONALIZACAO_EXEMPLO} />)
  const app = screen.getByTestId('app-restaurante')
  expect(screen.getByRole('heading', { name: 'Restaurante da Dona Maria' })).toBeInTheDocument()
  expect(app.style.getPropertyValue('--lime')).toBe('#FB923C')
  expect(app.style.getPropertyValue('--soft')).toBe('#2A1D12')
  rerender(<Restaurante personalizacao={{ nome: 'Cantina Bela', corPrincipal: '#f472b6', corApoio: '#3A2A12' }} />)
  expect(screen.getByRole('heading', { name: 'Cantina Bela' })).toBeInTheDocument()
  expect(app.style.getPropertyValue('--lime')).toBe('#F472B6')
})

test('cor inválida cai na padrão e não entra no CSS', () => {
  const s = personalizacaoSegura({ nome: ' ', corPrincipal: 'red;}body{', corApoio: 'zzz' })
  expect(s.corPrincipal).toBe('#C6F135')
  expect(s.nome).toBe('Meu restaurante')
  expect(JSON.stringify(variaveisDoTema(s))).not.toContain('body')
})

test('navega entre Cardápio, Pedidos e Cozinha', async () => {
  render(<Restaurante personalizacao={PERSONALIZACAO_EXEMPLO} telas={{ cardapio: <p>t1</p>, pedidos: <p>t2</p>, cozinha: <p>t3</p> }} />)
  expect(screen.getByText('t1')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Pedidos' }))
  expect(screen.getByText('t2')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cozinha' }))
  expect(screen.getByText('t3')).toBeInTheDocument()
})
