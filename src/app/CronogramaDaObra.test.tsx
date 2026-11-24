import { render, screen, within } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { CronogramaDaObra } from './CronogramaDaObra'
import { criarPainelFixture } from './ponte-painel'

// M41 (O6 aprovado pelo Luiz em 24/11/2026): "os prazos por milestone previsto e realizado e a expectativa de data e horário de término".
test('cronograma: término esperado com dia e hora, previsto no início, diferença separando a pausa e uma linha por etapa', async () => {
  const painel = criarPainelFixture()
  render(<TemaProvider><CronogramaDaObra obra={{ nome: 'Barbearia', pasta: 'barbearia' }} painel={painel} agora={() => new Date('2026-11-25T08:00:00.000Z')} /></TemaProvider>)
  const resumo = await screen.findByRole('region', { name: 'Resumo do prazo' })
  expect(within(resumo).getByText('TÉRMINO ESPERADO')).toBeInTheDocument()
  expect(within(resumo).getAllByText(/^(seg|ter|qua|qui|sex|sáb|dom)\.?, \d\d\/\d\d · \d\d:\d\d$/i)).toHaveLength(2) // esperado e previsto
  expect(within(resumo).getByText('+22 h')).toBeInTheDocument()
  expect(within(resumo).getByText(/14 h foram pausa da cota do Claude/)).toBeInTheDocument()
  expect(within(resumo).getByText('3 de 5')).toBeInTheDocument()
  const linhas = within(screen.getByRole('list', { name: 'Etapas: previsto e realizado' })).getAllByRole('listitem')
  expect(linhas).toHaveLength(5)
  expect(linhas[0]).toHaveTextContent('Entregue')
  expect(linhas[3]).toHaveTextContent('Em andamento · 45%')
  expect(linhas[4]).toHaveTextContent('Ainda não começou')
  expect(screen.getByText('AGORA')).toBeInTheDocument()
})

test('sem cronograma ainda (antes de construir): recado calmo', async () => {
  render(<TemaProvider><CronogramaDaObra obra={{ nome: 'x', pasta: 'x' }} painel={{ ...criarPainelFixture(), cronograma: async () => { throw new Error('sem-plano') } }} /></TemaProvider>)
  expect(await screen.findByText(/O cronograma aparece quando a construção começar/)).toBeInTheDocument()
})
