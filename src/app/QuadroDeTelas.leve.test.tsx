import { act, render, screen } from '@testing-library/react'
import { QuadroDeTelas } from './QuadroDeTelas'

// Luiz, 24/11/2026: o protótipo cresce além de 40 telas e "não pode travar". Com centenas de telas, desenhar todas ao mesmo tempo
// travaria o computador: o quadro só monta as telas perto da área visível; as outras ficam como um aparelho vazio com o nome.
type Cb = (e: { target: Element; isIntersecting: boolean }[]) => void
const vistos: { cb: Cb; alvos: Element[] }[] = []
class IOFalso {
  alvos: Element[] = []
  constructor(public cb: Cb) { vistos.push(this) }
  observe(el: Element) { this.alvos.push(el) }
  unobserve() {}
  disconnect() {}
}

test('com muitas telas, só as perto da área visível viram iframe; ao rolar, entram as outras', () => {
  const antes = globalThis.IntersectionObserver
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IOFalso
  try {
    const telas = Array.from({ length: 300 }, (_, i) => ({ id: `t${i}`, nome: `Tela ${i}`, html: `<main>${i}</main>` }))
    render(<QuadroDeTelas telas={telas} marcada={null} onMarcar={() => {}} onUsar={() => {}} />)
    expect(screen.queryAllByTitle(/^Tela \d+:/)).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: /^Tela \d+ · / })).toHaveLength(300) // números e nomes sempre lá
    const io = vistos.at(-1)!
    act(() => io.cb(io.alvos.slice(0, 6).map((target) => ({ target, isIntersecting: true }))))
    expect(screen.getAllByTitle(/^Tela \d+:/)).toHaveLength(6)
    act(() => io.cb(io.alvos.slice(0, 3).map((target) => ({ target, isIntersecting: false }))))
    expect(screen.getAllByTitle(/^Tela \d+:/)).toHaveLength(3)
  } finally { (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = antes }
})
