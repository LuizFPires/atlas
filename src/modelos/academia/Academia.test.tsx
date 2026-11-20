import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Academia } from './Academia'
import { PERSONALIZACAO_EXEMPLO, personalizacaoSegura, variaveisDoTema } from './personalizacao'

test('a personalização troca nome e cores do tema', () => {
  const { rerender } = render(<Academia personalizacao={PERSONALIZACAO_EXEMPLO} />)
  const app = screen.getByTestId('app-academia')
  expect(screen.getByRole('heading', { name: 'Academia Corpo em Dia' })).toBeInTheDocument()
  expect(app.style.getPropertyValue('--lime')).toBe('#F59E0B')
  expect(app.style.getPropertyValue('--soft')).toBe('#2A1F0A')
  rerender(<Academia personalizacao={{ nome: 'Studio Bela', corPrincipal: '#f472b6', corApoio: '#3A2A12' }} />)
  expect(screen.getByRole('heading', { name: 'Studio Bela' })).toBeInTheDocument()
  expect(app.style.getPropertyValue('--lime')).toBe('#F472B6')
})

test('cor inválida cai na padrão e não entra no CSS', () => {
  const s = personalizacaoSegura({ nome: ' ', corPrincipal: 'red;}body{', corApoio: 'zzz' })
  expect(s.corPrincipal).toBe('#C6F135')
  expect(s.nome).toBe('Minha academia')
  expect(JSON.stringify(variaveisDoTema(s))).not.toContain('body')
})

test('navega entre Alunos, Treino, Check-in e Evolução', async () => {
  render(<Academia personalizacao={PERSONALIZACAO_EXEMPLO} telas={{ alunos: <p>t1</p>, treino: <p>t2</p>, checkin: <p>t3</p>, evolucao: <p>t4</p> }} />)
  expect(screen.getByText('t1')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Treino' }))
  expect(screen.getByText('t2')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Check-in' }))
  expect(screen.getByText('t3')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Evolução' }))
  expect(screen.getByText('t4')).toBeInTheDocument()
})
