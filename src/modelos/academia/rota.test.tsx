import { render, screen } from '@testing-library/react'
import App from '../../App'

afterEach(() => { vi.unstubAllEnvs(); window.history.pushState({}, '', '/') })

test('em modo fixture, /modelo/academia abre o app-modelo', async () => {
  vi.stubEnv('VITE_FIXTURE', '1')
  window.history.pushState({}, '', '/modelo/academia')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Alunos' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Academia Corpo em Dia' })).toBeInTheDocument()
})

test('em modo fixture, /modelo/barbearia continua abrindo a barbearia', async () => {
  vi.stubEnv('VITE_FIXTURE', '1')
  window.history.pushState({}, '', '/modelo/barbearia')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Agenda de hoje' })).toBeInTheDocument()
})

test('em modo fixture, /modelo/restaurante continua abrindo o restaurante', async () => {
  vi.stubEnv('VITE_FIXTURE', '1')
  window.history.pushState({}, '', '/modelo/restaurante')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
})

test('em modo fixture, /modelo/mercearia continua abrindo a mercearia', async () => {
  vi.stubEnv('VITE_FIXTURE', '1')
  window.history.pushState({}, '', '/modelo/mercearia')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Estoque' })).toBeInTheDocument()
})

test('as outras rotas continuam: /conta não vira o app-modelo', () => {
  window.history.pushState({}, '', '/conta')
  render(<App />)
  expect(screen.queryByRole('heading', { name: 'Alunos' })).toBeNull()
})

test('em produção (sem fixture) a rota não existe e cai na página de vendas', () => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_FIXTURE', '')
  window.history.pushState({}, '', '/modelo/academia')
  render(<App />)
  expect(screen.queryByRole('heading', { name: 'Alunos' })).toBeNull()
})
