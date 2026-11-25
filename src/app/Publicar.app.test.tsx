import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarPainelFixture } from './ponte-painel'
import { criarCotaFixture } from './ponte-cota'
import { criarPublicarFixture } from './ponte-publicar'
import { PASSOS_NO_AR, criarNoArFixture, noArIndisponivel, type EstadoNoAr, type PonteNoAr } from './ponte-no-ar'
import { criarAjudaFixture } from './ponte-ajuda'
import { OBRA_PARADA_EXEMPLO, criarRetomarFixture } from './ponte-retomar'

const ponte = criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) }))
const api = { pedirCodigo: async () => ({ ok: true as const }), confirmar: async () => ({ ok: true as const, nome: 'Zé' }) }

async function ate(noAr: PonteNoAr) {
  const painel = criarPainelFixture()
  painel.simular.concluirObra()
  render(<TemaProvider><AppDesktop ponte={ponte} api={api} painel={painel} cota={criarCotaFixture()} publicar={criarPublicarFixture()} noAr={noAr} ajuda={criarAjudaFixture()} retomar={criarRetomarFixture({ ...OBRA_PARADA_EXEMPLO, paradaEm: null })} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar obra' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Publicar o sistema →' }))
}

test('do painel da obra pronta: Publicar o sistema -> um clique -> no ar com QR do endereço publicado', { timeout: 15000 }, async () => {
  await ate(criarNoArFixture({ passoMs: 5 }))
  expect(await screen.findByText('Agora é colocar no ar para a sua equipe usar.')).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  const qr = await screen.findByRole('img', { name: /QR code para abrir o sistema/ }, { timeout: 6000 })
  expect(qr.getAttribute('data-endereco')).toMatch(/^https:\/\/[a-z0-9-]+\.vercel\.app$/)
})

test('sem adaptador: não finge que publicou (sem QR, botão desligado)', async () => {
  await ate(noArIndisponivel)
  expect(await screen.findByRole('button', { name: 'Colocar no ar →' })).toBeDisabled()
  expect(screen.queryByRole('img', { name: /QR code/ })).toBeNull()
})

test('erro ao colocar no ar: a Ajuda do Atlas abre sozinha, sabendo onde parou', async () => {
  const erro: EstadoNoAr = { fase: 'erro', nome: 'ponto', passos: PASSOS_NO_AR.map((p) => ({ id: p.id, estado: p.id === 'publicar' ? 'erro' : p.id === 'vistoria' || p.id === 'banco' ? 'feito' : 'falta' })), achados: [], endereco: null, erro: { passo: 'publicar', motivo: 'vercel-deploy' }, avisos: [] }
  await ate({ ...criarNoArFixture(), estado: async () => erro })
  expect(await screen.findByRole('complementary', { name: 'Ajuda do Atlas' })).toBeInTheDocument()
})

test('no ar: "Usar meu domínio" segue para o guia do domínio', { timeout: 15000 }, async () => {
  await ate(criarNoArFixture({ passoMs: 5 }))
  await userEvent.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  await userEvent.click(await screen.findByRole('button', { name: /Usar meu domínio/ }, { timeout: 6000 }))
  expect(await screen.findByRole('heading', { level: 1, name: /Seu próprio endereço/ })).toBeInTheDocument()
})
