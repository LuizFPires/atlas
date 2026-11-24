import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Prototipo } from './Prototipo'
import { ESTILOS_EXEMPLO } from './ponte-estilo'
import { criarPrototipoFixture } from './ponte-prototipo'

// Milestone 40 (P4 e P5 aprovados pelo Luiz em 24/11/2026): o protótipo abre num QUADRO NEGRO com todas as telas numeradas, e o
// Play ("Usar o sistema") abre o sistema em tela cheia, com setas, números e o pedido ligado à tela.
const obra = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda-da-barbearia-do-ze' }
async function abrir() {
  const user = userEvent.setup()
  const prototipo = criarPrototipoFixture()
  render(<TemaProvider><Prototipo obra={obra} estilo={ESTILOS_EXEMPLO[0]} prototipo={prototipo} onVoltar={() => {}} onConcluir={() => {}} /></TemaProvider>)
  await user.type(await screen.findByRole('textbox', { name: /Conte tudo o que você imagina/ }), 'Agenda do dia e marcar horário.')
  await user.click(screen.getByRole('button', { name: 'Desenhar as telas' }))
  const quadro = await screen.findByRole('region', { name: 'Quadro de telas' })
  return { user, prototipo, quadro }
}

test('abre no quadro: todas as telas lado a lado, numeradas, cada uma num iframe isolado', async () => {
  const { quadro } = await abrir()
  const numeros = within(quadro).getAllByRole('button', { name: /^Tela \d+ · / })
  expect(numeros.map((b) => b.textContent)).toEqual(['1Marcar horário', '2Agenda do dia', '3Confirmação', '4Início'])
  const frames = within(quadro).getAllByTitle(/^Tela \d+:/)
  expect(frames).toHaveLength(4)
  for (const f of frames) expect(f.getAttribute('sandbox')).toBe('')
})

test('zoom do quadro: menos e mais, com o tamanho dito em voz alta', async () => {
  const { user, quadro } = await abrir()
  const zoom = within(quadro).getByRole('status', { name: 'Zoom do quadro' })
  const antes = zoom.textContent
  await user.click(within(quadro).getByRole('button', { name: 'Aumentar' }))
  expect(zoom.textContent).not.toBe(antes)
  await user.click(within(quadro).getByRole('button', { name: 'Diminuir' }))
  expect(zoom.textContent).toBe(antes)
})

test('tocar no número da tela põe "TELA N" no pedido; o ajuste vai dizendo qual tela', async () => {
  const { user, quadro, prototipo } = await abrir()
  await user.click(within(quadro).getByRole('button', { name: 'Tela 2 · Agenda do dia' }))
  expect(screen.getByText('TELA 2')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Pedir ajuste'), 'aumente o botão')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(await screen.findByText(/Versão 2/)).toBeInTheDocument()
  expect((prototipo as unknown as { pedidos: string[] }).pedidos.at(-1)).toContain('Na tela 2 (Agenda do dia): aumente o botão')
})

test('"Usar o sistema" abre em tela cheia, passa de tela pelas setas e números, e o Esc fecha', async () => {
  const { user } = await abrir()
  await user.click(screen.getByRole('button', { name: /^Usar o sistema$/ }))
  const play = screen.getByRole('dialog', { name: 'Usando o sistema' })
  expect(play).toHaveTextContent('Tela 1 de 4 · Marcar horário')
  await user.click(within(play).getByRole('button', { name: 'Próxima tela' }))
  expect(play).toHaveTextContent('Tela 2 de 4 · Agenda do dia')
  await user.click(within(play).getByRole('button', { name: 'Ir para a tela 4' }))
  expect(play).toHaveTextContent('Tela 4 de 4 · Início')
  expect(within(play).getByTitle(/Tela Início no celular/).getAttribute('sandbox')).toBe('')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Usando o sistema' })).toBeNull()
})

test('na tela cheia, "Pedir mudança nesta tela" volta com a tela marcada no pedido', async () => {
  const { user } = await abrir()
  await user.click(screen.getByRole('button', { name: /^Usar o sistema$/ }))
  const play = screen.getByRole('dialog', { name: 'Usando o sistema' })
  await user.click(within(play).getByRole('button', { name: 'Próxima tela' }))
  await user.click(within(play).getByRole('button', { name: /Pedir mudança nesta tela/ }))
  expect(screen.queryByRole('dialog', { name: 'Usando o sistema' })).toBeNull()
  expect(screen.getByText('TELA 2')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText('Pedir ajuste')).toHaveFocus())
})

test('marcações no "Usar o sistema": aceitar a sugestão e mandar vira uma versão nova do protótipo', async () => {
  const { user, prototipo } = await abrir()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
  await user.click(screen.getByRole('button', { name: /^Usar o sistema$/ }))
  await user.click(screen.getByRole('button', { name: 'Marcar um ponto' }))
  fireEvent.click(screen.getByRole('button', { name: 'Escolher o lugar da marcação' }), { clientX: 100, clientY: 300 })
  await user.click(await screen.findByRole('button', { name: 'Aceitar' }))
  await user.click(screen.getByRole('button', { name: 'Mandar para o Atlas fazer' }))
  expect(await screen.findByText(/As bolinhas novas já estão na tela/)).toBeInTheDocument()
  expect((prototipo as unknown as { pedidos: string[] }).pedidos.at(-1)).toContain('Marcações do cliente no protótipo')
  expect((await prototipo.estado(obra.pasta)).versoes).toHaveLength(2)
  vi.restoreAllMocks()
})
