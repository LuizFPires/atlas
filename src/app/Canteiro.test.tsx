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

describe('situação de cada obra em construção no cartão (K1Canteiro)', () => {
  const SIT: Record<string, SituacaoObra> = { a: S({ estilo: true, prototipo: true, marca: true, plano: true }), b: S({ estilo: true, prototipo: true, marca: true, plano: true }), c: S({ estilo: true, prototipo: true, marca: true, plano: true }), d: S({ estilo: true, prototipo: true, marca: true, plano: true }), e: S({ estilo: true, prototipo: true, marca: true, plano: true }) }
  const obras4 = { listar: async () => Object.keys(SIT), situacao: async (p: string) => SIT[p] } as unknown as PonteObras
  const base = { pct: 50, parada: null, pausadaPorVoce: false, agora: [] as { sigla: string; quem: string; oque: string; tom: 'ativo' | 'espera' }[] }
  const LER: Record<string, object> = {
    a: { ...base, agora: [{ sigla: 'IM', quem: 'Implementador', oque: 'a tela de relatórios do mês', tom: 'ativo' }] },
    b: { ...base, parada: 'cota' },
    c: { ...base, parada: 'voce' },
    d: { ...base, pausadaPorVoce: true },
    e: { ...base },
  }
  const painel2 = { ler: async (p: string) => LER[p] as { pct: number } }
  const retomar = { obraEmAndamento: async () => ({ nome: 'E', pasta: 'e', pct: 50, etapa: null, paradaEm: new Date(Date.now() - 3 * 3600_000).toISOString() }), continuar: vi.fn(async () => {}) }

  test('trabalhando, esperando o Claude, precisa de você, pausada e parada (computador desligado)', async () => {
    render(<Canteiro modo="canteiro" obras={obras4} painel={painel2} retomar={retomar} onAbrir={() => {}} onNova={() => {}} />)
    const c = (n: string) => screen.findByRole('article', { name: new RegExp(`^${n}:`) })
    expect(await c('A')).toHaveTextContent(/TRABALHANDO AGORA.*Trabalhando agora: a tela de relatórios do mês/)
    expect(await c('B')).toHaveTextContent(/ESPERANDO O CLAUDE.*O limite do Claude acabou. A obra volta sozinha/)
    expect(await c('C')).toHaveTextContent(/PRECISA DE VOCÊ.*Responder/)
    expect(await c('D')).toHaveTextContent(/PAUSADA POR VOCÊ.*Continuar obra/)
    expect(await c('E')).toHaveTextContent(/PARADA.*quando o computador desligou.*Continuar obra/)
  })

  test('na obra parada, o clique religa a obra (um clique) e abre', async () => {
    const onAbrir = vi.fn()
    render(<Canteiro modo="canteiro" obras={obras4} painel={painel2} retomar={retomar} onAbrir={onAbrir} onNova={() => {}} />)
    const e = await screen.findByRole('article', { name: /^E:/ })
    await userEvent.click(within(e).getByRole('button'))
    expect(retomar.continuar).toHaveBeenCalledWith({ pasta: 'e' })
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ pasta: 'e', etapa: 'obra' }))
  })
})
