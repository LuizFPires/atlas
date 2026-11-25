import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarAjudaFixture } from './ponte-ajuda'
import { definirEstadoVoz } from '../ui/voz-motor'

const ponte = () => criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) }))
const api = { pedirCodigo: async () => ({ ok: true as const }), confirmar: async () => ({ ok: true as const, nome: 'Zé' }) }

test('pelo botão "Falar com o Atlas": abre o painel por cima da tela e fecha no ×', async () => {
  render(<TemaProvider><AppDesktop ponte={ponte()} api={api} ajuda={criarAjudaFixture()} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('button', { name: /Falar com o Atlas/ }))
  expect(await screen.findByRole('complementary', { name: 'Ajuda do Atlas' })).toBeInTheDocument()
  expect(screen.getByText(/Estou aqui, a qualquer hora/)).toBeInTheDocument()
  expect(screen.getByText('Canteiro de obras')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Fechar a Ajuda' }))
  expect(screen.queryByRole('complementary', { name: 'Ajuda do Atlas' })).not.toBeInTheDocument()
})

test('D1: com a Ajuda aberta, o aviso da voz aparece só dentro da gaveta (nunca dois)', async () => {
  render(<TemaProvider><AppDesktop ponte={ponte()} api={api} ajuda={criarAjudaFixture()} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('button', { name: /Falar com o Atlas/ }))
  const gaveta = await screen.findByRole('complementary', { name: 'Ajuda do Atlas' })
  act(() => definirEstadoVoz({ fase: 'escrevendo' }))
  expect(screen.getAllByText(/Escrevendo o que você falou/)).toHaveLength(1)
  expect(gaveta).toHaveTextContent(/Escrevendo o que você falou/)
  act(() => definirEstadoVoz({ fase: 'livre' }))
})
