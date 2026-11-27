import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { DesempenhoDaObra, marcasY } from './DesempenhoDaObra'
import { AbasDaObra } from './AbasDaObra'
import { criarPainelFixture, type Desempenho } from './ponte-painel'

// Aba Desempenho (aprovada pelo Luiz em 26/11/2026): curva S do consumo do plano (previsto, realizado, projetado), ritmo de gasto,
// pausas previstas pela cota e o plano. "O consumo manda no tempo": a projeção do término já conta as pausas.
const AGORA = new Date('2026-11-26T22:41:00.000Z') // 19h41 em Brasília
const montar = (d?: Partial<Desempenho>) => {
  const painel = criarPainelFixture()
  const base = painel.desempenho!
  render(<TemaProvider><DesempenhoDaObra obra={{ nome: 'Orçamento de obra', pasta: 'orcamento' }} painel={{ ...painel, desempenho: async (p) => ({ ...(await base(p)), ...d }) }} agora={() => AGORA} /></TemaProvider>)
}

test('desempenho: término projetado com as pausas, consumo x previsto, ritmo de gasto, pausas previstas e plano', async () => {
  montar()
  const resumo = await screen.findByRole('region', { name: 'Resumo do desempenho' })
  expect(within(resumo).getByText('TÉRMINO PROJETADO')).toBeInTheDocument()
  expect(within(resumo).getByText(/^(seg|ter|qua|qui|sex|sáb|dom)\.?, \d\d\/\d\d · ~\d\dh$/i)).toBeInTheDocument()
  expect(within(resumo).getByText(/2 pausas da cota do plano Pro/)).toBeInTheDocument()
  expect(within(resumo).getByText('14,20%')).toBeInTheDocument()
  expect(within(resumo).getByText(/o previsto para agora era 12,00%/)).toBeInTheDocument()
  expect(within(resumo).getByText('+18%')).toBeInTheDocument()
  expect(within(resumo).getByText(/gastou 18% a mais do plano que o previsto: por isso o término vai mais longe/)).toBeInTheDocument()
  expect(within(resumo).getByText(/^a próxima ~\d\dh\d\d · o Atlas espera a cota renovar e volta sozinho/)).toBeInTheDocument()
  expect(within(resumo).getByText('Pro')).toBeInTheDocument()
  const grafico = screen.getByRole('img', { name: /Curva S do consumo/ })
  expect(grafico.querySelectorAll('[data-serie="previsto"]').length).toBe(1)
  expect(grafico.querySelectorAll('[data-serie="realizado"]').length).toBe(1)
  expect(grafico.querySelectorAll('[data-serie="projetado"]').length).toBe(1)
  expect(grafico.querySelectorAll('[data-pausa]').length).toBe(2)
  expect(screen.getByText(/Refeito a cada 5 min/)).toBeInTheDocument()
})

test('antes da 1ª etapa e da 1ª pausa: avisa que orçamento e cota ainda são estimativa', async () => {
  montar({ estimativaInicial: true, cotaAprendida: false })
  expect(await screen.findByText(/ainda é uma estimativa/)).toBeInTheDocument()
})

test('gastando menos que o previsto: ritmo negativo em verde', async () => {
  montar({ ritmo: -0.07 })
  expect(await screen.findByText('−7%')).toBeInTheDocument()
  expect(screen.getByText(/a menos que o previsto: o término vem mais cedo/)).toBeInTheDocument()
})

test('Ultra (sem o limite de 5 h): nenhuma pausa prevista', async () => {
  montar({ plano: 'ultra', cota: null, pausasPrevistas: [] })
  const resumo = await screen.findByRole('region', { name: 'Resumo do desempenho' })
  expect(within(resumo).getByText('Ultra')).toBeInTheDocument()
  expect(within(resumo).getByText('sem pausas previstas')).toBeInTheDocument()
})

