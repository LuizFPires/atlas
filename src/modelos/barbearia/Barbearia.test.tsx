import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Barbearia } from './Barbearia'
import { PERSONALIZACAO_EXEMPLO, personalizacaoSegura, variaveisDoTema } from './personalizacao'

test('a personalização troca nome e cores do tema', () => {
  const { rerender } = render(<Barbearia personalizacao={PERSONALIZACAO_EXEMPLO} />)
  const app = screen.getByTestId('app-barbearia')
  expect(screen.getByRole('heading', { name: 'Barbearia do Zé' })).toBeInTheDocument()
  expect(app.style.getPropertyValue('--lime')).toBe('#38BDF8')
  expect(app.style.getPropertyValue('--soft')).toBe('#1E2125')
  rerender(<Barbearia personalizacao={{ nome: 'Corte Fino', corPrincipal: '#f472b6', corApoio: '#3A2A12' }} />)
  expect(screen.getByRole('heading', { name: 'Corte Fino' })).toBeInTheDocument()
  expect(app.style.getPropertyValue('--lime')).toBe('#F472B6')
  expect(app.style.getPropertyValue('--soft')).toBe('#3A2A12')
})

test('cor inválida cai na padrão e não entra no CSS', () => {
  const s = personalizacaoSegura({ nome: ' ', corPrincipal: 'red;}body{', corApoio: 'zzz' })
  expect(s.corPrincipal).toBe('#C6F135')
  expect(s.nome).toBe('Minha barbearia')
  expect(JSON.stringify(variaveisDoTema(s))).not.toContain('body')
})

test('navega entre Agenda e Clientes', async () => {
  render(<Barbearia personalizacao={PERSONALIZACAO_EXEMPLO} telas={{ agenda: <p>tela agenda</p>, clientes: <p>tela clientes</p> }} />)
  expect(screen.getByText('tela agenda')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Clientes' }))
  expect(screen.getByText('tela clientes')).toBeInTheDocument()
})
