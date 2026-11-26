import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { DesempenhoDaObra } from './DesempenhoDaObra'
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
  expect(within(resumo).getByText('previsto até agora: 12,00%')).toBeInTheDocument()
  expect(within(resumo).getByText('+18%')).toBeInTheDocument()
  expect(within(resumo).getByText('gastando mais que o previsto')).toBeInTheDocument()
  expect(within(resumo).getByText(/^a próxima ~\d\dh\d\d$/)).toBeInTheDocument()
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
  expect(screen.getByText('gastando menos que o previsto')).toBeInTheDocument()
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
