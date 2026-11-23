import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Canteiro } from './Canteiro'
import type { PonteObras } from './ponte-obras'
import type { SituacaoObra } from './fase-obra'

const S = (o: Partial<SituacaoObra>): SituacaoObra => ({ estilo: false, prototipo: false, marca: false, plano: false, ...o })
const SITUACOES: Record<string, SituacaoObra> = {
  'academia-do-ze': S({ estilo: true }),
  'meu-ponto': S({ estilo: true, prototipo: true, marca: true, plano: true }),
  'barbearia-do-ze': S({ estilo: true, prototipo: true, marca: true, plano: true }),
  'orcamentos-rapidos': S({}),
}
const PCT: Record<string, number> = { 'meu-ponto': 64, 'barbearia-do-ze': 100 }
const ponte = { listar: async () => Object.keys(SITUACOES), situacao: async (p: string) => SITUACOES[p], raiz: () => 'C:\\x', abrirPasta: async () => {}, criarSubpasta: async () => { throw new Error('x') } } as unknown as PonteObras
const painel = { ler: async (p: string) => ({ pct: PCT[p] ?? 0 }) }

test('Canteiro: só as obras vivas (inacabadas primeiro), com o que falta e o próximo passo; a pronta não aparece', async () => {
  render(<Canteiro modo="canteiro" obras={ponte} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
  const cartoes = await screen.findAllByRole('article')
  expect(cartoes.map((c) => c.getAttribute('aria-label'))).toEqual([
    expect.stringMatching(/^Academia do ze/), expect.stringMatching(/^Orcamentos rapidos/), expect.stringMatching(/^Meu ponto/),
  ])
  expect(within(cartoes[0]).getByText(/FALTA TERMINAR · ETAPA 3 DE 6/)).toBeInTheDocument()
  expect(within(cartoes[0]).getByText(/Próximo: escolher o nome/)).toBeInTheDocument()
  expect(within(cartoes[1]).getByText(/Próximo: escolher o visual/)).toBeInTheDocument()
  expect(within(cartoes[2]).getByText('64%')).toBeInTheDocument()
  expect(screen.queryByText(/Barbearia do ze/)).toBeNull()
})

test('Canteiro: filtro e busca pelo nome', async () => {
  const user = userEvent.setup()
  render(<Canteiro modo="canteiro" obras={ponte} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
  await screen.findAllByRole('article')
  expect(screen.getByRole('button', { name: /Falta terminar 2/ })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Em construção 1/ }))
  expect(screen.getAllByRole('article')).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: /Todas 3/ }))
  await user.type(screen.getByRole('searchbox', { name: 'Buscar obra pelo nome' }), 'orça')
  expect(screen.getAllByRole('article').map((c) => c.getAttribute('aria-label'))).toEqual([expect.stringMatching(/^Orcamentos rapidos/)])
})

test('clicar no cartão abre a obra na etapa em que ela está; "Nova obra" leva ao começo', async () => {
  const user = userEvent.setup()
  const onAbrir = vi.fn()
  const onNova = vi.fn()
  render(<Canteiro modo="canteiro" obras={ponte} painel={painel} onAbrir={onAbrir} onNova={onNova} />)
  const [primeiro] = await screen.findAllByRole('article')
  await user.click(within(primeiro).getByRole('button'))
  expect(onAbrir).toHaveBeenCalledWith({ pasta: 'academia-do-ze', nome: 'Academia do ze', etapa: 'batismo' })
  await user.click(screen.getByRole('button', { name: /Nova obra/ }))
  expect(onNova).toHaveBeenCalled()
})

test('Obras concluídas: só as prontas, com o selo No ar', async () => {
  render(<Canteiro modo="concluidas" obras={ponte} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
  const cartoes = await screen.findAllByRole('article')
  expect(cartoes).toHaveLength(1)
  expect(within(cartoes[0]).getByText('NO AR')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Prontas e no ar' })).toBeInTheDocument()
})

test('sem obras: o Canteiro convida a começar a primeira', async () => {
  const vazia = { ...ponte, listar: async () => [] } as PonteObras
  render(<Canteiro modo="canteiro" obras={vazia} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
  expect(await screen.findByText(/Nenhuma obra no canteiro ainda/)).toBeInTheDocument()
})
