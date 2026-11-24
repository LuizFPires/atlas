import { act, render, screen } from '@testing-library/react'
import { StatusVoz } from './StatusVoz'
import { definirEstadoVoz, RECADO_SEM_MICROFONE } from './voz-motor'

afterEach(() => act(() => definirEstadoVoz({ fase: 'livre' })))

test('livre: não mostra nada', () => {
  const { container } = render(<StatusVoz />)
  expect(container).toBeEmptyDOMElement()
})

test('mostra cada fase da voz com palavras simples, e a barra na primeira vez', () => {
  render(<StatusVoz />)
  act(() => definirEstadoVoz({ fase: 'ouvindo' }))
  expect(screen.getByRole('status')).toHaveTextContent(/Ouvindo.*aperte o microfone de novo/i)
  act(() => definirEstadoVoz({ fase: 'preparando', progresso: 40 }))
  expect(screen.getByRole('status')).toHaveTextContent(/Preparando a voz do Atlas.*só na primeira vez/i)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  act(() => definirEstadoVoz({ fase: 'escrevendo' }))
  expect(screen.getByRole('status')).toHaveTextContent(/Escrevendo o que você falou/)
})

test('erro: mostra o recado e dá para fechar', () => {
  render(<StatusVoz />)
  act(() => definirEstadoVoz({ fase: 'erro', recado: RECADO_SEM_MICROFONE }))
  expect(screen.getByRole('alert')).toHaveTextContent(/Não consegui usar o microfone/)
  act(() => screen.getByRole('button', { name: 'Fechar o aviso' }).click())
  expect(screen.queryByRole('alert')).toBeNull()
})

test('ouvindo com rascunho: mostra as palavras que acabaram de ser faladas, sem esperar a pausa', () => {
  render(<StatusVoz />)
  act(() => definirEstadoVoz({ fase: 'ouvindo', rascunho: 'quero bater o ponto pelo celu' }))
  const s = screen.getByRole('status')
  expect(s).toHaveTextContent('quero bater o ponto pelo celu')
  expect(s).not.toHaveTextContent(/a cada pausa/)
})

test('embutido (D1): aparece dentro da gaveta, sem flutuar, e mostra o que já foi falado', () => {
  render(<StatusVoz embutido />)
  act(() => definirEstadoVoz({ fase: 'ouvindo', rascunho: 'o meu site não abre' }))
  const s = screen.getByRole('status')
  expect(s).toHaveClass('at-svoz--embutido')
  expect(s).toHaveTextContent(/Ouvindo.*o meu site não abre/)
})
