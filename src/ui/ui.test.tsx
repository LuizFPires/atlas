import { render, screen } from '@testing-library/react'
import { Botao } from './Botao'
import { Cartao } from './Cartao'
import { Chip } from './Chip'
import { Microfone } from './Microfone'
import { Bolinha } from './Bolinha'

test('botão principal e secundário', () => {
  render(<><Botao>Ir</Botao><Botao variante="secundario">Voltar</Botao></>)
  expect(screen.getByText('Ir')).toHaveClass('at-botao--principal')
  expect(screen.getByText('Voltar')).toHaveClass('at-botao--secundario')
})
test('cartão selecionado e chip ativo', () => {
  render(<><Cartao selecionado data-testid="c">x</Cartao><Chip ativo>1h</Chip></>)
  expect(screen.getByTestId('c')).toHaveClass('at-cartao--sel')
  expect(screen.getByRole('button', { name: '1h' })).toHaveAttribute('aria-pressed', 'true')
})
test('microfone indica gravação', () => {
  render(<Microfone gravando onAlternar={() => {}} />)
  expect(screen.getByRole('button', { name: 'Parar de gravar' })).toHaveClass('at-mic--gravando')
})
test('bolinha usa svg, não emoji', () => {
  const { container } = render(<Bolinha icone="check" />)
  expect(container.querySelector('svg')).not.toBeNull()
})
