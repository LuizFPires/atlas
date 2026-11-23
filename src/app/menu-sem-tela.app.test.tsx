import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'

const ponte = () => criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) }))
const api = { pedirCodigo: async () => ({ ok: true as const }), confirmar: async () => ({ ok: true as const, nome: 'Zé' }) }

// Milestone 37 (23/11/2026): o menu tem só Nova obra, Canteiro de obras e Obras concluídas; cada um tem a sua tela, mesmo sem obra.
test.each([
  ['Canteiro de obras', /Nenhuma obra no canteiro ainda/],
  ['Obras concluídas', /Nenhuma obra pronta ainda/],
  ['Nova obra', /Comece a sua primeira obra/],
])('menu "%s" sem obra tem uma tela própria, nunca cai no "Bem-vindo"', async (item, texto) => {
  render(<TemaProvider><AppDesktop ponte={ponte()} api={api} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('link', { name: item }))
  expect(await screen.findByText(texto)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Bem-vindo ao Atlas' })).toBeNull()
})
