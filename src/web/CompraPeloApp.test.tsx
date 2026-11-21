import { render, screen } from '@testing-library/react'
import { CompraPeloApp } from './CompraPeloApp'

test('pagamento confirmado: manda voltar para o Atlas, sem pedir cadastro nem falar de outro e-mail', () => {
  const { container } = render(<CompraPeloApp />)
  expect(screen.getByRole('heading', { name: 'Pagamento confirmado.' })).toBeInTheDocument()
  expect(screen.getByText('Pode voltar para o Atlas: ele já sabe que você comprou.')).toBeInTheDocument()
  expect(container.querySelector('form, input')).toBeNull()
})

test('desistiu do pagamento: nada foi cobrado e o caminho de volta é o botão dentro do Atlas', () => {
  render(<CompraPeloApp cancelada />)
  expect(screen.getByRole('heading', { name: 'Nada foi cobrado.' })).toBeInTheDocument()
  expect(screen.getByText('Quando quiser, é só clicar de novo em Quero o Atlas, dentro do Atlas.')).toBeInTheDocument()
})
