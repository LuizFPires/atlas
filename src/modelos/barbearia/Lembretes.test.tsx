import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Agenda } from './Agenda'
import { criarDadosFixture, diaDeHoje } from './dados'
import { criarEnvioFixture, lembretesQueSairiam } from './lembretes'

test('marca lembrete e mostra quais sairiam; cancelado não sai', async () => {
  const dados = criarDadosFixture()
  render(<Agenda dados={dados} dia={diaDeHoje()} nomeNegocio="Barbearia do Zé" />)
  const lista = await screen.findByRole('region', { name: 'Lembretes' })
  expect(lista).toHaveTextContent('Oi, João! Passando para lembrar do seu corte hoje às 09:00 na Barbearia do Zé')
  await userEvent.click(screen.getByRole('checkbox', { name: 'Lembrar o cliente das 10:30' }))
  expect(await screen.findByText(/Oi, Marcos!/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar 10:30' }))
  expect(screen.queryByText(/Oi, Marcos!/)).toBeNull()
})

test('o envio de fixture não envia de verdade e diz isso', async () => {
  const envio = criarEnvioFixture()
  render(<Agenda dados={criarDadosFixture()} dia={diaDeHoje()} envio={envio} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Enviar lembretes' }))
  expect(await screen.findByRole('status')).toHaveTextContent('nada foi enviado de verdade')
  expect(envio.enviados).toHaveLength(1)
})

test('lembretesQueSairiam ignora quem não está marcado', async () => {
  const d = criarDadosFixture()
  const hs = await d.listarHorarios(diaDeHoje())
  const cs = await d.listarClientes()
  expect(lembretesQueSairiam('X', hs.map((h) => ({ ...h, estado: 'cancelado' as const })), cs)).toEqual([])
})