test('antes de construir: recado calmo', async () => {
  render(<TemaProvider><DesempenhoDaObra obra={{ nome: 'x', pasta: 'x' }} painel={{ ...criarPainelFixture(), desempenho: async () => { throw new Error('sem-plano') } }} /></TemaProvider>)
  expect(await screen.findByText(/O desempenho aparece quando a construção começar/)).toBeInTheDocument()
})

test('a aba Desempenho fica ao lado do Cronograma', async () => {
  const ir = vi.fn()
  render(<AbasDaObra nome="x" atual="cronograma" onIr={ir} onCanteiro={() => {}} so="abas" />)
  const abas = screen.getAllByRole('tab').map((t) => t.textContent)
  expect(abas.indexOf('Desempenho')).toBe(abas.indexOf('Cronograma') + 1)
  await userEvent.click(screen.getByRole('tab', { name: 'Desempenho' }))
  expect(ir).toHaveBeenCalledWith('desempenho')
})

test('didática: diz que a projeção vale com o computador ligado e o Atlas aberto; trecho sem trabalho aparece e é explicado', async () => {
  const H = 3600_000
  const t0 = Date.parse('2026-11-26T22:00:00.000Z')
  const i = (h: number) => new Date(t0 + h * H).toISOString()
  const painel = criarPainelFixture()
  const base = await painel.desempenho!('ponto')
  painel.desempenho = async () => ({ ...base, projetadoFimPct: 145, semTrabalho: [{ inicio: i(1), fim: i(8), ate_agora: false }, { inicio: i(9), fim: i(10), ate_agora: true }] })
  const { container } = render(<TemaProvider><DesempenhoDaObra obra={{ nome: 'Ponto', pasta: 'ponto' }} painel={painel} agora={() => new Date(t0 + 10 * H)} sondagemMs={0} /></TemaProvider>)
  expect(await screen.findByText('Como ler esta projeção')).toBeInTheDocument()
  expect(screen.getByText(/só com o computador ligado e o Atlas aberto/)).toBeInTheDocument()
  expect(screen.getByText(/Vale se o computador ficar ligado, com o Atlas aberto, direto até lá/)).toBeInTheDocument()
  expect(screen.getByText('A obra não está trabalhando agora')).toBeInTheDocument()
  expect(screen.getByText(/no fim deve usar ~145%/)).toBeInTheDocument()
  expect(screen.getByText(/computador desligado, Atlas fechado ou obra pausada/)).toBeInTheDocument()
  expect(container.querySelectorAll('[data-parada]').length).toBe(2)
})

test('eixo do consumo: no máximo 6 marcas redondas, mesmo com números grandes (nada embaralhado)', () => {
  expect(marcasY(100)).toEqual([0, 25, 50, 75, 100])
  expect(marcasY(145)).toEqual([0, 50, 100])
  expect(marcasY(7006).length).toBeLessThanOrEqual(7)
  expect(marcasY(7006)).toContain(100)
})

// Revisões do pós-obra (Luiz, 27/11/2026, protótipo O8, ideia 2B): lateral recolhida por padrão com só o % feito; aberta com 5 cartões;
// "Revisões →" / "Ver todas as revisões →" abrem a gaveta com todas, o tempo que levaram e os filtros.
const REVS = [
  { numero: 3, id: 'p003', nome: 'Link do /admin', pedidaEm: '2026-11-26T22:20:00.000Z', status: 'em-andamento' as const, pct: 45, minutosEstimados: 45, minutosReais: null, minutosAteAgora: 21 },
  { numero: 2, id: 'p002', nome: 'Assinatura do espelho', pedidaEm: '2026-11-25T15:00:00.000Z', status: 'para-conferir' as const, pct: 100, minutosEstimados: 45, minutosReais: 52, minutosAteAgora: null },
  { numero: 1, id: 'p001', nome: 'Painel no computador', pedidaEm: '2026-11-24T15:00:00.000Z', status: 'no-ar' as const, pct: 100, minutosEstimados: 120, minutosReais: 112, minutosAteAgora: null },
]
const montarComRevisoes = (revs = REVS) => {
  const painel = criarPainelFixture()
  render(<TemaProvider><DesempenhoDaObra obra={{ nome: 'Ponto', pasta: 'ponto' }} painel={painel} posobra={{ revisoes: async () => revs }} agora={() => AGORA} /></TemaProvider>)
}

