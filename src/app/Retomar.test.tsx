import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { Retomar } from './Retomar'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarPainelFixture } from './ponte-painel'
import { criarCotaFixture } from './ponte-cota'
import { OBRA_PARADA_EXEMPLO, criarRetomarFixture, type PonteRetomar } from './ponte-retomar'

const ativado = (argv: string[] = []) => criarPonteFixture(argv, criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'a@b.co', nome: 'Zé' }) }))
const api = { pedirCodigo: async () => ({ ok: true as const }), confirmar: async () => ({ ok: true as const, nome: 'Zé' }) }
const parada = { ...OBRA_PARADA_EXEMPLO, paradaEm: new Date(2026, 10, 17, 22, 14).toISOString() }

const abrir = (retomar: PonteRetomar, ponte = ativado(), painel = criarPainelFixture()) => {
  render(<TemaProvider><AppDesktop ponte={ponte} api={api} painel={painel} retomar={retomar} cota={criarCotaFixture()} /></TemaProvider>)
  return painel
}

test('ativado com obra em andamento: o Atlas abre em Retomar (F12), não em Minhas obras', async () => {
  abrir(criarRetomarFixture(parada))
  expect(await screen.findByRole('button', { name: 'Continuar obra' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Tudo pronto/ })).toBeNull()
})

test('ativado sem obra em andamento: abre em Minhas obras (F05)', async () => {
  abrir(criarRetomarFixture(null))
  expect(await screen.findByRole('heading', { name: /Tudo pronto, Zé/ })).toBeInTheDocument()
})

test('--tela=F12 sem obra em andamento cai em Minhas obras (nada para retomar)', async () => {
  abrir(criarRetomarFixture(null), ativado(['--tela=F12']))
  expect(await screen.findByRole('heading', { name: /Tudo pronto, Zé/ })).toBeInTheDocument()
})

test('não ativado: ativação primeiro, mesmo com obra em andamento', async () => {
  abrir(criarRetomarFixture(parada), criarPonteFixture())
  expect(await screen.findByRole('heading', { name: /Vamos ativar/ })).toBeInTheDocument()
})

test('Continuar obra: 1 clique religa a linha e chega ao painel da obra', async () => {
  const painel = criarPainelFixture()
  const retomar = criarRetomarFixture(parada, { painel })
  abrir(retomar, ativado(), painel)
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar obra' }))
  await waitFor(() => expect(retomar.chamadas).toContain(`continuar:${parada.pasta}`))
  // Chegou ao painel da obra (F09) com a obra certa: dois cliques no máximo (aqui, um).
  expect(await screen.findByRole('heading', { level: 1, name: parada.nome })).toBeInTheDocument()
  expect(await screen.findByRole('region', { name: 'Avanço da obra' })).toBeInTheDocument()
  expect(painel.chamadas).toContain('continuar')
})

test('Continuar obra religa a linha pelas portas do painel (tira a pausa)', async () => {
  const painel = criarPainelFixture()
  await painel.pausar(parada.pasta)
  const retomar = criarRetomarFixture(parada, { painel })
  render(<TemaProvider><Retomar obra={parada} nome="Zé" retomar={retomar} onContinuou={() => {}} onAgoraNao={() => {}} /></TemaProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Continuar obra' }))
  await waitFor(() => expect(painel.chamadas).toContain('continuar'))
  expect((await painel.ler(parada.pasta)).pausadaPorVoce).toBe(false)
})

test('"Agora não" vai a Minhas obras sem religar nada', async () => {
  const retomar = criarRetomarFixture(parada)
  abrir(retomar)
  await userEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
  expect(await screen.findByRole('heading', { name: /Tudo pronto, Zé/ })).toBeInTheDocument()
  expect(retomar.chamadas.some((c) => c.startsWith('continuar'))).toBe(false)
})

test('se religar falhar, a tela fica, avisa com calma e deixa tentar de novo', async () => {
  const onContinuou = vi.fn()
  let vez = 0
  const retomar: PonteRetomar = { obraEmAndamento: async () => parada, continuar: async () => { if (vez++ === 0) throw new Error('x') } }
  render(<TemaProvider><Retomar obra={parada} retomar={retomar} onContinuou={onContinuou} onAgoraNao={() => {}} /></TemaProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Continuar obra' }))
  expect(await screen.findByRole('status')).toHaveTextContent(/Sem pressa/)
  expect(onContinuou).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Continuar obra' }))
  await waitFor(() => expect(onContinuou).toHaveBeenCalledTimes(1))
})

test('mostra quando parou, a obra, o progresso e o aviso do auto-início', () => {
  render(<TemaProvider><Retomar obra={parada} nome="Zé" retomar={criarRetomarFixture(parada)} onContinuou={() => {}} onAgoraNao={() => {}} agora={() => new Date(2026, 10, 18, 8, 0)} /></TemaProvider>)
  expect(screen.getByText('BOM DIA, ZÉ')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sua obra parou ontem às 22h14, quando o computador foi desligado.')
  expect(screen.getByText(/Agenda da Barbearia do Zé/).parentElement).toHaveTextContent('62% · M5 Confirmação por WhatsApp')
  expect(screen.getByText(/Para desligar isso: Configurações → Abrir com o Windows\./)).toBeInTheDocument()
})

test('duas obras paradas: o aviso diz quantas, lista as duas e "Continuar todas" religa cada uma', async () => {
  const outra = { nome: 'Estoque da Loja', pasta: 'estoque-da-loja', pct: 41, etapa: null, paradaEm: parada.paradaEm }
  const painel = criarPainelFixture()
  const base = criarRetomarFixture(parada, { painel })
  const retomar: PonteRetomar = { ...base, paradas: async () => [parada, outra] }
  abrir(retomar, ativado(), painel)
  expect(await screen.findByRole('heading', { name: /Suas 2 obras pararam/ })).toBeInTheDocument()
  expect(screen.getByText('Estoque da Loja')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Continuar todas' }))
  await waitFor(() => expect(base.chamadas).toEqual(expect.arrayContaining([`continuar:${parada.pasta}`, `continuar:${outra.pasta}`])))
  expect(await screen.findByRole('heading', { level: 1, name: parada.nome })).toBeInTheDocument()
})
