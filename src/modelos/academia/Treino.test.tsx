import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Alunos } from './Alunos'
import { Treino } from './Treino'
import { criarDadosFixture, formatarCarga, numeroDoTexto, validarAluno, validarExercicio } from './dados'

test('validação de aluno e exercício', () => {
  expect(validarAluno({ nome: 'X', telefone: '11912345678' })).toMatch(/nome/)
  expect(validarAluno({ nome: 'Ana', telefone: '123' })).toMatch(/telefone/)
  expect(validarAluno({ nome: 'Ana', telefone: '(11) 91234-5678' })).toBeNull()
  const ex = { nome: 'Remada', series: 3, repeticoes: 10, cargaKg: null }
  expect(validarExercicio({ ...ex, series: 0 })).toMatch(/séries/)
  expect(validarExercicio({ ...ex, repeticoes: NaN })).toMatch(/repetições/)
  expect(validarExercicio({ ...ex, cargaKg: -2 })).toMatch(/carga/)
  expect(validarExercicio(ex)).toBeNull()
  expect(numeroDoTexto('12,5')).toBe(12.5)
  expect(numeroDoTexto('')).toBeNull()
  expect(numeroDoTexto('abc')).toBeNaN()
  expect(formatarCarga(12.5)).toBe('12,5 kg')
})

test('cadastra, edita e remove aluno', async () => {
  render(<Alunos dados={criarDadosFixture()} escolhido={null} onEscolher={() => {}} />)
  expect(await screen.findByText('Carla Mendes')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Falar' }).length).toBeGreaterThanOrEqual(2)
  await userEvent.type(screen.getByLabelText(/Nome do aluno/), 'Davi Souza')
  await userEvent.type(screen.getByLabelText(/Telefone/), '11955554444')
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar aluno' }))
  expect(await screen.findByText('Davi Souza')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Editar Davi Souza' }))
  const n = screen.getByLabelText(/Nome do aluno/)
  await userEvent.clear(n); await userEvent.type(n, 'Davi S. Lopes')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar aluno' }))
  expect(await screen.findByText('Davi S. Lopes')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Remover Davi S. Lopes' }))
  expect(screen.queryByText('Davi S. Lopes')).toBeNull()
})

test('aluno inválido mostra aviso e não cadastra', async () => {
  render(<Alunos dados={criarDadosFixture()} escolhido={null} onEscolher={() => {}} />)
  await screen.findByText('Carla Mendes')
  await userEvent.type(screen.getByLabelText(/Nome do aluno/), 'Davi')
  await userEvent.type(screen.getByLabelText(/Telefone/), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar aluno' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('telefone')
  expect(screen.queryByText('Davi')).toBeNull()
})

test('sem aluno escolhido, o treino pede para escolher', () => {
  render(<Treino dados={criarDadosFixture()} alunoId={null} />)
  expect(screen.getByText(/Escolha um aluno/)).toBeInTheDocument()
})

test('mostra o treino da Carla (não o do Bruno) e cria/edita/remove exercício', async () => {
  render(<Treino dados={criarDadosFixture()} alunoId="a1" />)
  const li = (await screen.findByText('Agachamento')).closest('li') as HTMLElement
  expect(within(li).getByText('4 x 12 · 40 kg')).toBeInTheDocument()
  expect(screen.getByText('Prancha').closest('li')).toHaveTextContent('sem carga')
  expect(screen.queryByText('Supino reto')).toBeNull()
  await userEvent.type(screen.getByRole('textbox', { name: /^Exercício/ }), 'Remada')
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar exercício' }))
  expect(await screen.findByText('Remada')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Editar Remada' }))
  await userEvent.type(screen.getByLabelText(/Carga/), '22,5')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar exercício' }))
  expect(await screen.findByText('3 x 10 · 22,5 kg')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Remover Remada' }))
  expect(screen.queryByText('Remada')).toBeNull()
})

test('exercício inválido é recusado', async () => {
  render(<Treino dados={criarDadosFixture()} alunoId="a1" />)
  await screen.findByText('Agachamento')
  await userEvent.type(screen.getByRole('textbox', { name: /^Exercício/ }), 'Remada')
  await userEvent.clear(screen.getByLabelText(/^Séries/))
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar exercício' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('séries')
})

test('escolher aluno conecta com o treino', async () => {
  const dados = criarDadosFixture()
  function Par() {
    const [id, setId] = useState<string | null>(null)
    return <><Alunos dados={dados} escolhido={id} onEscolher={setId} /><Treino dados={dados} alunoId={id} /></>
  }
  render(<Par />)
  await userEvent.click(await screen.findByRole('button', { name: 'Escolher Bruno Lima' }))
  expect(await screen.findByText('Supino reto')).toBeInTheDocument()
})
