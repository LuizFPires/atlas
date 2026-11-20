import { render, screen } from '@testing-library/react'
import App from '../../App'

afterEach(() => { vi.unstubAllEnvs(); window.history.pushState({}, '', '/') })

test('em modo fixture, /modelo/barbearia abre o app-modelo', async () => {
  vi.stubEnv('VITE_FIXTURE', '1')
  window.history.pushState({}, '', '/modelo/barbearia')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Barbearia do Zé' })).toBeInTheDocument()
})

test('as outras rotas continuam: /conta não vira o app-modelo', () => {
  window.history.pushState({}, '', '/conta')
  render(<App />)
  expect(screen.queryByRole('heading', { name: 'Agenda de hoje' })).toBeNull()
})

test('em produção (sem fixture) a rota não existe e cai na página de vendas', () => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_FIXTURE', '')
  window.history.pushState({}, '', '/modelo/barbearia')
  render(<App />)
  expect(screen.queryByRole('heading', { name: 'Agenda de hoje' })).toBeNull()
})
