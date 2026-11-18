import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { Entrega } from './Entrega'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarPainelFixture } from './ponte-painel'
import { criarCotaFixture } from './ponte-cota'
import { criarPublicarFixture, publicarIndisponivel } from './ponte-publicar'
import { OBRA_PARADA_EXEMPLO, criarRetomarFixture } from './ponte-retomar'
import { caminhoQr, enderecoDoSistema, linkWhatsapp, matrizQr } from './entrega-dados'

const montar = (endereco: string | null, p: Partial<React.ComponentProps<typeof Entrega>> = {}) =>
  render(<TemaProvider><Entrega obra={{ nome: 'Cadeira 1' }} endereco={endereco} resumo={{ etapas: 8, tarefas: 50 }} {...p} /></TemaProvider>)

test('no ar: festa calma, QR local do endereço, link e WhatsApp', () => {
  montar('cadeira1.vercel.app')
  expect(screen.getByRole('heading', { level: 1, name: 'Cadeira 1 está no ar.' })).toBeInTheDocument()
  expect(screen.getByText('Obra entregue')).toBeInTheDocument()
  const qr = screen.getByRole('img', { name: /QR code para abrir o sistema/ })
  expect(qr).toHaveAttribute('data-endereco', 'https://cadeira1.vercel.app')
  expect(qr.querySelector('path')?.getAttribute('d')).toBe(caminhoQr(matrizQr('https://cadeira1.vercel.app')))
  const zap = screen.getByRole('link', { name: 'Mandar para a equipe pelo WhatsApp' })
  expect(zap.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
  expect(decodeURIComponent(zap.getAttribute('href') ?? '')).toContain('https://cadeira1.vercel.app')
  expect(zap).toHaveAttribute('rel', 'noopener noreferrer')
})

test('copiar o link', async () => {
  const u = userEvent.setup()
  montar('cadeira1.vercel.app')
  await u.click(screen.getByRole('button', { name: 'Copiar o link' }))
  expect(await screen.findByText(/Link copiado/)).toBeInTheDocument()
  expect(await navigator.clipboard.readText()).toBe('https://cadeira1.vercel.app')
})

test.each([null, 'javascript:alert(1)', 'https://evil.com', 'https://a.vercel.app.evil.com', 'file:///c:/x', 'https://u:p@a.vercel.app', 'https://a.vercel.app:8443', 'https://a.vercel.app/x?y=1', 'http://127.0.0.1', 'ftp://a.vercel.app'])('sem endereço do sistema (%s): estado honesto, sem QR nem link', (e) => {
  montar(e)
  expect(screen.getByText(/Assim que o sistema estiver no ar, o QR e o link aparecem aqui/)).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: /QR code/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Copiar o link' })).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'Cadeira 1 está pronta.' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('link', { name: /WhatsApp/ })).not.toHaveAttribute('href')
})

test('enderecoDoSistema: só http/https do próprio sistema', () => {
  expect(enderecoDoSistema('cadeira1.vercel.app')).toBe('https://cadeira1.vercel.app')
  expect(enderecoDoSistema('HTTPS://Cadeira1.Vercel.app/')).toBe('https://cadeira1.vercel.app')
  expect(enderecoDoSistema('http://cadeira1.com.br')).toBe('http://cadeira1.com.br')
  expect(enderecoDoSistema('www.cadeira1.com.br')).toBe('https://www.cadeira1.com.br')
  for (const ruim of ['', ' ', 'cadeira1', 'a.vercel.app evil.com', 'https://vercel.app', 'data:text/html,x', 'https://cadeira1.com', `https://${'a'.repeat(70)}.vercel.app`]) expect(enderecoDoSistema(ruim)).toBeNull()
  expect(enderecoDoSistema(undefined)).toBeNull()
})

test('o QR é local: matriz quadrada e determinística; o recado do WhatsApp vai codificado', () => {
  const m = matrizQr('https://cadeira1.vercel.app')
  expect(m.length).toBeGreaterThanOrEqual(21)
  expect(m.every((l) => l.length === m.length)).toBe(true)
  expect(matrizQr('https://cadeira1.vercel.app')).toEqual(m)
  expect(linkWhatsapp('a b&c')).toBe('https://wa.me/?text=a%20b%26c')
})

const ponte = criarPonteFixture([], criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) }))
const api = { pedirCodigo: async () => ({ ok: true as const }), confirmar: async () => ({ ok: true as const, nome: 'Zé' }) }

async function ate(publicar: ReturnType<typeof criarPublicarFixture> | typeof publicarIndisponivel) {
  const painel = criarPainelFixture()
  painel.simular.concluirObra()
  render(<TemaProvider><AppDesktop ponte={ponte} api={api} painel={painel} cota={criarCotaFixture()} publicar={publicar} retomar={criarRetomarFixture({ ...OBRA_PARADA_EXEMPLO, paradaEm: null })} /></TemaProvider>)
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar obra' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Publicar o sistema →' }))
  await userEvent.click(await screen.findByRole('checkbox', { name: /App instalável/ })) // deixa só o endereço grátis
  await userEvent.click(screen.getByRole('button', { name: 'Publicar agora →' }))
}
const clicar = (nome: string) => screen.findByRole('button', { name: nome }).then((b) => userEvent.click(b))

test('fluxo: o Atlas publicou de verdade (M22) -> a entrega mostra o QR do endereço publicado', async () => {
  const pub = criarPublicarFixture()
  await ate(pub)
  await clicar('Continuar →')
  await clicar('Fiz isso →')
  await waitFor(() => expect(pub.publicados).toHaveLength(1))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar →' })).toBeEnabled())
  await clicar('Continuar →')
  await clicar('Fiz isso →')
  await clicar('Ver a entrega das chaves →')
  const qr = await screen.findByRole('img', { name: /QR code para abrir o sistema/ })
  expect(qr).toHaveAttribute('data-endereco', `https://${pub.publicados[0]}.vercel.app`)
  expect(screen.getByText('Obra entregue')).toBeInTheDocument()
})

test('fluxo: sem adaptador (nada foi publicado) a entrega não finge: sem QR, sem link', async () => {
  await ate(publicarIndisponivel)
  expect(await screen.findByText(/Ainda não fiz a vistoria de verdade/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Ver a entrega das chaves →' })).toBeNull()
})
