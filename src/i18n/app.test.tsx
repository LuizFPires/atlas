import { render, screen } from '@testing-library/react'
import { idiomaAntesDeAtivar, ProvedorIdioma, useTextos } from './app'

test('antes de ativar: português, salvo ?idioma=en (o idioma do computador não decide)', () => {
  expect(idiomaAntesDeAtivar('?idioma=en')).toBe('en')
  expect(idiomaAntesDeAtivar('')).toBe('pt')
  expect(idiomaAntesDeAtivar('?idioma=xx')).toBe('pt')
})

test('useTextos escolhe o dicionário do idioma do provedor (sem provedor: português)', () => {
  const Oi = () => <span>{useTextos({ pt: 'Olá', en: 'Hi' })}</span>
  const { rerender } = render(<Oi />)
  expect(screen.getByText('Olá')).toBeInTheDocument()
  rerender(<ProvedorIdioma value="en"><Oi /></ProvedorIdioma>)
  expect(screen.getByText('Hi')).toBeInTheDocument()
})
