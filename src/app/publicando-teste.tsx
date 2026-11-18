import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Publicando } from './Publicando'
import { criarPublicarFixture, type PublicarFixture } from './ponte-publicar'
import type { Selecao } from './publicar-dados'

export const OBRA = { nome: 'Cadeira 1', pasta: 'C:/Atlas/Obras/cadeira1' }

export function montar(selecao: Selecao, pub: PublicarFixture = criarPublicarFixture(), p: Partial<React.ComponentProps<typeof Publicando>> = {}) {
  const onConcluir = vi.fn()
  const onPedirAjuda = vi.fn()
  render(<TemaProvider><Publicando obra={OBRA} selecao={selecao} publicar={pub} onConcluir={onConcluir} onPedirAjuda={onPedirAjuda} sondagemMs={10} {...p} /></TemaProvider>)
  return { pub, onConcluir, onPedirAjuda }
}
export const clicar = (nome: string | RegExp) => screen.findByRole('button', { name: nome }).then((b) => userEvent.click(b))
export const passoDe = (n: number, t: number) => screen.findByText(`PASSO ${n} DE ${t}`)
/** Quem faz o passo atual (selo VOCÊ ou O ATLAS). */
export const quem = async () => (await screen.findByLabelText(/Quem faz este passo/)).textContent
