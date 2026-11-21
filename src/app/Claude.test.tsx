import { render, screen, within } from '@testing-library/react'
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
// A tela abre conferindo se o Claude já está conectado; os botões aparecem logo depois, então o clique espera por eles.
const clicar = async (nome: string | RegExp) => userEvent.click(await screen.findByRole('button', { name: nome }))

test('guia de mão dada: abre o claude.ai, e-mail, código, Authorize, até "Ver meu plano"', async () => {
  const { c } = montar()
  await clicar('Já tenho conta e plano →')
  expect(await screen.findByText('PASSO 1 DE 6')).toBeInTheDocument()
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
  await clicar('Já tenho conta e plano →')
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
  await clicar('Já tenho conta e plano →')
  expect(screen.queryByText('Tudo bem, acontece com todo mundo.')).not.toBeInTheDocument()
  await clicar('Não consegui fazer este passo')
  expect(screen.getByText('Tudo bem, acontece com todo mundo.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Ver este passo em vídeo/ })).toBeInTheDocument()
  await clicar(/Pedir ajuda ao Atlas/)
  expect(onPedirAjuda).toHaveBeenCalled()
})

test('voltar e "Criar no site do Claude"; sem conexão detectada, avisa com calma', async () => {
  const { c } = montar()
  await clicar('Já tenho conta e plano →')
  expect(await screen.findByRole('button', { name: '← Voltar' })).toBeDisabled()
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

// Fixture já conectado: a tela percebe ao abrir e mostra o resultado, sem passar pelos 6 passos.
const conectar = async (c: ClaudeFixture) => {
  render(<TemaProvider><Claude claude={c} onContinuar={() => {}} /></TemaProvider>)
  await screen.findByText(/Conectado!/)
}

test('Claude já conectado neste computador: pula os 6 passos, não abre site nenhum e mostra a conta e o plano', async () => {
  const c = criarClaudeFixture({ conectado: true, conta: 'ana@loja.com', plano: 'max' })
  const { onContinuar } = montar(c)
  expect(await screen.findByText(/Conectado!/)).toHaveTextContent('Conectado! Conta ana@loja.com · plano Max')
  expect(screen.getByText('O Claude já estava conectado neste computador, então pulei os passos.')).toBeInTheDocument()
  expect(screen.queryByText(/PASSO \d DE 6/)).toBeNull()
  expect(c.abertos).toEqual([])
  await clicar(/Continuar/)
  expect(onContinuar).toHaveBeenCalled()
})

test('enquanto confere, a tela diz que está conferindo e não mostra o passo 1 nem o botão de abrir o site', async () => {
  let soltar: (e: { conectado: boolean }) => void = () => {}
  const c = { ...criarClaudeFixture(), estado: () => new Promise<{ conectado: boolean }>((r) => { soltar = r }) }
  render(<TemaProvider><Claude claude={c} onContinuar={() => {}} /></TemaProvider>)
  expect(screen.getByRole('status')).toHaveTextContent('Conferindo se o Claude já está conectado neste computador…')
  expect(screen.queryByRole('button', { name: 'Abrir o site →' })).toBeNull()
  soltar({ conectado: false })
  expect(await screen.findByRole('heading', { name: 'Antes de começar: você precisa de uma conta no Claude.' })).toBeInTheDocument()
})

test('não deu para conferir (erro ao ler o Claude): segue pelo guia de passos, sem travar', async () => {
  const c = { ...criarClaudeFixture(), estado: async () => { throw new Error('claude fora') } }
  render(<TemaProvider><Claude claude={c} onContinuar={() => {}} /></TemaProvider>)
  expect(await screen.findByRole('heading', { name: 'Antes de começar: você precisa de uma conta no Claude.' })).toBeInTheDocument()
})


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
    await screen.findByText(/Conectado!/)
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

// ---- antes de começar: a conta do Claude ------------------------------------------------------------------------------------

test('antes dos passos, o Atlas avisa que precisa de uma conta paga do Claude, à parte do Atlas, e que plano maior anda mais rápido', async () => {
  const { c } = montar()
  expect(await screen.findByRole('heading', { name: 'Antes de começar: você precisa de uma conta no Claude.' })).toBeInTheDocument()
  const aviso = screen.getByRole('note', { name: 'Conta do Claude' })
  expect(aviso).toHaveTextContent('paga direto para a Anthropic, à parte do Atlas')
  expect(aviso).toHaveTextContent('Sem um plano pago do Claude, o Atlas não consegue construir')
  expect(aviso).toHaveTextContent('Quanto maior o plano, mais rápido a obra anda')
  expect(document.body.textContent).not.toMatch(/Pro ou Max/)
  expect(screen.queryByText(/PASSO \d DE 6/)).toBeNull()
  expect(c.abertos).toEqual([]) // nada abre sozinho
})

test('"Já tenho conta e plano" leva aos passos do login', async () => {
  montar()
  await clicar('Já tenho conta e plano →')
  expect(screen.getByText('PASSO 1 DE 6')).toBeInTheDocument()
})

test('"Ainda não tenho": abre o site do Claude, mostra o caminho em três passos e deixa ver os planos', async () => {
  const { c } = montar()
  await clicar('Ainda não tenho')
  expect(c.abertos).toEqual(['criar-conta'])
  const caminho = within(screen.getByRole('list', { name: 'Como criar a sua conta do Claude' })).getAllByRole('listitem')
  expect(caminho.map((li) => li.textContent)).toEqual(['Crie a sua conta no site do Claude, que acabei de abrir.', 'Assine um plano pago lá mesmo.', 'Volte aqui e clique em "Já criei e assinei".'])
  await clicar('Ver os planos no site do Claude ↗')
  expect(c.abertos).toEqual(['criar-conta', 'planos'])
  await clicar('Já criei e assinei →')
  expect(screen.getByText('PASSO 1 DE 6')).toBeInTheDocument()
})

test('não consegui abrir o site do Claude: avisa e mostra o caminho mesmo assim', async () => {
  const c = { ...criarClaudeFixture(), abrirSite: async () => { throw new Error('sem navegador') } }
  render(<TemaProvider><Claude claude={c} onContinuar={() => {}} /></TemaProvider>)
  await clicar('Ainda não tenho')
  expect(await screen.findByRole('alert')).toHaveTextContent('Não consegui abrir o site do Claude agora. Abra o claude.ai no seu navegador.')
  expect(screen.getByRole('list', { name: 'Como criar a sua conta do Claude' })).toBeInTheDocument()
})
