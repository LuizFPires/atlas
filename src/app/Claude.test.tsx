import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { Claude } from './Claude'
import { criarClaudeFixture, type ClaudeFixture } from './ponte-claude'
import { PASSOS_CLAUDE } from './claude-passos'
import { criarPonteFixture } from './ponte'

const montar = (c: ClaudeFixture = criarClaudeFixture(), p: Partial<React.ComponentProps<typeof Claude>> = {}) => {
  const onContinuar = vi.fn()
  render(<TemaProvider><Claude claude={c} onContinuar={onContinuar} {...p} /></TemaProvider>)
  return { c, onContinuar }
}
const clicar = (nome: string | RegExp) => userEvent.click(screen.getByRole('button', { name: nome }))

test('guia de mão dada: abre o claude.ai, e-mail, código, Authorize, até "Ver meu plano"', async () => {
  const { c } = montar()
  expect(screen.getByText('PASSO 1 DE 6')).toBeInTheDocument()
  expect(screen.getByText(/Clique no botão verde/)).toBeInTheDocument()
  await clicar('Abrir o site →')
  expect(c.abertos).toEqual(['login'])
  expect(screen.getByText(/Escreva na caixinha o e-mail/)).toBeInTheDocument()
  for (const trecho of [/Continue with email\./, /Abra o e-mail, copie o código/, /Clique no botão Authorize/]) {
    await clicar('Fiz isso →')
    expect(screen.getByText(trecho)).toBeInTheDocument()
  }
  await clicar('Fiz isso →')
  expect(screen.getByText('PASSO 6 DE 6')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ver meu plano →' })).toBeInTheDocument()
})

test('cada palavra em inglês vem traduzida', async () => {
  montar()
  expect(screen.queryByText(/quer dizer/)).not.toBeInTheDocument()
  await clicar('Abrir o site →')
  expect(screen.getByText(/quer dizer/)).toHaveTextContent('Enter your email quer dizer "Escreva o seu e-mail"')
  await clicar('Fiz isso →')
  expect(screen.getByText(/quer dizer/)).toHaveTextContent('Continue with email quer dizer "Continuar com o e-mail"')
  await clicar('Fiz isso →')
  expect(screen.getByText(/quer dizer/)).toHaveTextContent('Verify quer dizer "Confirmar"')
  await clicar('Fiz isso →')
  expect(screen.getByText(/quer dizer/)).toHaveTextContent('Authorize quer dizer "Deixar / Permitir"')
  // todo passo com palavra em inglês destacada tem tradução
  for (const p of PASSOS_CLAUDE) expect(Boolean(p.en)).toBe(Boolean(p.pt))
})

test('"Não consegui fazer este passo" abre a ajuda do passo', async () => {
  const onPedirAjuda = vi.fn()
  montar(undefined, { onPedirAjuda })
  expect(screen.queryByText('Tudo bem, acontece com todo mundo.')).not.toBeInTheDocument()
  await clicar('Não consegui fazer este passo')
  expect(screen.getByText('Tudo bem, acontece com todo mundo.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Ver este passo em vídeo/ })).toBeInTheDocument()
  await clicar(/Pedir ajuda ao Atlas/)
  expect(onPedirAjuda).toHaveBeenCalled()
})

test('voltar e "Criar no site do Claude"; sem conexão detectada, avisa com calma', async () => {
  const { c } = montar()
  expect(screen.getByRole('button', { name: '← Voltar' })).toBeDisabled()
  await clicar('Criar no site do Claude ↗')
  expect(c.abertos).toEqual(['criar-conta'])
  await clicar('Abrir o site →')
  await clicar('← Voltar')
  expect(screen.getByText('PASSO 1 DE 6')).toBeInTheDocument()
  for (let i = 0; i < 5; i++) await clicar(/Abrir o site →|Fiz isso →/)
  await clicar('Ver meu plano →')
  expect(screen.getByRole('alert')).toHaveTextContent(/Ainda não vi a conexão/)
})

test('o Atlas nunca pede senha, código nem faz login: só guia (sem campo de texto na tela)', () => {
  montar()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(document.querySelector('input')).toBeNull()
})

test('depois de ativar, o app abre a F03; ao conectar segue', async () => {
  const claude = criarClaudeFixture()
  render(<TemaProvider><AppDesktop ponte={criarPonteFixture(['--tela=F03'])} claude={claude} api={{ pedirCodigo: async () => ({ ok: true }), confirmar: async () => ({ ok: true, nome: 'Zé' }) }} /></TemaProvider>)
  expect(await screen.findByRole('heading', { name: 'O Claude é o construtor.' })).toBeInTheDocument()
})
