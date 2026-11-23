import { act, render, screen, within } from '@testing-library/react'
import { progressoEstimado, Trabalhando } from './Trabalhando'

afterEach(() => vi.useRealTimers())

test('o progresso estimado anda sempre, desacelera e nunca chega a 100% sozinho', () => {
  const a = progressoEstimado(10, 120), b = progressoEstimado(60, 120), c = progressoEstimado(600, 120)
  expect(a).toBeGreaterThan(0)
  expect(b).toBeGreaterThan(a)
  expect(c).toBeGreaterThan(b)
  expect(c).toBeLessThanOrEqual(95)
})

test('mostra o que está fazendo: barra que anda, etapas que vão sendo marcadas e o tempo passado', () => {
  vi.useFakeTimers()
  render(<Trabalhando titulo="O Claude está desenhando as telas" etapas={['Lendo o que você contou', 'Montando as telas', 'Aplicando o seu estilo', 'Conferindo cada detalhe']} segundos={120} />)
  const caixa = screen.getByRole('status', { name: 'O Claude está desenhando as telas' })
  const barra = within(caixa).getByRole('progressbar')
  const antes = Number(barra.getAttribute('aria-valuenow'))
  expect(within(caixa).getByText('Lendo o que você contou').closest('li')).toHaveAttribute('data-fase', 'agora')
  act(() => { vi.advanceTimersByTime(90_000) })
  expect(Number(barra.getAttribute('aria-valuenow'))).toBeGreaterThan(antes)
  expect(within(caixa).getByText('Lendo o que você contou').closest('li')).toHaveAttribute('data-fase', 'feita')
  expect(within(caixa).getByText('1:30')).toBeInTheDocument()
  expect(within(caixa).getByText(/Leva uns 2 minutos/)).toBeInTheDocument()
})
