import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'

const ponte = () => criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) }))
const api = { pedirCodigo: async () => ({ ok: true as const }), confirmar: async () => ({ ok: true as const, nome: 'Zé' }) }

test.each([
  ['Como retomar', /Nenhuma obra parada agora/],
  ['Protótipo', /Escolha uma obra em Minhas obras/],
  ['Obra', /Escolha uma obra em Minhas obras/],
])('menu "%s" sem obra aberta tem uma tela própria, nunca cai no "Bem-vindo"', async (item, texto) => {
  render(<TemaProvider><AppDesktop ponte={ponte()} api={api} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('link', { name: item }))
  expect(await screen.findByText(texto)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Bem-vindo ao Atlas' })).toBeNull()
})
