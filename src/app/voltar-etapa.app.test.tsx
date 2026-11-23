// "Voltar" volta UMA etapa, nunca para o início (pedido urgente do Luiz, 23/11/2026), já na ordem do caminho novo:
// ideia → estilo → nome → telas → contas → começar.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarClaudeFixture } from './ponte-claude'
import { criarObrasFixture } from './ponte-obras'

const RELATO = 'quero uma agenda para a minha barbearia onde o cliente marca o horário pelo celular e eu vejo tudo no computador'

test('ideia → estilo → nome: cada Voltar volta uma etapa só, e voltar à ideia não cria outra obra', async () => {
  const user = userEvent.setup()
  const cofre = criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'ze@x.com', nome: 'Zé' }) })
  const obras = criarObrasFixture('Zé')
  render(<TemaProvider><AppDesktop ponte={criarPonteFixture(['--tela=F05'], cofre)} obras={obras} claude={criarClaudeFixture({ conectado: true, conta: 'ze@x.com', plano: 'pro' })} /></TemaProvider>)
  await user.click(await screen.findByRole('button', { name: /Começar do zero/ }))
  expect(await screen.findByRole('heading', { name: 'Conte a sua ideia para o Atlas' })).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: 'O que você contou' }), RELATO)
  await user.click(screen.getByRole('button', { name: /Pronto: começar o protótipo/ }))
  const seguir = await screen.findByRole('button', { name: /Seguir para o visual/ })
  await user.click(seguir)
  expect(await screen.findByRole('heading', { name: 'Qual é a cara do seu sistema?' })).toBeInTheDocument()
  expect(obras.criadas).toHaveLength(1)
  // Do estilo, Voltar volta para a ideia, com o que já tinha contado.
  await user.click(screen.getByRole('button', { name: '← Voltar' }))
  expect(await screen.findByRole('textbox', { name: 'O que você contou' })).toHaveValue(RELATO)
  await user.click(screen.getByRole('button', { name: /Pronto: começar o protótipo/ }))
  await user.click(await screen.findByRole('button', { name: /Seguir para o visual/ }))
  expect(await screen.findByRole('heading', { name: 'Qual é a cara do seu sistema?' })).toBeInTheDocument()
  expect(obras.criadas).toHaveLength(1)
  // Escolhe o estilo: vai para o nome (as telas são pintadas em segundo plano). Do nome, Voltar volta para o estilo.
  await user.type(await screen.findByLabelText(/Cole um link/), 'aesop.com')
  await user.click(screen.getByRole('button', { name: 'Adicionar link' }))
  await user.click(screen.getByRole('button', { name: 'Confiança' }))
  await user.click(screen.getByRole('button', { name: 'Mostrar 3 estilos' }))
  await user.click(await screen.findByRole('button', { name: /e desenhar as telas/ }, { timeout: 4000 }))
  await user.click(await screen.findByRole('button', { name: 'Desenhar as telas →' }, { timeout: 4000 }))
  expect(await screen.findByRole('heading', { name: 'Hora do batismo.' }, { timeout: 4000 })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Voltar/ }))
  expect(await screen.findByRole('heading', { name: 'Qual é a cara do seu sistema?' })).toBeInTheDocument()
}, 30000)
