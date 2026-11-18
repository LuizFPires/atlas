import { render, screen, act } from '@testing-library/react'
import { TemaProvider, useTema } from './tema'

function Botao() {
  const { tema, setTema } = useTema()
  return <button onClick={() => setTema('claro')}>{tema}</button>
}

test('escuro é o padrão e o claro troca o data-theme', () => {
  render(<TemaProvider><Botao /></TemaProvider>)
  expect(document.documentElement.dataset.theme).toBe('escuro')
  act(() => screen.getByRole('button').click())
  expect(document.documentElement.dataset.theme).toBe('claro')
})
