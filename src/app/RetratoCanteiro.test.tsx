import { act, render, screen } from '@testing-library/react'
import { RetratoCanteiro, chaveRetrato } from './RetratoCanteiro'

const END = 'http://127.0.0.1:4321/'
const FOTO = 'data:image/jpeg;base64,AAAA'
beforeEach(() => localStorage.clear())

test('parada e sem retrato: a imagem 3D de apoio, sem cena ao vivo', () => {
  const { container } = render(<RetratoCanteiro pasta="meu-ponto" endereco={END} vivo={false} />)
  expect(container.querySelector('iframe')).toBeNull()
  expect(container.querySelector('img')).not.toBeNull()
})

test('com retrato guardado, a cena parada é o retrato de quando o mouse saiu', () => {
  localStorage.setItem(chaveRetrato('meu-ponto'), FOTO)
  const { container } = render(<RetratoCanteiro pasta="meu-ponto" endereco={END} vivo={false} />)
  expect(container.querySelector('img')?.getAttribute('src')).toBe(FOTO)
})

test('com o mouse em cima, a cena ganha vida (AO VIVO); sem canteiro vivo, fica a imagem', () => {
  const { container, rerender } = render(<RetratoCanteiro pasta="meu-ponto" endereco={END} vivo />)
  expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
  expect(screen.getByText('AO VIVO')).toBeInTheDocument()
  rerender(<RetratoCanteiro pasta="outra" endereco="https://fora.com/" vivo />)
  expect(container.querySelector('iframe')).toBeNull()
})

test('o mouse sai: pede o retrato à cena, guarda e mostra; resposta de outra janela é ignorada', async () => {
  const { container, rerender } = render(<RetratoCanteiro pasta="meu-ponto" endereco={END} vivo />)
  const iframe = container.querySelector('iframe')!
  const pedidos: unknown[] = []
  iframe.contentWindow!.postMessage = ((m: unknown) => { pedidos.push(m) }) as typeof window.postMessage
  rerender(<RetratoCanteiro pasta="meu-ponto" endereco={END} vivo={false} />)
  expect(pedidos).toEqual([{ tipo: 'atlas:retrato' }])
  act(() => { window.dispatchEvent(new MessageEvent('message', { data: { tipo: 'atlas:retrato', imagem: 'data:image/jpeg;base64,XXXX' }, origin: 'http://127.0.0.1:4321', source: window })) })
  expect(localStorage.getItem(chaveRetrato('meu-ponto'))).toBeNull()
  act(() => { window.dispatchEvent(new MessageEvent('message', { data: { tipo: 'atlas:retrato', imagem: FOTO }, origin: 'http://127.0.0.1:4321', source: iframe.contentWindow })) })
  expect(localStorage.getItem(chaveRetrato('meu-ponto'))).toBe(FOTO)
  expect(container.querySelector('iframe')).toBeNull()
  expect(container.querySelector('img')?.getAttribute('src')).toBe(FOTO)
})

test('sem resposta da cena, a cena para mesmo assim (e fica o retrato anterior)', () => {
  vi.useFakeTimers()
  const { container, rerender } = render(<RetratoCanteiro pasta="meu-ponto" endereco={END} vivo />)
  rerender(<RetratoCanteiro pasta="meu-ponto" endereco={END} vivo={false} />)
  expect(container.querySelector('iframe')).not.toBeNull()
  act(() => { vi.advanceTimersByTime(1000) })
  expect(container.querySelector('iframe')).toBeNull()
  vi.useRealTimers()
})
