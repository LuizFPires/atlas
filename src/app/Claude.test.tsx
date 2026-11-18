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

const conectar = async (c: ClaudeFixture) => {
  render(<TemaProvider><Claude claude={c} onContinuar={() => {}} /></TemaProvider>)
  for (let i = 0; i < 5; i++) await clicar(/Abrir o site →|Fiz isso →/)
  await clicar('Ver meu plano →')
}

test('ao conectar no Pro: mostra conta, plano e explica em dias de obra, com o convite para o site do Claude', async () => {
  const c = criarClaudeFixture({ conectado: true, conta: 'ze@barbeariadoze.com.br', plano: 'pro' })
  await conectar(c)
  expect(screen.getByText(/Conectado!/)).toHaveTextContent('Conectado! Conta ze@barbeariadoze.com.br · plano Pro')
  expect(screen.getByText('COMO O ATLAS VAI TRABALHAR NO SEU PLANO PRO')).toBeInTheDocument()
  expect(screen.getByText(/As obras ficam prontas, com pausas/)).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/token/i)
  await clicar('Ver os planos no site do Claude ↗')
  expect(c.abertos).toContain('planos')
  expect(screen.queryByRole('button', { name: /escolher|assinar|trocar de plano/i })).not.toBeInTheDocument()
})

test('ao conectar no Max: explica o Max e não oferece upgrade', async () => {
  await conectar(criarClaudeFixture({ conectado: true, conta: 'a@b.com', plano: 'max' }))
  expect(screen.getByText('COMO O ATLAS VAI TRABALHAR NO SEU PLANO MAX')).toBeInTheDocument()
  expect(screen.queryByText('Quer obras mais rápidas?')).not.toBeInTheDocument()
})

test('plano ainda não detectado: avisa com calma, sem escolher nada', async () => {
  await conectar(criarClaudeFixture({ conectado: true, conta: 'a@b.com' }))
  expect(screen.getByText(/Ainda não consegui ver qual é o seu plano/)).toBeInTheDocument()
})

test('reconhece o upgrade sozinho (polling leve), sem o cliente clicar em nada', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    const c = criarClaudeFixture({ conectado: true, conta: 'a@b.com', plano: 'pro' })
    render(<TemaProvider><Claude claude={c} onContinuar={() => {}} sondagemMs={1000} /></TemaProvider>)
    for (let i = 0; i < 5; i++) await clicar(/Abrir o site →|Fiz isso →/)
    await clicar('Ver meu plano →')
    expect(screen.getByText('COMO O ATLAS VAI TRABALHAR NO SEU PLANO PRO')).toBeInTheDocument()
    c.simularUpgrade('max')
    await vi.advanceTimersByTimeAsync(1100)
    expect(await screen.findByText(/Percebi a troca! Agora você está no plano Max/)).toBeInTheDocument()
    expect(screen.getByText('COMO O ATLAS VAI TRABALHAR NO SEU PLANO MAX')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Já fiz o upgrade' })).not.toBeInTheDocument()
  } finally { vi.useRealTimers() }
})

test('"Já fiz o upgrade" (1 clique) renova a conexão quando o Claude Code só reflete depois', async () => {
  const c = criarClaudeFixture({ conectado: true, conta: 'a@b.com', plano: 'pro' })
  await conectar(c)
  await clicar('Já fiz o upgrade')
  expect(await screen.findByText(/Ainda vejo o plano Pro/)).toBeInTheDocument()
  c.simularUpgrade('max', true)
  await clicar('Já fiz o upgrade')
  expect(await screen.findByText(/Percebi a troca! Agora você está no plano Max/)).toBeInTheDocument()
  expect(screen.getByText('COMO O ATLAS VAI TRABALHAR NO SEU PLANO MAX')).toBeInTheDocument()
})
