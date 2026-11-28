import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { PublicarAgora } from './PublicarAgora'
import type { PedidoAnterior } from './ponte-posobra'

// Guilherme (27/11/2026): "quero que poste sem as alterações". O painel diz o que vai e o que fica de fora.
const LISTA: PedidoAnterior[] = [
  { id: 'p022', nome: 'Exportar para a contabilidade', data: '', status: 'em-andamento', fila: 'fila', podeCancelar: true },
  { id: 'p021', nome: 'Filtro por obra', data: '', status: 'em-andamento', fila: 'agora', podeCancelar: true },
  { id: 'p020', nome: 'Hora extra no domingo', data: '', status: 'para-conferir', podeDescartar: true },
  { id: 'p019', nome: 'Relatório do mês', data: '', status: 'no-ar' },
]
const obra = { nome: 'Ponto', pasta: 'ponto' }

test('mostra o que vai para o ar e o que fica na fila; publicar chama o Atlas e vai para o acompanhamento', async () => {
  const user = userEvent.setup()
  const chamadas: string[] = []
  const onPublicando = vi.fn()
  render(<TemaProvider><PublicarAgora obra={obra} endereco="https://ponto-sistema.vercel.app" posobra={{ historico: async () => LISTA, publicarAgora: async (p) => { chamadas.push(p); return { ok: true } } }} onFechar={() => {}} onPublicando={onPublicando} /></TemaProvider>)
  const vai = await screen.findByRole('region', { name: 'Vai para o ar' })
  expect(within(vai).getByText('Hora extra no domingo')).toBeInTheDocument()
  expect(within(vai).getByText('ponto-sistema.vercel.app')).toBeInTheDocument()
  const fora = screen.getByRole('region', { name: 'Fica de fora' })
  expect(within(fora).getByText('Filtro por obra')).toBeInTheDocument()
  expect(within(fora).getByText('sendo feita')).toBeInTheDocument()
  expect(within(fora).getByText('Exportar para a contabilidade')).toBeInTheDocument()
  expect(screen.getByText(/volta sozinha/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Publicar agora →' }))
  expect(chamadas).toEqual(['ponto'])
  expect(onPublicando).toHaveBeenCalled()
})

test('erro ao começar: explica em português e deixa tentar de novo; Esc fecha', async () => {
  const user = userEvent.setup()
  const onFechar = vi.fn()
  render(<TemaProvider><PublicarAgora obra={obra} posobra={{ historico: async () => [], publicarAgora: async () => { throw new Error('ja-rodando') } }} onFechar={onFechar} onPublicando={() => {}} /></TemaProvider>)
  await user.click(await screen.findByRole('button', { name: 'Publicar agora →' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('terminando outra ação')
  expect(screen.getByRole('button', { name: 'Publicar agora →' })).toBeEnabled()
  await user.keyboard('{Escape}')
  expect(onFechar).toHaveBeenCalled()
})
