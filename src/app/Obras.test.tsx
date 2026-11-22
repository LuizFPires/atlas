import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Obras } from './Obras'
import { criarObrasFixture, type ObrasFixture } from './ponte-obras'

const montar = (o: ObrasFixture = criarObrasFixture()) => {
  const onComecar = vi.fn()
  const onTrazer = vi.fn()
  render(<TemaProvider><Obras obras={o} onComecar={onComecar} onTrazer={onTrazer} /></TemaProvider>)
  return { o, onComecar, onTrazer }
}

test('mostra a analogia da casa em cinco etapas, sem a seção de ideias (pedido do Luiz, 22/11/2026)', () => {
  montar()
  expect(screen.getByRole('heading', { name: 'Tudo pronto, Zé. Agora vamos construir.' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Fazer um sistema é igual construir uma casa.' })).toBeInTheDocument()
  expect(screen.getAllByText('NUMA CASA')).toHaveLength(5)
  expect(screen.getAllByText('NO ATLAS')).toHaveLength(5)
  expect(screen.queryByText(/IDEIAS PARA BARBEARIAS/)).toBeNull()
  for (const n of ['Agenda online', 'Fidelidade', 'Caixa do dia', 'Estoque']) expect(screen.queryByText(n)).toBeNull()
})

test('o primeiro passo vem antes de tudo, com o prédio subindo ao lado e a analogia logo abaixo', async () => {
  montar()
  const primeira = await screen.findByRole('region', { name: 'Comece a sua primeira obra' })
  const casa = screen.getByRole('region', { name: 'Fazer um sistema é igual construir uma casa' })
  expect(primeira.compareDocumentPosition(casa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const predio = screen.getByRole('img', { name: /prédio subindo/ })
  expect(primeira.parentElement).toContainElement(predio)
  expect(screen.getByText('Este prédio é o seu sistema.')).toBeInTheDocument()
})

test('primeira obra vazia tem um único botão principal claro', async () => {
  const { onComecar } = montar()
  expect(await screen.findByRole('heading', { name: 'Comece a sua primeira obra' })).toBeInTheDocument()
  const principal = screen.getByRole('button', { name: 'Começar do zero →' })
  expect(principal.className).toContain('--principal')
  expect(document.querySelectorAll('.at-obras__acao--principal')).toHaveLength(1)
  await userEvent.click(principal)
  expect(onComecar).toHaveBeenCalledWith()
})

test('"Já tenho um protótipo" encaminha ao fluxo de trazer', async () => {
  const { onTrazer } = montar()
  await userEvent.click(screen.getByRole('button', { name: 'Já tenho um protótipo' }))
  expect(onTrazer).toHaveBeenCalledTimes(1)
})

test('com obras já começadas, lista as pastas e oferece outra obra', async () => {
  montar(criarObrasFixture('Zé', ['agenda-online']))
  expect(await screen.findByRole('heading', { name: 'Comece outra obra' })).toBeInTheDocument()
  expect(screen.getByText(/agenda-online/)).toBeInTheDocument()
})

test('"Abrir a pasta" pede para abrir a pasta das obras', async () => {
  const { o } = montar()
  await userEvent.click(screen.getByRole('button', { name: 'Abrir a pasta' }))
  expect(o.aberturas).toBe(1)
})
