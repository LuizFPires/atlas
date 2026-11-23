import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AbasDaObra } from './AbasDaObra'

test('dentro da obra: volta ao Canteiro e troca entre Construção, Protótipo e Pedir mudança', async () => {
  const onIr = vi.fn()
  const onCanteiro = vi.fn()
  render(<AbasDaObra nome="Meu Ponto" atual="obra" onIr={onIr} onCanteiro={onCanteiro} />)
  expect(screen.getByRole('tablist', { name: 'Partes da obra Meu Ponto' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Construção' })).toHaveAttribute('aria-selected', 'true')
  await userEvent.click(screen.getByRole('tab', { name: 'Protótipo' }))
  expect(onIr).toHaveBeenCalledWith('prototipo')
  await userEvent.click(screen.getByRole('tab', { name: 'Pedir mudança' }))
  expect(onIr).toHaveBeenCalledWith('posobra')
  await userEvent.click(screen.getByRole('button', { name: /Canteiro de obras/ }))
  expect(onCanteiro).toHaveBeenCalled()
})
