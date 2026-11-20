import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Mercearia } from './Mercearia'
import { PERSONALIZACAO_EXEMPLO, personalizacaoSegura, variaveisDoTema } from './personalizacao'

test('a personalização troca nome e cores do tema', () => {
  const { rerender } = render(<Mercearia personalizacao={PERSONALIZACAO_EXEMPLO} />)
  const app = screen.getByTestId('app-mercearia')
  expect(screen.getByRole('heading', { name: 'Mercearia do Seu Zé' })).toBeInTheDocument()
  expect(app.style.getPropertyValue('--lime')).toBe('#34D399')
  expect(app.style.getPropertyValue('--soft')).toBe('#12261F')
  rerender(<Mercearia personalizacao={{ nome: 'Empório Bela', corPrincipal: '#f472b6', corApoio: '#3A2A12' }} />)
  expect(screen.getByRole('heading', { name: 'Empório Bela' })).toBeInTheDocument()
  expect(app.style.getPropertyValue('--lime')).toBe('#F472B6')
})

test('cor inválida cai na padrão e não entra no CSS', () => {
  const s = personalizacaoSegura({ nome: ' ', corPrincipal: 'red;}body{', corApoio: 'zzz' })
  expect(s.corPrincipal).toBe('#C6F135')
  expect(s.nome).toBe('Minha mercearia')
  expect(JSON.stringify(variaveisDoTema(s))).not.toContain('body')
})

test('navega entre Estoque, Vender e Avisos', async () => {
  render(<Mercearia personalizacao={PERSONALIZACAO_EXEMPLO} telas={{ estoque: <p>t1</p>, vender: <p>t2</p>, avisos: <p>t3</p> }} />)
  expect(screen.getByText('t1')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vender' }))
  expect(screen.getByText('t2')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Avisos' }))
  expect(screen.getByText('t3')).toBeInTheDocument()
})
