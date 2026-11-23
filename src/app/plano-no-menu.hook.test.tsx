import { act, renderHook } from '@testing-library/react'
import { usePlanoNoMenu } from './plano-no-menu'
import { criarClaudeFixture } from './ponte-claude'

// Rafael conectou pelo navegador e o cartão seguiu "Não conectado" com o botão (23/11/2026): relia só a cada 5 min.
test('não conectado: confere de novo em poucos segundos e troca para conectado sozinho', async () => {
  vi.useFakeTimers()
  const foco = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  try {
    const claude = criarClaudeFixture({ conectado: false })
    const { result } = renderHook(() => usePlanoNoMenu(claude))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current?.valor).toBe('Não conectado')
    const estadoReal = claude.estado.bind(claude)
    claude.estado = async () => ({ ...(await estadoReal()), conectado: true, assinatura: 'pro' })
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(result.current?.valor).toBe('Pro')
  } finally { vi.useRealTimers(); foco.mockRestore() }
})

test('com a janela do Atlas atrás (navegador na frente), não fica rodando a conferência de 3 em 3 s', async () => {
  vi.useFakeTimers()
  const foco = vi.spyOn(document, 'hasFocus').mockReturnValue(false)
  try {
    const claude = criarClaudeFixture({ conectado: false })
    const espia = vi.spyOn(claude, 'estado')
    renderHook(() => usePlanoNoMenu(claude))
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(espia).toHaveBeenCalledTimes(1)
  } finally { vi.useRealTimers(); foco.mockRestore() }
})

test('ao voltar para a janela do Atlas, confere na hora', async () => {
  const claude = criarClaudeFixture({ conectado: false })
  const { result } = renderHook(() => usePlanoNoMenu(claude))
  await act(async () => {})
  expect(result.current?.valor).toBe('Não conectado')
  const estadoReal = claude.estado.bind(claude)
  claude.estado = async () => ({ ...(await estadoReal()), conectado: true, assinatura: 'max' })
  await act(async () => { window.dispatchEvent(new Event('focus')) })
  expect(result.current?.valor).toBe('Max')
})
