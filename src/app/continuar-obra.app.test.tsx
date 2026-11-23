// Canteiro de obras → o cartão leva cada obra para a etapa em que parou (pedido do Luiz, 23/11/2026; Milestone 37).
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarClaudeFixture } from './ponte-claude'
import { criarObrasFixture } from './ponte-obras'

const montar = (situacoes: Record<string, { estilo: boolean; prototipo: boolean; marca: boolean; plano: boolean }>) => {
  const cofre = criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'ze@x.com', nome: 'Zé' }) })
  const base = criarObrasFixture('Zé', Object.keys(situacoes))
  const obras = { ...base, situacao: async (p: string) => situacoes[p] }
  render(<TemaProvider><AppDesktop ponte={criarPonteFixture(['--tela=F05'], cofre)} obras={obras} claude={criarClaudeFixture({ conectado: true, conta: 'ze@x.com', plano: 'pro' })} /></TemaProvider>)
}

test('obra que só ganhou nome: Continuar abre a escolha do estilo', async () => {
  montar({ 'cartao-de-ponto': { estilo: false, prototipo: false, marca: false, plano: false } })
  await userEvent.click(await screen.findByRole('link', { name: 'Canteiro de obras' }))
  const cartao = await screen.findByRole('article', { name: /^Cartao de ponto: falta terminar/ })
  await userEvent.click(within(cartao).getByRole('button'))
  expect(await screen.findByRole('heading', { name: /Qual é a cara do seu sistema\?/ })).toBeInTheDocument()
})

test('obra com nome e protótipo: Continuar abre as telas para conferir', async () => {
  montar({ 'agenda-do-ze': { estilo: true, prototipo: true, marca: true, plano: false } })
  await userEvent.click(await screen.findByRole('link', { name: 'Canteiro de obras' }))
  const cartao = await screen.findByRole('article', { name: /^Agenda do ze: falta terminar, etapa 4 de 6/ })
  await userEvent.click(within(cartao).getByRole('button'))
  expect(await screen.findByText(/^O protótipo/, { selector: '.at-proto__rotulo' })).toBeInTheDocument()
})

test('Nova obra, com obras já começadas, leva ao Canteiro, onde elas estão', async () => {
  montar({ 'agenda-do-ze': { estilo: true, prototipo: false, marca: false, plano: false } })
  await userEvent.click(await screen.findByRole('link', { name: 'Nova obra' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Ver o Canteiro de obras' }))
  expect(await screen.findByRole('article', { name: /^Agenda do ze: falta terminar, etapa 3 de 6/ })).toHaveTextContent('Próximo: escolher o nome')
})

test('com obras começadas, o Atlas abre no Canteiro de obras', async () => {
  montar({ 'agenda-do-ze': { estilo: true, prototipo: false, marca: false, plano: false } })
  expect(await screen.findByRole('article', { name: /^Agenda do ze: falta terminar/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Canteiro de obras' })).toHaveAttribute('aria-current', 'page')
})

test('dentro do caminho, as etapas já feitas são botões: do protótipo dá para voltar ao visual e ir de novo às telas', async () => {
  montar({ 'agenda-do-ze': { estilo: true, prototipo: true, marca: true, plano: false } })
  await userEvent.click(await screen.findByRole('link', { name: 'Canteiro de obras' }))
  await userEvent.click(within(await screen.findByRole('article', { name: /^Agenda do ze/ })).getByRole('button'))
  await screen.findByText(/^O protótipo/, { selector: '.at-proto__rotulo' })
  await userEvent.click(screen.getByRole('button', { name: /2 · O visual/i }))
  expect(await screen.findByRole('heading', { name: /Qual é a cara do seu sistema\?/ })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /4 · O protótipo/i }))
  expect(await screen.findByText(/^O protótipo/, { selector: '.at-proto__rotulo' })).toBeInTheDocument()
})

test('voltou ao visual pela faixa: dá para seguir sem mudar o visual', async () => {
  montar({ 'agenda-do-ze': { estilo: true, prototipo: true, marca: true, plano: false } })
  await userEvent.click(await screen.findByRole('link', { name: 'Canteiro de obras' }))
  await userEvent.click(within(await screen.findByRole('article', { name: /^Agenda do ze/ })).getByRole('button'))
  await screen.findByText(/^O protótipo/, { selector: '.at-proto__rotulo' })
  await userEvent.click(screen.getByRole('button', { name: /2 · O visual/i }))
  await userEvent.click(await screen.findByRole('button', { name: 'Manter o visual de agora e seguir →' }))
  expect(await screen.findByRole('button', { name: /3 · O nome/i })).toHaveAttribute('aria-current', 'step')
})
