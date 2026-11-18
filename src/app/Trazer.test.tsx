import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { TrazerPrototipo } from './Trazer'
import { RECADO } from './trazer-dados'

const montar = () => {
  const user = userEvent.setup()
  const onVoltar = vi.fn()
  render(<TemaProvider><TrazerPrototipo onVoltar={onVoltar} /></TemaProvider>)
  return { user, onVoltar }
}

test('mostra o recado pronto e o botão copia o texto inteiro', async () => {
  const { user } = montar()
  expect(screen.getByRole('heading', { name: 'Fez o protótipo em outra IA? Traga para cá.' })).toBeInTheDocument()
  expect(screen.getByLabelText('Recado para a outra IA')).toHaveTextContent('prototipo-atlas.zip')
  await user.click(screen.getByRole('button', { name: 'Copiar recado' }))
  expect(await navigator.clipboard.readText()).toBe(RECADO)
  expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument()
})

test('se não der para copiar, avisa com calma e mantém o texto à vista', async () => {
  const { user } = montar()
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('negado'))
  await user.click(screen.getByRole('button', { name: 'Copiar recado' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Não consegui copiar sozinho')
  expect(screen.getByRole('button', { name: 'Copiar recado' })).toBeInTheDocument()
})

test('Voltar leva de volta às obras', async () => {
  const { user, onVoltar } = montar()
  await user.click(screen.getByRole('button', { name: /Voltar/ }))
  expect(onVoltar).toHaveBeenCalledTimes(1)
})