test('revisões: lateral recolhida por padrão, só com o % feito de cada uma (sem tempo)', async () => {
  window.localStorage.clear()
  montarComRevisoes()
  const mini = await screen.findByRole('complementary', { name: 'Revisões (recolhida)' })
  expect(within(mini).getByText('quanto já foi feito')).toBeInTheDocument()
  const itens = within(mini).getAllByRole('listitem')
  expect(itens.map((i) => i.textContent)).toEqual(['R0345%', 'R02100%', 'R01100%'])
  expect(within(mini).queryByText(/min/)).toBeNull()
  expect(within(mini).getByRole('button', { name: 'Revisões →' })).toBeInTheDocument()
})

test('revisões: abrir a lateral mostra os cartões (mais recente no topo) e lembra a escolha; recolher volta', async () => {
  window.localStorage.clear()
  const user = userEvent.setup()
  montarComRevisoes()
  await user.click(await screen.findByRole('button', { name: 'Abrir a lateral das revisões' }))
  const lado = screen.getByRole('complementary', { name: 'Revisões' })
  const cartoes = within(lado).getAllByRole('listitem')
  expect(cartoes[0]).toHaveTextContent('REV 03 · AGORA')
  expect(cartoes[0]).toHaveTextContent('45%')
  expect(cartoes[0]).toHaveTextContent('~24 min para terminar')
  expect(cartoes[1]).toHaveTextContent('CONFERIR')
  expect(cartoes[1]).toHaveTextContent('levou 52 min (est. 45 min)')
  expect(within(lado).getByText('~1h22')).toBeInTheDocument() // média de 52 e 112 min
  expect(window.localStorage.getItem('atlas:desempenho:revisoes-aberta')).toBe('1')
  await user.click(within(lado).getByRole('button', { name: 'Recolher ›' }))
  expect(screen.getByRole('complementary', { name: 'Revisões (recolhida)' })).toBeInTheDocument()
  expect(window.localStorage.getItem('atlas:desempenho:revisoes-aberta')).toBe('0')
})

test('revisões: "Revisões →" abre a gaveta com todas, tempo contra o estimado, filtros; Esc fecha', async () => {
  window.localStorage.clear()
  const user = userEvent.setup()
  montarComRevisoes()
  await user.click(await screen.findByRole('button', { name: 'Revisões →' }))
  const g = screen.getByRole('dialog', { name: 'Todas as revisões' })
  expect(within(g).getByText('3 revisões de Ponto')).toBeInTheDocument()
  expect(within(g).getByText('1h52 · est. 2h00')).toBeInTheDocument()
  expect(within(g).getByText('21 min até agora')).toBeInTheDocument()
  expect(within(g).getByText('HOJE · 26/11')).toBeInTheDocument()
  expect(g.querySelectorAll('[data-revisao]').length).toBe(3)
  await user.click(within(g).getByRole('button', { name: 'Para conferir (1)' }))
  expect([...g.querySelectorAll('[data-revisao]')].map((e) => e.getAttribute('data-revisao'))).toEqual(['2'])
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('revisões: sem nenhuma, a lateral recolhida avisa e a gaveta explica onde pedir', async () => {
  window.localStorage.clear()
  const user = userEvent.setup()
  montarComRevisoes([])
  expect(await screen.findByText('nenhuma ainda')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Revisões →' }))
  expect(screen.getByText(/Nenhuma revisão ainda/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Fechar ✕' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('sem a porta das revisões, a curva ocupa tudo (sem lateral)', async () => {
  montar()
  await screen.findByRole('region', { name: 'Resumo do desempenho' })
  expect(screen.queryByRole('complementary')).toBeNull()
})
