import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Shell } from '../shell/Shell'
import { criarModeloFixture } from './ponte-modelo'

test('fixture: começa no recomendado (Opus 5.5) e guarda a troca', async () => {
  const m = criarModeloFixture()
  expect((await m.ler()).atual).toBe('claude-opus-5-5')
  await m.gravar('claude-sonnet-5-5')
  expect((await m.ler()).atual).toBe('claude-sonnet-5-5')
  await expect(m.gravar('qualquer')).rejects.toThrow('modelo-invalido')
})

test('menu: escolher o modelo do Claude no cartão do plano; o recomendado vem marcado', async () => {
  const escolher = vi.fn()
  const lista = [
    { id: 'claude-opus-5-5', nome: 'Opus 5.5', explica: 'O melhor resultado.', recomendado: true },
    { id: 'claude-sonnet-5-5', nome: 'Sonnet 5.5', explica: 'Mais rápido.', recomendado: false },
  ]
  render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} plano={{ valor: 'Max', sub: 'Conectado neste computador' }} modelo={{ atual: 'claude-opus-5-5', lista, escolher }} />)
  const sel = screen.getByRole('combobox', { name: 'Modelo do Claude' })
  expect(sel).toHaveValue('claude-opus-5-5')
  expect(screen.getByRole('option', { name: 'Opus 5.5 (recomendado)' })).toBeInTheDocument()
  await userEvent.selectOptions(sel, 'claude-sonnet-5-5')
  expect(escolher).toHaveBeenCalledWith('claude-sonnet-5-5')
})
