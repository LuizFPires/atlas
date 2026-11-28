import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/react'
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

/** Aba "Usar o sistema": cada item de "Abrir para clientes" é um guia que se abre; o botão do Atlas fica dentro dele. */
async function peloAtlas(titulo: RegExp) {
  const tit = await screen.findByText(titulo, { selector: 'b' }, { timeout: 6000 })
  const guia = tit.closest('details') as HTMLElement
  await userEvent.click(within(guia).getByRole('button', { name: /pelo Atlas/ }))
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

test('no ar: "Usar meu domínio" abre o domínio próprio ao lado do prédio (M57)', { timeout: 15000 }, async () => {
  await ate(criarNoArFixture({ passoMs: 5 }))
  await userEvent.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  await peloAtlas(/^Usar meu domínio$/)
  expect(await screen.findByRole('textbox', { name: 'Seu domínio' })).toBeInTheDocument()
})

test('domínio próprio → passo a passo do Registro.br com o servidor para copiar e o "Falar com o Atlas" (M58)', { timeout: 15000 }, async () => {
  await ate(criarNoArFixture({ passoMs: 5 }))
  await userEvent.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  await peloAtlas(/^Usar meu domínio$/)
  await userEvent.type(await screen.findByRole('textbox', { name: 'Seu domínio' }), 'pontoampla.com.br')
  await userEvent.click(screen.getByRole('button', { name: /Conferir e ligar/ }))
  await userEvent.click(await screen.findByRole('button', { name: /passo a passo/ }))
  expect(await screen.findByText('PASSO 1 DE 7')).toBeInTheDocument()
  expect(screen.getByText('USAR MEU DOMÍNIO NO REGISTRO.BR')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '← VOLTAR' }))
  expect(await screen.findByText(/A SUA PARTE/)).toBeInTheDocument()
})

test('lojas (M59): pergunta, passo a passo da Apple e a conta fica marcada ao terminar', { timeout: 20000 }, async () => {
  await ate(criarNoArFixture({ passoMs: 5 }))
  await userEvent.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  await peloAtlas(/^App Store e Google Play$/)
  await userEvent.click(await screen.findByRole('button', { name: 'Seguir →' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Passo a passo: Conta da Apple' }))
  expect(await screen.findByText('PASSO 1 DE 6')).toBeInTheDocument()
  for (let i = 0; i < 5; i++) await userEvent.click(screen.getByRole('button', { name: 'Fiz, próximo →' }))
  await userEvent.click(screen.getByRole('button', { name: 'Pronto, paguei →' }))
  expect(await screen.findByLabelText('Conta da Apple (App Store): pronta')).toBeInTheDocument()
})

test('lançamento (M60): da obra no ar para "Lançamentos", começar, escolher o Asaas e a obra aparece na lista', { timeout: 20000 }, async () => {
  await ate(criarNoArFixture({ passoMs: 5 }))
  await userEvent.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  await peloAtlas(/^Vender o .* para outras empresas$/)
  await userEvent.click(await screen.findByRole('button', { name: 'Começar o lançamento →' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Escolher o Asaas →' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Já criei a conta' }))
  expect(await screen.findByText(/PRONTO PARA A PÁGINA DE VENDAS/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Lançamentos' }))
  expect(await screen.findByText('MONTANDO O STAND')).toBeInTheDocument()
})
