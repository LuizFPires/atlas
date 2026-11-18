import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Celular } from './Celular'
import { criarCelularFixture } from './ponte-celular'

const montar = () => {
  const onVoltar = vi.fn(), onConcluir = vi.fn()
  render(<TemaProvider><Celular celular={criarCelularFixture()} onVoltar={onVoltar} onConcluir={onConcluir} /></TemaProvider>)
  return { onVoltar, onConcluir }
}

test('mostra o QR do app do Claude e a conta do cliente', () => {
  montar()
  expect(screen.getByRole('img', { name: 'QR code para baixar o app do Claude' })).toBeInTheDocument()
  expect(screen.getByText('1. Baixe o app do Claude no celular')).toBeInTheDocument()
  expect(screen.getByText('ÚLTIMO PASSO')).toBeInTheDocument()
})

test('voltar e concluir', async () => {
  const { onVoltar, onConcluir } = montar()
  await userEvent.click(screen.getByRole('button', { name: '← Voltar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Concluir e ir para as obras →' }))
  expect(onVoltar).toHaveBeenCalled()
  expect(onConcluir).toHaveBeenCalled()
})
