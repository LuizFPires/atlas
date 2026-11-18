import { render, screen } from '@testing-library/react'
import { Monograma, NomeAtlas, ImagemAssinatura } from './Marca'

test('carrega a marca', () => {
  const { container } = render(<><Monograma /><NomeAtlas /><ImagemAssinatura /></>)
  expect(container.querySelectorAll('img')).toHaveLength(3)
  expect(screen.getByAltText('Atlas')).toBeInTheDocument()
})
