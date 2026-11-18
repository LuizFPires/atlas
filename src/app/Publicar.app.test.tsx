import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarPainelFixture } from './ponte-painel'
import { criarCotaFixture } from './ponte-cota'
import { criarPublicarFixture } from './ponte-publicar'
import { OBRA_PARADA_EXEMPLO, criarRetomarFixture } from './ponte-retomar'

const ponte = criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) }))
const api = { pedirCodigo: async () => ({ ok: true as const }), confirmar: async () => ({ ok: true as const, nome: 'Zé' }) }

test('do painel da obra pronta: Publicar o sistema -> escolha (F13a) -> guia (F13b) -> "Não consegui" abre a Ajuda do Atlas', async () => {
  const painel = criarPainelFixture()
  painel.simular.concluirObra()
  const publicar = criarPublicarFixture()
  render(<TemaProvider><AppDesktop ponte={ponte} api={api} painel={painel} cota={criarCotaFixture()} publicar={publicar} retomar={criarRetomarFixture({ ...OBRA_PARADA_EXEMPLO, paradaEm: null })} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar obra' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Publicar o sistema →' }))
  expect(await screen.findByRole('heading', { name: 'Onde o seu sistema vai morar?' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox', { name: /App instalável/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Publicar agora →' }))
  expect(await screen.findByText('PASSO 1 DE 5')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: /Endereço grátis/ })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Não consegui fazer este passo' }))
  expect(await screen.findByRole('heading', { name: 'Vamos resolver juntos' })).toBeInTheDocument()
  expect(screen.getByText(/passo 1 de 5 do guia do Endereço grátis/)).toBeInTheDocument()
})
