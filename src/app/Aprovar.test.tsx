import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Aprovar, textoCota, textoDias } from './Aprovar'
import { criarClaudeFixture, type PonteClaude } from './ponte-claude'
import { ARQUIVO_MODO, construcaoIndisponivel, criarConstrucaoFixture, criarModoObraFixture, lerModoDoTexto, paraRecomendado, serializarModo, type PonteConstrucao, type PonteModoObra } from './ponte-construcao'

const obra = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda-da-barbearia-do-ze' }
const montar = (construcao: PonteConstrucao = criarConstrucaoFixture(), claude: PonteClaude = criarClaudeFixture({ conectado: true, plano: 'pro' }), modos: PonteModoObra = criarModoObraFixture()) => {
  const user = userEvent.setup()
  const onVoltar = vi.fn()
  render(<TemaProvider><Aprovar obra={obra} construcao={construcao} claude={claude} modos={modos} onVoltar={onVoltar} /></TemaProvider>)
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

test('mostra o aviso das lojas: D-U-N-S e 12 testadores por 14 dias', async () => {
  montar()
  const aviso = await screen.findByRole('region', { name: 'Aviso das lojas de aplicativos' })
  expect(aviso).toHaveTextContent('D-U-N-S')
  expect(aviso).toHaveTextContent('12 pessoas testando o app por 14 dias seguidos')
  expect(aviso).toHaveTextContent('a papelada das lojas leva alguns dias')
})

test('escolha do modo: automático vem em destaque, explica em linguagem de leigo e as paradas reais', async () => {
  montar()
  const auto = await screen.findByRole('radio', { name: /Automático do começo ao fim, sem me chamar/ })
  const passo = screen.getByRole('radio', { name: /Me chamar para aprovar cada etapa/ })
  expect(auto).toHaveAttribute('aria-checked', 'true')
  expect(auto).toHaveTextContent('RECOMENDADO')
  expect(passo).toHaveAttribute('aria-checked', 'false')
  expect(auto).toHaveTextContent(/toca a obra inteira sozinho/)
  expect(passo).toHaveTextContent(/A próxima só começa quando você disser que pode/)
  expect(screen.getByText(/só vai te chamar nas paradas de verdade/)).toBeInTheDocument()
  expect(screen.getByText(/só você pode resolver/)).toBeInTheDocument()
  expect(screen.getByText(/a cota do seu plano do Claude acaba/)).toBeInTheDocument()
  expect(screen.getByText(/cobrança, senha que venceu/)).toBeInTheDocument()
})

test('a escolha é guardada na pasta da obra e o passo a passo some com a lista de paradas', async () => {
  const modos = criarModoObraFixture()
  const { user } = montar(undefined, undefined, modos)
  await user.click(await screen.findByRole('radio', { name: /Me chamar para aprovar cada etapa/ }))
  expect(modos.gravados[obra.pasta]).toBe('passo-a-passo')
  expect(screen.getByRole('radio', { name: /Me chamar para aprovar/ })).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByText(/só vai te chamar nas paradas de verdade/)).not.toBeInTheDocument()
  expect(screen.getByText(/Escolha guardada na pasta da obra/)).toBeInTheDocument()
})

test('ao voltar a esta tela, respeita a escolha que o cliente já tinha feito', async () => {
  montar(undefined, undefined, criarModoObraFixture({ [obra.pasta]: 'passo-a-passo' }))
  expect(await screen.findByRole('radio', { name: /Me chamar para aprovar/ })).toHaveAttribute('aria-checked', 'true')
})

test('se não conseguir guardar, volta à escolha anterior e avisa', async () => {
  const { user } = montar(undefined, undefined, { ler: async () => null, gravar: async () => { throw new Error('indisponivel') } })
  await user.click(await screen.findByRole('radio', { name: /Me chamar para aprovar/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/ainda não está ligado/)
  expect(screen.getByRole('radio', { name: /Automático/ })).toHaveAttribute('aria-checked', 'true')
})

test('o formato da preferência é lido de volta e liga o recomendado.json', () => {
  expect(lerModoDoTexto(serializarModo('passo-a-passo'))).toBe('passo-a-passo')
  expect(lerModoDoTexto(serializarModo('automatico'))).toBe('automatico')
  expect(lerModoDoTexto('{"versao":1,"modo":"qualquer"}')).toBeNull()
  expect(lerModoDoTexto('lixo')).toBeNull()
  expect(paraRecomendado('automatico')).toEqual({ ativo: true })
  expect(paraRecomendado('passo-a-passo')).toEqual({ ativo: false })
  expect(ARQUIVO_MODO).toBe('.atlas/modo.json')
})
