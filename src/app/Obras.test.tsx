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

test('mostra a analogia da casa em cinco etapas e os exemplos de sistemas', () => {
  montar()
  expect(screen.getByRole('heading', { name: 'Tudo pronto, Zé. Agora vamos construir.' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Fazer um sistema é igual construir uma casa.' })).toBeInTheDocument()
  expect(screen.getAllByText('NUMA CASA')).toHaveLength(5)
  expect(screen.getAllByText('NO ATLAS')).toHaveLength(5)
  for (const n of ['Agenda online', 'Fidelidade', 'Caixa do dia', 'Estoque']) expect(screen.getByText(n)).toBeInTheDocument()
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

test('"Já tenho um protótipo" encaminha ao fluxo de trazer; uma ideia começa com o nome dela', async () => {
  const { onTrazer, onComecar } = montar()
  await userEvent.click(screen.getByRole('button', { name: 'Já tenho um protótipo' }))
  expect(onTrazer).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: /Agenda online/ }))
  expect(onComecar).toHaveBeenCalledWith('Agenda online')
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
