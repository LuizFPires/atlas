import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkin } from './Checkin'
import { criarDadosFixture, hojeLocal, somarDias } from './dados'

const H = '2026-03-10'

test('mostra o histórico de outros dias e ninguém treinando hoje no começo', async () => {
  render(<Checkin dados={criarDadosFixture(H)} hoje={H} />)
  const hist = await screen.findByRole('list', { name: 'Histórico de presença' })
  expect(within(hist).getByText('08/03/2026')).toBeInTheDocument()
  expect(within(hist).getAllByText(/Carla Mendes|Bruno Lima/, { exact: false })).toHaveLength(3)
  expect(screen.getByText('Ninguém marcou presença hoje ainda.')).toBeInTheDocument()
})

test('marca presença com a data injetada e o aluno vai para "treinaram hoje"', async () => {
  const dados = criarDadosFixture(H)
  render(<Checkin dados={dados} hoje={H} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Marcar presença: Bruno Lima' }))
  expect(await within(await screen.findByRole('list', { name: 'Treinaram hoje' })).findByText('Bruno Lima')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Marcar presença: Bruno Lima' })).toBeNull()
  expect((await dados.listarPresencas()).filter((p) => p.data === H)).toHaveLength(1)
})

test('não duplica a presença no mesmo dia (a porta recusa)', async () => {
  const dados = criarDadosFixture(H)
  expect((await dados.marcarPresenca('a1', H)).ok).toBe(true)
  const r = await dados.marcarPresenca('a1', H)
  expect(r).toEqual({ ok: false, mensagem: 'Esse aluno já marcou presença nesse dia.' })
  expect((await dados.listarPresencas()).filter((p) => p.alunoId === 'a1' && p.data === H)).toHaveLength(1)
  expect((await dados.marcarPresenca('a1', '2026-13-40')).ok).toBe(false)
})

test('dois cliques seguidos continuam com uma presença só', async () => {
  const dados = criarDadosFixture(H)
  render(<Checkin dados={dados} hoje={H} />)
  const b = await screen.findByRole('button', { name: 'Marcar presença: Carla Mendes' })
  await userEvent.dblClick(b)
  await within(await screen.findByRole('list', { name: 'Treinaram hoje' })).findByText('Carla Mendes')
  expect((await dados.listarPresencas()).filter((p) => p.alunoId === 'a1' && p.data === H)).toHaveLength(1)
})

test('"hoje" é o dia LOCAL, não o UTC: 23h30 no Brasil continua no mesmo dia', () => {
  expect(hojeLocal(new Date(2026, 2, 10, 23, 30))).toBe('2026-03-10')
  expect(hojeLocal(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
})
