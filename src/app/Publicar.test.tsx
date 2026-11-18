import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Publicar } from './Publicar'
import { custoTotal, guiasEscolhidos, passosLateral } from './publicar-dados'

const montar = () => {
  const onPublicar = vi.fn()
  render(<TemaProvider><Publicar slug="cadeira1" onPublicar={onPublicar} /></TemaProvider>)
  return { onPublicar }
}
const opcao = (nome: RegExp) => screen.getByRole('checkbox', { name: nome })

test('4 opções em multiescolha; começa com endereço grátis e app instalável marcados', async () => {
  montar()
  expect(screen.getAllByRole('checkbox')).toHaveLength(4)
  expect(opcao(/Endereço grátis/)).toBeChecked()
  expect(opcao(/App instalável/)).toBeChecked()
  expect(opcao(/Seu próprio endereço/)).not.toBeChecked()
  expect(opcao(/App Store e Google Play/)).not.toBeChecked()
  await userEvent.click(opcao(/Seu próprio endereço/))
  await userEvent.click(opcao(/Endereço grátis/))
  expect(opcao(/Seu próprio endereço/)).toBeChecked()
  expect(opcao(/Endereço grátis/)).not.toBeChecked()
  expect(screen.getByText('cadeira1.com.br')).toBeInTheDocument()
})

test('a lista lateral e o custo mudam com o que o cliente marca', async () => {
  montar()
  const lado = within(screen.getByRole('complementary', { name: 'O que vai acontecer' }))
  expect(lado.getByText('Nenhum')).toBeInTheDocument()
  expect(lado.queryByText(/Pagar o domínio/)).toBeNull()
  await userEvent.click(opcao(/Seu próprio endereço/))
  expect(lado.getByText(/Pagar o domínio no Registro.br/)).toBeInTheDocument()
  expect(lado.getByText('~R$ 40/ano')).toBeInTheDocument()
  await userEvent.click(opcao(/App Store e Google Play/))
  expect(lado.getByText(/apertar "Enviar para revisão"/)).toBeInTheDocument()
  expect(lado.getByText('~R$ 40/ano + US$ 99/ano + US$ 25')).toBeInTheDocument()
})

test('passosLateral, custo e guias seguem o protótipo', () => {
  const so = passosLateral({ lojas: true })
  expect(so.map((p) => p.quem)).toEqual(['A', 'V', 'A', 'V', 'A'])
  expect(custoTotal({ gratis: true, pwa: true })).toBe('Nenhum')
  expect(guiasEscolhidos({ dominio: true })).toEqual(['gratis', 'dominio'])
  expect(guiasEscolhidos({ lojas: true, pwa: true })).toEqual(['gratis', 'pwa', 'lojas'])
})

test('"Publicar agora" entrega a seleção; sem nada marcado fica desligado', async () => {
  const { onPublicar } = montar()
  await userEvent.click(screen.getByRole('button', { name: 'Publicar agora →' }))
  expect(onPublicar).toHaveBeenCalledWith({ gratis: true, pwa: true })
  await userEvent.click(opcao(/Endereço grátis/))
  await userEvent.click(opcao(/App instalável/))
  expect(screen.getByRole('button', { name: 'Publicar agora →' })).toBeDisabled()
})
