import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Evolucao } from './Evolucao'
import { criarDadosFixture, validarMedida } from './dados'

const H = '2026-03-10'
const base = { data: H, pesoKg: null, cinturaCm: null, exercicio: '', cargaKg: null }

test('validação da evolução', () => {
  expect(validarMedida(base)).toMatch(/pelo menos um valor/)
  expect(validarMedida({ ...base, pesoKg: 0 })).toMatch(/peso/)
  expect(validarMedida({ ...base, data: '2026-02-31', pesoKg: 70 })).toMatch(/data/)
  expect(validarMedida({ ...base, cargaKg: 20 })).toMatch(/exercício/)
  expect(validarMedida({ ...base, pesoKg: 70 })).toBeNull()
})

test('sem aluno escolhido, pede para escolher', () => {
  render(<Evolucao dados={criarDadosFixture(H)} alunoId={null} hoje={H} />)
  expect(screen.getByText(/Escolha um aluno/)).toBeInTheDocument()
})

test('lista a evolução da Carla da data mais nova para a mais antiga', async () => {
  render(<Evolucao dados={criarDadosFixture(H)} alunoId="a1" hoje={H} />)
  const t = await screen.findByRole('table', { name: 'Evolução por data' })
  const linhas = within(t).getAllByRole('row').slice(1)
  expect(linhas).toHaveLength(2)
  expect(linhas[0]).toHaveTextContent('03/03/2026')
  expect(linhas[0]).toHaveTextContent('67,2 kg')
  expect(linhas[0]).toHaveTextContent('Agachamento: 40 kg')
  expect(linhas[1]).toHaveTextContent('08/02/2026')
})

test('registra uma nova medida e ela entra na ordem por data; remove também', async () => {
  render(<Evolucao dados={criarDadosFixture(H)} alunoId="a1" hoje={H} />)
  await screen.findByRole('table', { name: 'Evolução por data' })
  await userEvent.type(screen.getByLabelText(/Peso em kg/), '66,8')
  await userEvent.selectOptions(screen.getByLabelText(/Exercício da carga/), 'Prancha')
  await userEvent.type(screen.getByLabelText(/Carga em kg/), '5')
  await userEvent.click(screen.getByRole('button', { name: 'Registrar evolução' }))
  const t = await screen.findByRole('table', { name: 'Evolução por data' })
  await within(t).findByText('10/03/2026')
  const linhas = within(t).getAllByRole('row').slice(1)
  expect(linhas).toHaveLength(3)
  expect(linhas[0]).toHaveTextContent('10/03/2026')
  expect(linhas[0]).toHaveTextContent('66,8 kg')
  expect(linhas[0]).toHaveTextContent('Prancha: 5 kg')
  await userEvent.click(screen.getByRole('button', { name: 'Remover registro de 10/03/2026' }))
  expect(within(screen.getByRole('table')).queryByText('10/03/2026')).toBeNull()
})

test('registro vazio é recusado com aviso', async () => {
  render(<Evolucao dados={criarDadosFixture(H)} alunoId="a2" hoje={H} />)
  expect(await screen.findByText(/Sem registros ainda/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Registrar evolução' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('pelo menos um valor')
})

test('a data sugerida no formulário é a injetada', async () => {
  render(<Evolucao dados={criarDadosFixture(H)} alunoId="a1" hoje={H} />)
  expect(await screen.findByLabelText('Data')).toHaveValue(H)
})
