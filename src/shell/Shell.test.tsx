import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Shell } from './Shell'

test('mostra itens, marca o ativo e mantém Falar e Ajuda fixos', async () => {
  const onNavegar = vi.fn(), onFalar = vi.fn()
  render(<Shell ativo="obras" onNavegar={onNavegar} onFalar={onFalar} />)
  expect(screen.getByRole('link', { name: 'Minhas obras' })).toHaveAttribute('aria-current', 'page')
  await userEvent.click(screen.getByRole('button', { name: /Falar com o Atlas/ }))
  expect(onFalar).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('link', { name: /Ajuda do Atlas/ }))
  expect(onNavegar).toHaveBeenCalledWith('ajuda')
  await userEvent.click(screen.getByRole('link', { name: 'Pós-obra' }))
  expect(onNavegar).toHaveBeenCalledWith('posobra')
})
