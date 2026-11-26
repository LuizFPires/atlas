import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { UsarSistema } from './UsarSistema'
import { criarPrototipoFixture } from './ponte-prototipo'
import { ESTILOS_EXEMPLO } from './ponte-estilo'

// Milestone 40 (Luiz, 24/11/2026): marcação na tela, o Atlas sugere a ação (Aceitar, Sugerir outra, Editar) e as marcações vão
// juntas para o Atlas fazer, criando o que falta ou ajustando o que já existe.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
})
afterEach(() => vi.restoreAllMocks())

async function abrir() {
  const p = criarPrototipoFixture()
  const e = await p.desenhar('obra', 'Colore', ESTILOS_EXEMPLO[0], 'agenda')
  const telas = e.versoes[0].telas
  const mandar = vi.fn<(pedido: string) => Promise<void>>(async () => {})
  const user = userEvent.setup()
  render(<TemaProvider><UsarSistema obraNome="Colore" telas={telas} inicial={telas[0].id} onFechar={() => {}} onPedirMudanca={() => {}}
    sugerir={(id, x, y) => p.sugerirMarcacao!('obra', id, x, y)} onMandar={mandar} /></TemaProvider>)
  return { user, mandar, telas }
}
const marcar = async (user: ReturnType<typeof userEvent.setup>, x: number, y: number) => {
  await user.click(screen.getByRole('button', { name: 'Marcar um ponto' }))
  expect(screen.getByText(/Toque no lugar da tela que você quer criar ou mudar/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Escolher o lugar da marcação' }), { clientX: x, clientY: y })
}

test('marcar: o pino cai no lugar e o Atlas sugere a ação; "Sugerir outra" troca; "Aceitar" guarda', async () => {
  const { user } = await abrir()
  await marcar(user, 100, 300)
  expect(screen.getByRole('button', { name: 'Marcação 1' })).toBeInTheDocument()
  const balao = await screen.findByRole('dialog', { name: 'Marcação 1' })
  expect(balao).toHaveTextContent('DESENHAR O QUE FALTA')
  expect(await within(balao).findByText(/O ATLAS SUGERE · 1 DE 3/)).toBeInTheDocument()
  expect(balao).toHaveTextContent('Ao tocar no item, abrir o detalhe com tudo dele.')
  await user.click(within(balao).getByRole('button', { name: 'Sugerir outra' }))
  expect(balao).toHaveTextContent(/2 DE 3/)
  await user.click(within(balao).getByRole('button', { name: 'Aceitar' }))
  const lista = screen.getByRole('region', { name: 'Suas marcações' })
  expect(lista).toHaveTextContent('SUAS MARCAÇÕES · 1')
  expect(lista).toHaveTextContent('Ao tocar no item, abrir um resumo curto com dois botões.')
})

test('"Editar" abre a sugestão como texto para mudar (com microfone) e "Guardar marcação" guarda o que a pessoa escreveu', async () => {
  const { user } = await abrir()
  await marcar(user, 100, 700)
  const balao = await screen.findByRole('dialog', { name: 'Marcação 1' })
  expect(balao).toHaveTextContent('CRIAR ALGO NOVO AQUI')
  await within(balao).findByText(/O ATLAS SUGERE/)
  await user.click(within(balao).getByRole('button', { name: 'Editar' }))
  const campo = within(balao).getByRole('textbox')
  expect(campo).toHaveValue('Colocar aqui um botão "Repetir o último".')
  expect(within(balao).getByRole('button', { name: 'Falar' })).toBeInTheDocument()
  await user.clear(campo)
  await user.type(campo, 'Um botão de ligar para o cliente')
  await user.click(within(balao).getByRole('button', { name: 'Guardar marcação' }))
  expect(screen.getByRole('region', { name: 'Suas marcações' })).toHaveTextContent('Um botão de ligar para o cliente')
})

test('"Mandar para o Atlas fazer" leva todas as marcações num pedido só (tela, ponto, o que é e o que fazer) e limpa os pinos', async () => {
  const { user, mandar, telas } = await abrir()
  await marcar(user, 100, 300)
  await user.click(await screen.findByRole('button', { name: 'Aceitar' }))
  await user.click(screen.getByRole('button', { name: 'Próxima tela' }))
  await marcar(user, 50, 60)
  await user.click(await screen.findByRole('button', { name: 'Aceitar' }))
  await user.click(screen.getByRole('button', { name: 'Mandar para o Atlas fazer' }))
  await waitFor(() => expect(mandar).toHaveBeenCalledTimes(1))
  const pedido = mandar.mock.calls[0][0]
  expect(pedido).toContain(`1. Tela 1 (${telas[0].nome}), no ponto x=100, y=300 [desenhar: Item da lista]: Ao tocar no item, abrir o detalhe com tudo dele.`)
  expect(pedido).toContain(`2. Tela 2 (${telas[1].nome}), no ponto x=50, y=60 [ajustar: Título da tela]: Trocar o título por um mais curto.`)
  expect(await screen.findByText(/Pronto/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Marcação \d/ })).toBeNull()
})

test('"Tirar a marcação" apaga o pino', async () => {
  const { user } = await abrir()
  await marcar(user, 100, 300)
  const balao = await screen.findByRole('dialog', { name: 'Marcação 1' })
  await user.click(within(balao).getByRole('button', { name: 'Tirar a marcação' }))
  expect(screen.queryByRole('button', { name: 'Marcação 1' })).toBeNull()
})

// Achado em 26/11/2026 (conferência do vídeo do Dudu): tocar num botão DENTRO do protótipo troca a tela no iframe, mas o topo
// continuava em "Tela 1" e a marcação ia para a tela errada. Agora a prévia conta qual tela está aberta (script do Atlas com nonce).
test('tocar num botão dentro do protótipo: o topo, os números e a marcação seguem a tela aberta; o app não recarrega a prévia', async () => {
  const { user, mandar, telas } = await abrir()
  const frame = document.querySelector('iframe')!
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  expect(frame.getAttribute('srcdoc')).toMatch(/<script nonce="[A-Za-z0-9]{16,64}">/)
  const pedidos: unknown[] = []
  frame.contentWindow!.postMessage = ((m: unknown) => { pedidos.push(m) }) as typeof window.postMessage
  const avisar = (id: string, source: MessageEventSource | null = frame.contentWindow) => act(() => { window.dispatchEvent(new MessageEvent('message', { data: { tipo: 'atlas:tela', id }, source })) })
  avisar(telas[1].id, window) // de outra janela: ignorado
  expect(screen.getByText(`Tela 1 de ${telas.length} · ${telas[0].nome}`)).toBeInTheDocument()
  avisar(telas[1].id)
  expect(screen.getByText(`Tela 2 de ${telas.length} · ${telas[1].nome}`)).toBeInTheDocument()
  expect(document.querySelector('iframe')).toBe(frame) // mesma prévia: a navegação de dentro não recarrega
  await marcar(user, 100, 300)
  const balao = await screen.findByRole('dialog', { name: 'Marcação 1' })
  await within(balao).findByText(/O ATLAS SUGERE/)
  await user.click(within(balao).getByRole('button', { name: 'Aceitar' }))
  await user.click(screen.getByRole('button', { name: /Mandar para o Atlas fazer/ }))
  await waitFor(() => expect(mandar).toHaveBeenCalled())
  expect(mandar.mock.calls[0][0]).toContain(`1. Tela 2 (${telas[1].nome})`)
  // Os números do app levam a prévia à tela pedida sem recarregar
  await user.click(screen.getByRole('button', { name: 'Ir para a tela 3' }))
  expect(pedidos).toContainEqual({ tipo: 'atlas:ir', id: telas[2].id })
  expect(document.querySelector('iframe')).toBe(frame)
  avisar('falta') // "ainda não foi desenhada": continua na última tela conhecida
  expect(screen.getByText(`Tela 3 de ${telas.length} · ${telas[2].nome}`)).toBeInTheDocument()
})
