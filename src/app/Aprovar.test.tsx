import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Aprovar, textoCota, textoDias } from './Aprovar'
import { criarClaudeFixture, type PonteClaude } from './ponte-claude'
import { construcaoIndisponivel, criarConstrucaoFixture, type PonteConstrucao } from './ponte-construcao'

const obra = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda-da-barbearia-do-ze' }
const montar = (construcao: PonteConstrucao = criarConstrucaoFixture(), claude: PonteClaude = criarClaudeFixture({ conectado: true, plano: 'pro' })) => {
  const user = userEvent.setup()
  const onVoltar = vi.fn()
  render(<TemaProvider><Aprovar obra={obra} construcao={construcao} claude={claude} onVoltar={onVoltar} /></TemaProvider>)
  return { user, onVoltar }
}

test('mostra as 8 etapas, o prazo no plano do cliente e o consumo da cota', async () => {
  montar()
  expect(await screen.findByRole('heading', { name: 'Pronto para a obra. Confira antes de começar.' })).toBeInTheDocument()
  expect(await screen.findByText('Base e login')).toBeInTheDocument()
  expect(screen.getByText('O QUE VAI SER CONSTRUÍDO · 8 ETAPAS')).toBeInTheDocument()
  expect(screen.getByText('PREVISÃO NO SEU PLANO (PRO)')).toBeInTheDocument()
  expect(screen.getByText('≈ 2 dias')).toBeInTheDocument()
  expect(screen.getByText(/No Max seria cerca de 1 dia/)).toBeInTheDocument()
  expect(screen.getByText(/usar a cota do seu plano até o fim umas 3 vezes/)).toBeInTheDocument()
})

test('no plano Max a previsão muda e compara com o Pro', async () => {
  montar(undefined, criarClaudeFixture({ conectado: true, plano: 'max' }))
  expect(await screen.findByText('PREVISÃO NO SEU PLANO (MAX)')).toBeInTheDocument()
  expect(screen.getByText('≈ 1 dia')).toBeInTheDocument()
  expect(screen.getByText(/No Pro seria cerca de 2 dias/)).toBeInTheDocument()
})

test('deixa claro que depois de começar ainda dá para ajustar (nota u08)', async () => {
  montar()
  expect(await screen.findByText(/Depois de começar ainda dá para ajustar/)).toBeInTheDocument()
  expect(screen.getByText(/Ajustes entram no pós-obra, sem perder nada/)).toBeInTheDocument()
})

test('voltar leva ao batismo', async () => {
  const { user, onVoltar } = montar()
  await user.click(await screen.findByRole('button', { name: 'Voltar ao protótipo' }))
  expect(onVoltar).toHaveBeenCalled()
})

test('sem o planejador ligado, avisa com calma e não finge', async () => {
  montar(construcaoIndisponivel)
  expect(await screen.findByRole('alert')).toHaveTextContent(/ainda não está ligado/)
})

test('textos de prazo e cota', () => {
  expect(textoDias(1)).toBe('≈ 1 dia')
  expect(textoDias(3)).toBe('≈ 3 dias')
  expect(textoCota(0)).toMatch(/sem parar/)
  expect(textoCota(1)).toMatch(/até o fim uma vez./)
})
