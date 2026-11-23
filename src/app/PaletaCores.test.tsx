import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { PaletaCores, normalizarHex } from './PaletaCores'

function Caixa({ inicio = [] as string[] }) {
  const [c, setC] = useState<string[]>(inicio)
  return <><PaletaCores cores={c} onChange={setC} /><output aria-label="escolhidas">{c.join(',')}</output></>
}

test('normaliza o código: com ou sem #, 3 ou 6 dígitos, minúsculo', () => {
  expect(normalizarHex('1d3557')).toBe('#1D3557')
  expect(normalizarHex(' #abc ')).toBe('#AABBCC')
  expect(normalizarHex('azul')).toBeNull()
  expect(normalizarHex('#12345')).toBeNull()
})

test('tocar numa cor da paleta preenche a próxima vaga, até 3', async () => {
  render(<Caixa />)
  const sugestoes = screen.getAllByRole('button', { name: /^Usar a cor / })
  expect(sugestoes.length).toBeGreaterThanOrEqual(12)
  for (let i = 0; i < 4; i++) await userEvent.click(sugestoes[i])
  expect(screen.getByLabelText('escolhidas').textContent!.split(',')).toHaveLength(3)
  expect(sugestoes[4]).toBeDisabled()
})

test('dá para digitar o código; código errado não entra e mostra um recado', async () => {
  render(<Caixa />)
  const campo = screen.getByRole('textbox', { name: 'Código da cor 1' })
  await userEvent.type(campo, '1d3557{enter}')
  expect(screen.getByLabelText('escolhidas')).toHaveTextContent('#1D3557')
  const campo2 = screen.getByRole('textbox', { name: 'Código da cor 2' })
  await userEvent.type(campo2, 'azul{enter}')
  expect(screen.getByText(/não parece uma cor/)).toBeInTheDocument()
  expect(screen.getByLabelText('escolhidas').textContent).toBe('#1D3557')
})

test('tirar uma cor libera a vaga', async () => {
  render(<Caixa inicio={['#111111', '#222222']} />)
  await userEvent.click(screen.getByRole('button', { name: 'Tirar a cor #111111' }))
  expect(screen.getByLabelText('escolhidas').textContent).toBe('#222222')
})
