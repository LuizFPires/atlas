import { render, screen } from '@testing-library/react'
import App from '../../App'

afterEach(() => { vi.unstubAllEnvs(); window.history.pushState({}, '', '/') })

test('em modo fixture, /modelo/mercearia abre o app-modelo', async () => {
  vi.stubEnv('VITE_FIXTURE', '1')
  window.history.pushState({}, '', '/modelo/mercearia')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Estoque' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mercearia do Seu Zé' })).toBeInTheDocument()
})

test('em modo fixture, /modelo/barbearia continua abrindo a barbearia', async () => {
  vi.stubEnv('VITE_FIXTURE', '1')
  window.history.pushState({}, '', '/modelo/barbearia')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument()
})

test('as outras rotas continuam: /conta não vira o app-modelo', () => {
  window.history.pushState({}, '', '/conta')
  render(<App />)
  expect(screen.queryByRole('heading', { name: 'Estoque' })).toBeNull()
})

test('em produção (sem fixture) a rota não existe e cai na página de vendas', () => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_FIXTURE', '')
  window.history.pushState({}, '', '/modelo/mercearia')
  render(<App />)
  expect(screen.queryByRole('heading', { name: 'Estoque' })).toBeNull()
})

test('em modo fixture, /modelo/restaurante continua abrindo o restaurante', async () => {
  vi.stubEnv('VITE_FIXTURE', '1')
  window.history.pushState({}, '', '/modelo/restaurante')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
})
