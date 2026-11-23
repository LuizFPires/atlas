// "Voltar" volta UMA etapa, nunca para o início (pedido urgente do Luiz, 23/11/2026).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarClaudeFixture } from './ponte-claude'

test('nova obra → estilo → telas: cada Voltar volta uma etapa só', async () => {
  const user = userEvent.setup()
  const cofre = criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'ze@x.com', nome: 'Zé' }) })
  render(<TemaProvider><AppDesktop ponte={criarPonteFixture(['--tela=F05'], cofre)} claude={criarClaudeFixture({ conectado: true, conta: 'ze@x.com', plano: 'pro' })} /></TemaProvider>)
  await user.click(await screen.findByRole('button', { name: /Começar do zero/ }))
  const digitar = screen.queryByRole('button', { name: 'Digitar em vez de falar' })
  if (digitar) await user.click(digitar)
  await user.type(screen.getByRole('textbox'), 'Agenda do Zé')
  for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: /Próxima pergunta|Começar a obra/ }))
  await user.click(await screen.findByRole('button', { name: /Escolher o estilo/ }))
  expect(await screen.findByRole('heading', { name: 'Qual é a cara do seu sistema?' })).toBeInTheDocument()
  // Do estilo, Voltar volta para a obra recém-criada (e não para Minhas obras).
  await user.click(screen.getByRole('button', { name: '← Voltar' }))
  expect(await screen.findByRole('heading', { name: 'Obra começada!' })).toBeInTheDocument()
  // Das telas, Voltar volta para o estilo.
  await user.click(screen.getByRole('button', { name: /Escolher o estilo/ }))
  await user.type(await screen.findByLabelText(/Cole um link/), 'aesop.com')
  await user.click(screen.getByRole('button', { name: 'Adicionar link' }))
  await user.click(screen.getByRole('button', { name: 'Confiança' }))
  await user.click(screen.getByRole('button', { name: 'Mostrar 3 estilos' }))
  await user.click(await screen.findByRole('button', { name: /e desenhar as telas/ }, { timeout: 4000 }))
  await user.click(await screen.findByRole('button', { name: 'Desenhar as telas →' }, { timeout: 4000 }))
  expect(await screen.findByText(/Projeto 2 de 3 · Telas/, {}, { timeout: 4000 })).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: '← Voltar' }, { timeout: 4000 }))
  expect(await screen.findByRole('heading', { name: 'Qual é a cara do seu sistema?' })).toBeInTheDocument()
}, 30000)
