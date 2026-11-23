import { render, screen, within } from '@testing-library/react'
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

test('mostra a analogia da casa em cinco etapas, sem a seção de ideias (pedido do Luiz, 22/11/2026)', () => {
  montar()
  expect(screen.getByRole('heading', { name: 'Tudo pronto, Zé. Agora vamos construir.' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Fazer um sistema é igual construir uma casa.' })).toBeInTheDocument()
  expect(screen.getAllByText('NUMA CASA')).toHaveLength(5)
  expect(screen.getAllByText('NO ATLAS')).toHaveLength(5)
  expect(screen.queryByText(/IDEIAS PARA BARBEARIAS/)).toBeNull()
  for (const n of ['Agenda online', 'Fidelidade', 'Caixa do dia', 'Estoque']) expect(screen.queryByText(n)).toBeNull()
})

test('o primeiro passo vem antes de tudo, com o prédio subindo ao lado e a analogia logo abaixo', async () => {
  montar()
  const primeira = await screen.findByRole('region', { name: 'Comece a sua primeira obra' })
  const casa = screen.getByRole('region', { name: 'Fazer um sistema é igual construir uma casa' })
  expect(primeira.compareDocumentPosition(casa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const predio = screen.getByRole('img', { name: /prédio subindo/ })
  expect(primeira.parentElement).toContainElement(predio)
  expect(screen.getByText('Este prédio é o seu sistema.')).toBeInTheDocument()
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

test('"Já tenho um protótipo" encaminha ao fluxo de trazer', async () => {
  const { onTrazer } = montar()
  await userEvent.click(screen.getByRole('button', { name: 'Já tenho um protótipo' }))
  expect(onTrazer).toHaveBeenCalledTimes(1)
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

describe('obras começadas: um cartão por obra com "Continuar" (pedido do Luiz, 23/11/2026)', () => {
  const situacoes: Record<string, { estilo: boolean; prototipo: boolean; marca: boolean; plano: boolean }> = {
    'cartao-de-ponto': { estilo: false, prototipo: false, marca: false, plano: false },
    'agenda-do-ze': { estilo: true, prototipo: true, marca: false, plano: false },
    'loja-pronta': { estilo: true, prototipo: true, marca: true, plano: true },
  }
  const montarLista = () => {
    const o = criarObrasFixture('Zé', Object.keys(situacoes))
    const obras = { ...o, situacao: async (p: string) => situacoes[p] }
    const painel = { ler: async () => ({ pct: 100 }) }
    const onContinuar = vi.fn()
    render(<TemaProvider><Obras obras={obras} painel={painel} onComecar={() => {}} onTrazer={() => {}} onContinuar={onContinuar} /></TemaProvider>)
    return { onContinuar }
  }

  test('em andamento: cada obra mostra onde parou e o Continuar leva para lá', async () => {
    const { onContinuar } = montarLista()
    const cartao = await screen.findByRole('article', { name: 'Agenda do ze' })
    expect(cartao).toHaveTextContent('Parou em: dar o nome')
    expect(screen.getByRole('article', { name: 'Cartao de ponto' })).toHaveTextContent('Parou em: escolher o estilo')
    expect(screen.queryByRole('article', { name: 'Loja pronta' })).toBeNull()
    await userEvent.click(within(cartao).getByRole('button', { name: 'Continuar →' }))
    expect(onContinuar).toHaveBeenCalledWith({ pasta: 'agenda-do-ze', nome: 'Agenda do ze', etapa: 'batismo' })
  })

  test('a aba Concluídas mostra as obras prontas', async () => {
    montarLista()
    await userEvent.click(await screen.findByRole('tab', { name: 'Concluídas (1)' }))
    expect(screen.getByRole('article', { name: 'Loja pronta' })).toHaveTextContent('Obra pronta')
    expect(screen.queryByRole('article', { name: 'Agenda do ze' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Em andamento (2)' })).toHaveAttribute('aria-selected', 'false')
  })
})
