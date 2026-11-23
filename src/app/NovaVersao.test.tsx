import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NovaVersao } from './NovaVersao'

const ponte = (versao: string | null) => ({ pronta: vi.fn(async () => versao), instalar: vi.fn(async () => true) })

test('sem versão nova baixada: não mostra nada no topo', async () => {
  const p = ponte(null)
  const { container } = render(<NovaVersao ponte={p} />)
  await act(async () => {})
  expect(p.pronta).toHaveBeenCalled()
  expect(container).toBeEmptyDOMElement()
})

test('versão nova pronta: um clique em "Atualizar agora" instala na hora', async () => {
  const p = ponte('0.1.42')
  render(<NovaVersao ponte={p} />)
  const aviso = await screen.findByRole('status')
  expect(aviso).toHaveTextContent('Nova versão do Atlas')
  expect(aviso).toHaveTextContent('fecha por alguns segundos e abre de novo')
  await userEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }))
  expect(p.instalar).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Atualizando…' })).toBeDisabled()
})

test('o aviso aparece sozinho quando o download termina com o Atlas aberto', async () => {
  vi.useFakeTimers()
  try {
    let versao: string | null = null
    const p = { pronta: vi.fn(async () => versao), instalar: vi.fn(async () => true) }
    render(<NovaVersao ponte={p} intervaloMs={60_000} />)
    await act(async () => {})
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    versao = '0.1.42'
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(screen.getByRole('button', { name: 'Atualizar agora' })).toBeInTheDocument()
  } finally { vi.useRealTimers() }
})

test('se não der para instalar agora, volta o botão e avisa que instala ao fechar', async () => {
  const p = { pronta: vi.fn(async () => '0.1.42'), instalar: vi.fn(async () => false) }
  render(<NovaVersao ponte={p} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Atualizar agora' }))
  expect(await screen.findByText(/instala sozinha quando você fechar o Atlas/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Atualizar agora' })).toBeEnabled()
})

test('fora do app instalado (sem ponte): não mostra nada', () => {
  const { container } = render(<NovaVersao ponte={undefined} />)
  expect(container).toBeEmptyDOMElement()
})

test('quando a procura falha por um motivo que não é "já está atualizado": diz o motivo e deixa procurar de novo', async () => {
  let ultima: { estado: string; versaoAtual: string } = { estado: 'servidor-sem-rota', versaoAtual: '0.1.80' }
  const p = { ...ponte(null), situacao: vi.fn(async () => ultima), procurar: vi.fn(async () => { ultima = { estado: 'atual', versaoAtual: '0.1.80' }; return ultima }) }
  render(<NovaVersao ponte={p} />)
  const aviso = await screen.findByRole('status')
  expect(aviso).toHaveTextContent('Não consegui procurar versão nova')
  expect(aviso).toHaveTextContent('0.1.80')
  await userEvent.click(screen.getByRole('button', { name: 'Procurar de novo' }))
  expect(p.procurar).toHaveBeenCalledTimes(1)
  expect(await screen.findByText(/já está na versão mais nova/)).toBeInTheDocument()
})

test('já atualizado ou sem internet momentânea: não incomoda ninguém', async () => {
  for (const estado of ['atual', 'sem-rede', 'ocupado']) {
    const p = { ...ponte(null), situacao: vi.fn(async () => ({ estado, versaoAtual: '0.1.80' })), procurar: vi.fn() }
    const { container, unmount } = render(<NovaVersao ponte={p} />)
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
    unmount()
  }
})
