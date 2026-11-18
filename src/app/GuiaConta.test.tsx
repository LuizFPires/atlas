import { render, screen } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { CartaoPasso, PreviaSite } from './GuiaConta'
import { CONTAS } from './contas-passos'

test('todo passo diz quem faz (VOCÊ ou O ATLAS) e o botão certo da imagem pisca', () => {
  for (const c of CONTAS.filter((x) => !x.opcional)) {
    for (const p of c.passos) {
      expect(['voce', 'atlas']).toContain(p.quem)
      if (p.faca.startsWith('Clique') || p.site.itens.length) expect(p.site.itens.some((i) => i.destaque)).toBe(true)
    }
  }
})

test('o cartão mostra selo, tradução e a imagem do site com a dica', () => {
  const passo = CONTAS[0].passos[0]
  render(<TemaProvider><CartaoPasso passo={passo} n={1} total={5} /><PreviaSite site={passo.site} /></TemaProvider>)
  expect(screen.getByText('PASSO 1 DE 5')).toBeInTheDocument()
  expect(screen.getByLabelText(/Quem faz este passo: O ATLAS/)).toBeInTheDocument()
  expect(screen.getByText(/quer dizer/)).toHaveTextContent('Sign up quer dizer "Criar conta"')
  expect(screen.getByRole('img', { name: /github\.com/ })).toBeInTheDocument()
  expect(screen.getByText('este aqui')).toBeInTheDocument()
})
