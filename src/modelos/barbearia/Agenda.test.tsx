import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Agenda } from './Agenda'
import { criarDadosFixture, diaDeHoje } from './dados'

const itensDaAgenda = async () => within(await screen.findByRole('list', { name: 'Horários' })).getAllByRole('listitem')
const montar = () => {
  const dados = criarDadosFixture()
  render(<Agenda dados={dados} dia={diaDeHoje()} />)
  return dados
}

test('mostra os horários do dia em ordem', async () => {
  montar()
  const itens = await itensDaAgenda()
  expect(itens).toHaveLength(3)
  expect(itens[0]).toHaveTextContent('09:00 · João Pereira · Corte')
})

test('cria um horário novo', async () => {
  const dados = montar()
  await itensDaAgenda()
  await userEvent.selectOptions(screen.getByLabelText('Cliente'), 'Marcos Lima')
  await userEvent.selectOptions(screen.getByLabelText('Serviço'), 'Sobrancelha')
  await userEvent.type(screen.getByLabelText('Hora'), '17:00')
  await userEvent.click(screen.getByRole('button', { name: 'Marcar horário' }))
  expect(await screen.findByText(/Sobrancelha/, { selector: 'span' })).toBeInTheDocument()
  expect((await dados.listarHorarios(diaDeHoje())).map((h) => h.hora)).toContain('17:00')
})

test('não deixa marcar duas pessoas na mesma hora nem sem preencher', async () => {
  montar()
  await itensDaAgenda()
  await userEvent.click(screen.getByRole('button', { name: 'Marcar horário' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Escolha')
  await userEvent.selectOptions(screen.getByLabelText('Cliente'), 'Marcos Lima')
  await userEvent.type(screen.getByLabelText('Hora'), '09:00')
  await userEvent.click(screen.getByRole('button', { name: 'Marcar horário' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Já tem alguém')
})

test('edita um horário', async () => {
  montar()
  await itensDaAgenda()
  await userEvent.click(screen.getByRole('button', { name: 'Editar 09:00' }))
  const hora = screen.getByLabelText('Hora')
  await userEvent.clear(hora)
  await userEvent.type(hora, '09:30')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar mudança' }))
  const itens = await itensDaAgenda()
  expect(itens[0]).toHaveTextContent('09:30 · João Pereira')
})

test('cancela um horário', async () => {
  const dados = montar()
  await itensDaAgenda()
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar 10:30' }))
  const item = (await itensDaAgenda())[1]
  expect(within(item).getByText('Cancelado')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cancelar 10:30' })).toBeNull()
  expect((await dados.listarHorarios(diaDeHoje()))[1].estado).toBe('cancelado')
})

test('quando a porta rejeita, mostra aviso amigável; depois de um sucesso o erro some', async () => {
  const dados = criarDadosFixture()
  const cancelar = vi.spyOn(dados, 'cancelarHorario')
  render(<Agenda dados={dados} dia={diaDeHoje()} />)
  await itensDaAgenda()
  cancelar.mockRejectedValueOnce(new Error('rede'))
  await userEvent.click(screen.getAllByRole('button', { name: /Cancelar/ })[0])
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar/salvar agora. Tente de novo.')
  await userEvent.click(screen.getAllByRole('button', { name: /Cancelar/ })[0])
  await vi.waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})

test('se a carga inicial falha, mostra o aviso', async () => {
  const dados = criarDadosFixture()
  vi.spyOn(dados, 'listarHorarios').mockRejectedValue(new Error('rede'))
  render(<Agenda dados={dados} dia={diaDeHoje()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Tente de novo.')
})
