import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { EntregaApp } from './EntregaApp'
import { criarEntregaFixture, slugDoNome } from './entrega'

const montar = (porta = criarEntregaFixture()) => render(<TemaProvider><EntregaApp porta={porta} /></TemaProvider>)

test('slug do nome: sem acento nem símbolo', () => {
  expect(slugDoNome('Barbearia do Zé')).toBe('barbeariadoze')
  expect(slugDoNome('!!!')).toBe('meuapp')
})

test('app pronto: título, link, botões e instruções Android/iPhone', async () => {
  montar()
  expect(await screen.findByRole('heading', { name: 'O app da Barbearia do Zé está no ar.' })).toBeInTheDocument()
  expect(screen.getByText('barbeariadoze.atlas-ia.app.br')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Instalar no celular/ })).toHaveAttribute('href', 'https://barbeariadoze.atlas-ia.app.br')
  expect(screen.getByRole('link', { name: /Mudar no Atlas/ })).toHaveAttribute('href', '/app')
  expect(screen.getByText('Android')).toBeInTheDocument()
  expect(screen.getByText('iPhone')).toBeInTheDocument()
})

test('copiar avisa que copiou', async () => {
  const user = userEvent.setup()
  montar()
  await user.click(await screen.findByRole('button', { name: 'copiar' }))
  expect(await screen.findByRole('button', { name: 'copiado' })).toBeInTheDocument()
})

test('montando e falhou têm texto próprio', async () => {
  const { unmount } = montar(criarEntregaFixture('X', 'montando'))
  expect(await screen.findByText(/montando o seu app/)).toBeInTheDocument()
  unmount()
  montar({ estado: async () => { throw new Error('x') } })
  expect(await screen.findByRole('alert')).toHaveTextContent(/Sem conexão/)
})
