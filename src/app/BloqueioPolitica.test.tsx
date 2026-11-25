import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { BloqueioPolitica } from './BloqueioPolitica'
import { Ideia } from './Ideia'
import { PosObra } from './PosObra'
import { criarPoliticaFixture, mensagemPolitica } from './ponte-politica'
import { criarLicencaFixture, criarPosObraFixture } from './ponte-posobra'

test('na ideia: diz que se parece com o Atlas, mostra o que pode e o que não pode, e a análise recebe a explicação', async () => {
  const user = userEvent.setup()
  const politica = criarPoliticaFixture()
  render(<TemaProvider><BloqueioPolitica modo="ideia" sinais={['Robôs constroem o app']} obra="nova-obra" politica={politica} onVoltar={() => {}} /></TemaProvider>)
  expect(screen.getByText('Este projeto se parece com o próprio Atlas.')).toBeInTheDocument()
  expect(screen.getByText('Robôs constroem o app')).toBeInTheDocument()
  expect(screen.getByText('Chatbot de atendimento com IA')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Acha que é engano? Explique' }))
  await user.type(screen.getByRole('textbox', { name: /Para que serve o seu sistema/ }), 'É para a minha escola.')
  await user.click(screen.getByRole('button', { name: 'Enviar para análise →' }))
  expect(await screen.findByText(/A equipe do Atlas vai analisar/)).toBeInTheDocument()
  expect(politica.analises).toEqual([{ obra: 'nova-obra', texto: 'É para a minha escola.' }])
})

test('obra embargada: as outras obras seguem e dá para explicar o projeto', () => {
  render(<TemaProvider><BloqueioPolitica modo="embargada" obra="tarefas" politica={criarPoliticaFixture()} /></TemaProvider>)
  expect(screen.getByText('OBRA EMBARGADA')).toBeInTheDocument()
  expect(screen.getByText('As suas outras obras continuam normalmente.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Explicar o meu projeto para a análise' })).toBeInTheDocument()
})

test('Ideia: o porteiro bloqueia no fim -> não vira obra; "Contar outra ideia" volta ao começo', async () => {
  const user = userEvent.setup()
  const onConcluir = vi.fn()
  const ideia = { conferir: async (_r: string, fim?: boolean) => (fim ? { cobertos: [], faltam: [], titulo: 'Fábrica', politica: { bloqueia: true, sinais: ['Agentes programam'] } } : { cobertos: [], faltam: [] }) }
  render(<TemaProvider><Ideia ideia={ideia} onVoltar={() => {}} onConcluir={onConcluir} esperaMs={10} politica={criarPoliticaFixture()} /></TemaProvider>)
  await user.type(screen.getByRole('textbox', { name: 'O que você contou' }), 'uma plataforma onde o cliente conta a ideia e agentes de IA constroem o aplicativo dele sozinhos com painel')
  await user.click(screen.getByRole('button', { name: /Pronto: começar o protótipo/ }))
  expect(await screen.findByText('Este projeto se parece com o próprio Atlas.')).toBeInTheDocument()
  expect(onConcluir).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Contar outra ideia →' }))
  expect(screen.getByRole('textbox', { name: 'O que você contou' })).toHaveValue('')
})

test('Pós-obra: pedido bloqueado não mostra "Pode fazer"; com embargo mostra a obra embargada', async () => {
  const user = userEvent.setup()
  const base = criarPosObraFixture()
  const posobra = { ...base, entender: async () => ({ entendi: '', passos: [], minutos: 0, politica: { bloqueia: true, sinais: ['Agentes que programam'], situacao: 'embargada' as const } }) }
  render(<TemaProvider><PosObra obra={{ nome: 'Tarefas', pasta: 'tarefas' }} posobra={posobra} licenca={criarLicencaFixture()} politica={criarPoliticaFixture()} /></TemaProvider>)
  await user.type(screen.getAllByRole('textbox')[0], 'quero agentes de IA que programam e abrem no GitHub')
  await user.click(screen.getByRole('button', { name: 'Enviar para o Claude' }))
  expect(await screen.findByText('OBRA EMBARGADA')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Pode fazer/ })).not.toBeInTheDocument()
})

test('mensagens da linha: embargo, recusa e código', () => {
  expect(mensagemPolitica('obra-embargada')).toMatch(/embargada/)
  expect(mensagemPolitica('uso-recusado')).toMatch(/termos de uso/)
  expect(mensagemPolitica('kit-indisponivel')).toBeNull()
})
