import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { ComecarPlanilha } from './ComecarPlanilha'
import { criarPlanilhaFixture } from './ponte-planilha'
import { criarArquivosFixture } from './ponte-arquivos'

const montar = () => {
  const onConcluir = vi.fn()
  const criarSubpasta = vi.fn(async (nome: string) => ({ pasta: nome.toLowerCase().replace(/\s+/g, '-') }))
  const planilha = criarPlanilhaFixture()
  const levar = vi.spyOn(planilha, 'levarDados')
  render(<TemaProvider><ComecarPlanilha planilha={planilha} arquivos={criarArquivosFixture()} criarObra={criarSubpasta} onVoltar={() => {}} onConcluir={onConcluir} revelarMs={0} /></TemaProvider>)
  return { onConcluir, criarSubpasta, levar }
}

test('escolher a planilha cria a obra, lê as abas e mostra a conferência das contas', async () => {
  const { criarSubpasta } = montar()
  expect(screen.getByText(/Seus dados ficam no seu computador/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Escolher no computador' }))
  expect(criarSubpasta).toHaveBeenCalledWith('Compras 2026')
  expect(await screen.findByText(/Aba Pedidos/)).toBeInTheDocument()
  expect(await screen.findByText(/Tem macro/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Ver o que entendi →' }))
  expect(await screen.findByText('Conferi 214 contas da sua planilha: todas batem.')).toBeInTheDocument()
  expect(screen.getByText('Pedidos de compra')).toBeInTheDocument()
  expect(screen.getByText(/precisa de aprovação/)).toBeInTheDocument()
})

test('o mesmo botão de voz responde, acrescenta e muda; o Atlas mostra o que mudou e segue com os dados levados', async () => {
  const { onConcluir, levar } = montar()
  await userEvent.click(screen.getByRole('button', { name: 'Escolher no computador' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Ver o que entendi →' }))
  expect(await screen.findByText(/Quer acrescentar algo ou mudar alguma regra/)).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText(/Responder ou pedir mudança/), 'Quem aprova é o financeiro. Quero foto da nota.')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar para o Atlas' }))
  expect(await screen.findByText('Novo: foto da nota fiscal no pedido')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Está certo, seguir →' }))
  expect(levar).toHaveBeenCalledWith('compras-2026', true)
  expect(onConcluir).toHaveBeenCalledWith(expect.objectContaining({ pasta: 'compras-2026', nome: 'Compras 2026' }))
})
