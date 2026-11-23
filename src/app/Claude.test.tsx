import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { Claude } from './Claude'
import { criarClaudeFixture, type ClaudeFixture } from './ponte-claude'
import { criarPonteFixture } from './ponte'

const montar = (c: ClaudeFixture = criarClaudeFixture(), p: Partial<React.ComponentProps<typeof Claude>> = {}) => {
  const onContinuar = vi.fn()
  render(<TemaProvider><Claude claude={c} onContinuar={onContinuar} {...p} /></TemaProvider>)
  return { c, onContinuar }
}
// A tela abre conferindo se o Claude já está conectado; os botões aparecem logo depois, então o clique espera por eles.
const clicar = async (nome: string | RegExp) => userEvent.click(await screen.findByRole('button', { name: nome }))

// Um clique: o Atlas chama o login OFICIAL do Claude Code; o Chrome (já logado) só pede "Autorizar"; o Atlas percebe sozinho.
test('um botão só: "Conectar o Claude" chama o login do Claude Code e o Atlas percebe a conexão sozinho', async () => {
  const { c } = montar(undefined, { esperaMs: 20 })
  await clicar('Já tenho conta e plano →')
  expect(await screen.findByText(/Clique em Autorizar/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Fiz isso/ })).toBeNull()
  await clicar('Conectar o Claude')
  expect(c.abertos).toEqual(['login'])
  expect(await screen.findByRole('status')).toHaveTextContent(/Esperando você clicar em Autorizar/)
  c.simularLogin('rmenezesgt@gmail.com', 'pro')
  expect(await screen.findByText(/Conectado!/)).toBeInTheDocument()
  expect(screen.getByText('rmenezesgt@gmail.com')).toBeInTheDocument()
})

test('a palavra em inglês da página do Claude vem traduzida', async () => {
  montar()
  await clicar('Já tenho conta e plano →')
  expect(await screen.findByText(/quer dizer/)).toHaveTextContent('Authorize quer dizer "Autorizar"')
})

test('não abriu o login do Claude: avisa com calma e deixa tentar de novo ou pedir ajuda', async () => {
  const onPedirAjuda = vi.fn()
  const c = { ...criarClaudeFixture(), abrirLogin: async () => { throw new Error('claude-nao-instalado') } }
  render(<TemaProvider><Claude claude={c} onContinuar={() => {}} onPedirAjuda={onPedirAjuda} /></TemaProvider>)
  await clicar('Já tenho conta e plano →')
  await clicar('Conectar o Claude')
  expect(await screen.findByRole('alert')).toHaveTextContent(/Não consegui abrir o Claude agora/)
  expect(screen.getByRole('button', { name: 'Conectar o Claude' })).toBeEnabled()
  await clicar('Não consegui fazer este passo')
  await clicar(/Pedir ajuda ao Atlas/)
  expect(onPedirAjuda).toHaveBeenCalled()
})

test('esperando a autorização: dá para abrir de novo e criar a conta no site do Claude', async () => {
  const { c } = montar(undefined, { esperaMs: 50 })
  await clicar('Já tenho conta e plano →')
  await clicar('Conectar o Claude')
  await clicar('Abrir de novo')
  expect(c.abertos).toEqual(['login', 'login'])
  await clicar('Criar no site do Claude ↗')
  expect(c.abertos).toEqual(['login', 'login', 'criar-conta'])
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

test('"Já tenho conta e plano" leva ao botão de conectar', async () => {
  montar()
  await clicar('Já tenho conta e plano →')
  expect(screen.getByRole('button', { name: 'Conectar o Claude' })).toBeInTheDocument()
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
  expect(screen.getByRole('button', { name: 'Conectar o Claude' })).toBeInTheDocument()
})

test('não consegui abrir o site do Claude: avisa e mostra o caminho mesmo assim', async () => {
  const c = { ...criarClaudeFixture(), abrirSite: async () => { throw new Error('sem navegador') } }
  render(<TemaProvider><Claude claude={c} onContinuar={() => {}} /></TemaProvider>)
  await clicar('Ainda não tenho')
  expect(await screen.findByRole('alert')).toHaveTextContent('Não consegui abrir o site do Claude agora. Abra o claude.ai no seu navegador.')
  expect(screen.getByRole('list', { name: 'Como criar a sua conta do Claude' })).toBeInTheDocument()
})

test('"Ver este passo em vídeo" abre o vídeo do passo a passo dentro do Atlas', async () => {
  montar()
  await clicar('Já tenho conta e plano →')
  await clicar('Não consegui fazer este passo')
  await clicar(/Ver este passo em vídeo/)
  const dialogo = await screen.findByRole('dialog', { name: 'Conectar o Claude em vídeo' })
  const video = dialogo.querySelector('video')
  expect(video).not.toBeNull()
  expect(video!.getAttribute('src')).toMatch(/video-conectar-claude/)
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Fechar o vídeo' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
