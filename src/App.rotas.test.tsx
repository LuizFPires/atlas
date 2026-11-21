import { render, screen } from '@testing-library/react'
import App from './App'
import { TemaProvider } from './tema/tema'

const abrir = (caminho: string) => { window.history.pushState({}, '', caminho); return render(<TemaProvider><App /></TemaProvider>) }
afterEach(() => window.history.pushState({}, '', '/'))

test('/compra/pelo-app mostra a confirmação da compra feita de dentro do Atlas', () => {
  abrir('/compra/pelo-app')
  expect(screen.getByRole('heading', { name: 'Pagamento confirmado.' })).toBeInTheDocument()
})

test('/compra/pelo-app/cancelada avisa que nada foi cobrado', () => {
  abrir('/compra/pelo-app/cancelada')
  expect(screen.getByRole('heading', { name: 'Nada foi cobrado.' })).toBeInTheDocument()
})
