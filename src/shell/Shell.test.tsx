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

test('no tema claro usa o monograma de fundo claro', async () => {
  const { TemaProvider } = await import('../tema/tema')
  const { default: claro } = await import('../assets/monograma-fundo-claro.png')
  const { default: escuro } = await import('../assets/monograma-fundo-escuro.png')
  localStorage.setItem('atlas.tema', 'claro')
  const { container, unmount } = render(<TemaProvider><Shell ativo="ajuda" onNavegar={() => {}} onFalar={() => {}} /></TemaProvider>)
  expect(container.querySelector('.at-lateral__marca img')).toHaveAttribute('src', claro)
  expect(screen.getByRole('link', { name: /Ajuda do Atlas/ })).toHaveAttribute('aria-current', 'page')
  unmount()
  localStorage.setItem('atlas.tema', 'escuro')
  const r = render(<TemaProvider><Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} /></TemaProvider>)
  expect(r.container.querySelector('.at-lateral__marca img')).toHaveAttribute('src', escuro)
  localStorage.removeItem('atlas.tema')
})
