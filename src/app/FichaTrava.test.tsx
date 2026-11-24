import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { FichaTrava } from './FichaTrava'
import { criarTravasFixture } from './ponte-travas'
import type { TravaObra } from './travas'

const montar = (trava: TravaObra) => {
  const ponte = criarTravasFixture()
  const onLigarContas = vi.fn()
  render(<TemaProvider><FichaTrava pasta="obra" trava={trava} ponte={ponte} onLigarContas={onLigarContas} /></TemaProvider>)
  return { ponte, onLigarContas }
}

test('Supabase dormindo: ficha no topo, "Acordar" abre o site ao lado com o botão traduzido e depois diz que o Atlas percebe sozinho', async () => {
  const { ponte } = montar({ id: 3, tipo: 'supabase-dormindo', servico: 'Supabase', liberaEm: null })
  expect(screen.getByRole('heading', { name: /O caderno do seu sistema dormiu/ })).toBeInTheDocument()
  expect(screen.getByText('O QUE ACONTECEU')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Acordar o caderno agora/ }))
  expect(ponte.abertos).toEqual(['supabase-dormindo'])
  expect(screen.getByText(/quer dizer/)).toHaveTextContent('Restore project quer dizer "Acordar o projeto"')
  await userEvent.click(screen.getByRole('button', { name: 'Já cliquei' }))
  expect(screen.getByText(/percebe sozinho/)).toBeInTheDocument()
})

test('GitHub sem minutos: público só depois de confirmar o que fica visível', async () => {
  const { ponte } = montar({ id: 1, tipo: 'github-minutos', servico: 'GitHub', liberaEm: null })
  await userEvent.click(screen.getByRole('button', { name: 'Ver o que muda' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('qualquer pessoa na internet pode ver o código')
  expect(ponte.publicas).toEqual([])
  await userEvent.click(screen.getByRole('button', { name: /Entendi, deixar público/ }))
  expect(ponte.publicas).toEqual(['obra'])
  expect(await screen.findByText(/volta para privado sozinho/)).toBeInTheDocument()
})

test('conta desligada: "Ligar de novo" leva à tela das contas', async () => {
  const { onLigarContas } = montar({ id: 4, tipo: 'conta-desligada', servico: 'GitHub', liberaEm: null })
  await userEvent.click(screen.getByRole('button', { name: 'Ligar de novo →' }))
  expect(onLigarContas).toHaveBeenCalled()
})

test('fazer depois recolhe a ficha numa linha, sem sumir', async () => {
  montar({ id: 3, tipo: 'supabase-dormindo', servico: 'Supabase', liberaEm: null })
  await userEvent.click(screen.getByRole('button', { name: 'Fazer depois' }))
  expect(screen.queryByText('O QUE ACONTECEU')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Ver o que fazer/ }))
  expect(screen.getByText('O QUE ACONTECEU')).toBeInTheDocument()
})
