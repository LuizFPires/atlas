import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Configurador } from './Configurador'
import { corLegivel, normalizarHex } from './personalizacao'

const montar = (onSalvar = vi.fn(async () => ({ ok: true }) as const)) => {
  render(<TemaProvider><Configurador segmento="barbearia" onSalvar={onSalvar} /></TemaProvider>)
  return onSalvar
}

describe('normalizarHex (mesma regra do servidor)', () => {
  test.each([['1e7a46', '#1E7A46'], ['#1E7A46', '#1E7A46'], ['  c6f135 ', '#C6F135']])('aceita %s', (e, s) => expect(normalizarHex(e)).toBe(s))
  test.each(['', '12345', '1234567', 'GGGGGG', '#12', 'verde'])('recusa %j', (e) => expect(normalizarHex(e)).toBeNull())
  test('texto legível: escuro sobre lime, claro sobre azul-marinho', () => {
    expect(corLegivel('#C6F135')).toBe('#141619')
    expect(corLegivel('#0A1F44')).toBe('#FFFFFF')
  })
})

test('renderiza nome com microfone, logo, duas cores com paleta + código e a prévia', () => {
  montar()
  expect(screen.getByLabelText('Nome do negócio')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Falar' })).toBeInTheDocument()
  expect(screen.getByLabelText('Escolher a imagem da logomarca')).toBeInTheDocument()
  expect(screen.getByLabelText('Código da cor Principal')).toHaveValue('C6F135')
  expect(screen.getByLabelText('Código da cor De apoio')).toHaveValue('2A3A12')
  expect(screen.getByRole('group', { name: /Principal/ })).toBeInTheDocument()
  expect(screen.getByText('Prévia ao vivo')).toBeInTheDocument()
})

test('a prévia mostra o nome e a cor digitados ao vivo', async () => {
  montar()
  await userEvent.type(screen.getByLabelText('Nome do negócio'), 'Barbearia do Zé')
  expect(screen.getByTestId('previa-nome')).toHaveTextContent('Barbearia do Zé')
  const campo = screen.getByLabelText('Código da cor Principal')
  await userEvent.clear(campo)
  await userEvent.type(campo, '1e7a46')
  expect(screen.getByTestId('previa-botao')).toHaveStyle({ background: 'rgb(30, 122, 70)' })
  expect(screen.getByTestId('chip-Principal')).toHaveStyle({ background: 'rgb(30, 122, 70)' })
})

test('atalho da paleta preenche o código', async () => {
  montar()
  await userEvent.click(screen.getByRole('button', { name: 'Principal: #38BDF8' }))
  expect(screen.getByLabelText('Código da cor Principal')).toHaveValue('38BDF8')
})

test('código inválido mostra erro inline, não envia e não chama o servidor', async () => {
  const onSalvar = montar()
  await userEvent.type(screen.getByLabelText('Nome do negócio'), 'Zé')
  const campo = screen.getByLabelText('Código da cor Principal')
  await userEvent.clear(campo)
  await userEvent.type(campo, 'ZZZ12')
  expect(await screen.findByText(/Esse código não está certo/)).toBeInTheDocument()
  expect(campo).toHaveAttribute('aria-invalid', 'true')
  await userEvent.click(screen.getByRole('button', { name: /criar o meu app/ }))
  expect(screen.getByText(/Confira a cor principal/)).toBeInTheDocument()
  expect(onSalvar).not.toHaveBeenCalled()
})

test('exige o nome do negócio', async () => {
  const onSalvar = montar()
  await userEvent.click(screen.getByRole('button', { name: /criar o meu app/ }))
  expect(screen.getByText('Diga o nome do seu negócio.')).toBeInTheDocument()
  expect(onSalvar).not.toHaveBeenCalled()
})

test('envia nome e as duas cores em #RRGGBB maiúsculo; erro do servidor aparece', async () => {
  const onSalvar = vi.fn(async () => ({ ok: false, mensagem: 'Muitas alterações seguidas.' }) as const)
  montar(onSalvar as never)
  await userEvent.type(screen.getByLabelText('Nome do negócio'), ' Barbearia do Zé ')
  const apoio = screen.getByLabelText('Código da cor De apoio')
  await userEvent.clear(apoio)
  await userEvent.type(apoio, '#1e2125')
  await userEvent.click(screen.getByRole('button', { name: /criar o meu app/ }))
  await waitFor(() => expect(onSalvar).toHaveBeenCalledWith({ nome_negocio: 'Barbearia do Zé', logo_url: null, cor_principal: '#C6F135', cor_apoio: '#1E2125' }))
  expect(await screen.findByText('Muitas alterações seguidas.')).toBeInTheDocument()
})
