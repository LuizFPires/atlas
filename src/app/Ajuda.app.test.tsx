import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarPainelFixture } from './ponte-painel'
import { criarCotaFixture } from './ponte-cota'
import { criarPublicarFixture } from './ponte-publicar'
import { criarAjudaFixture } from './ponte-ajuda'
import { OBRA_PARADA_EXEMPLO, criarRetomarFixture } from './ponte-retomar'
import { definirEstadoVoz } from '../ui/voz-motor'

const ponte = () => criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) }))
const api = { pedirCodigo: async () => ({ ok: true as const }), confirmar: async () => ({ ok: true as const, nome: 'Zé' }) }

test('pelo botão "Falar com o Atlas": abre o painel por cima da tela e fecha no ×', async () => {
  render(<TemaProvider><AppDesktop ponte={ponte()} api={api} ajuda={criarAjudaFixture()} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('button', { name: /Falar com o Atlas/ }))
  expect(await screen.findByRole('complementary', { name: 'Ajuda do Atlas' })).toBeInTheDocument()
  expect(screen.getByText(/Estou aqui, a qualquer hora/)).toBeInTheDocument()
  expect(screen.getByText('Canteiro de obras')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Fechar a Ajuda' }))
  expect(screen.queryByRole('complementary', { name: 'Ajuda do Atlas' })).not.toBeInTheDocument()
})

test('erro ao publicar: a Ajuda abre SOZINHA com o print e o registro do passo', async () => {
  const painel = criarPainelFixture()
  painel.simular.concluirObra()
  const publicar = criarPublicarFixture()
  publicar.simular.falharPublicacao(true)
  render(<TemaProvider><AppDesktop ponte={ponte()} api={api} painel={painel} cota={criarCotaFixture()} publicar={publicar} ajuda={criarAjudaFixture()} retomar={criarRetomarFixture({ ...OBRA_PARADA_EXEMPLO, paradaEm: null })} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar obra' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Publicar o sistema →' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Publicar agora →' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar →' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Fiz isso →' }))
  expect(await screen.findByRole('complementary', { name: 'Ajuda do Atlas' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado ao publicar.'))
  expect(screen.getByText(/Vi que a publicação parou\. Já tirei um print da sua tela/)).toBeInTheDocument()
  expect(screen.getByLabelText('Print da tela')).toBeInTheDocument()
})

test('D1: com a Ajuda aberta, o aviso da voz aparece só dentro da gaveta (nunca dois)', async () => {
  render(<TemaProvider><AppDesktop ponte={ponte()} api={api} ajuda={criarAjudaFixture()} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('button', { name: /Falar com o Atlas/ }))
  const gaveta = await screen.findByRole('complementary', { name: 'Ajuda do Atlas' })
  act(() => definirEstadoVoz({ fase: 'escrevendo' }))
  expect(screen.getAllByText(/Escrevendo o que você falou/)).toHaveLength(1)
  expect(gaveta).toHaveTextContent(/Escrevendo o que você falou/)
  act(() => definirEstadoVoz({ fase: 'livre' }))
})
