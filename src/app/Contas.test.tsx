import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Contas } from './Contas'
import { criarContasFixture, type ContasFixture } from './ponte-contas'

const montar = (c: ContasFixture = criarContasFixture(), p: Partial<React.ComponentProps<typeof Contas>> = {}) => {
  const onContinuar = vi.fn()
  render(<TemaProvider><Contas contas={c} onContinuar={onContinuar} {...p} /></TemaProvider>)
  return { c, onContinuar }
}
const clicar = (nome: string | RegExp) => userEvent.click(screen.getByRole('button', { name: nome }))

test('uma conta por vez, um passo por vez: GitHub, Supabase e Vercel', async () => {
  const { c, onContinuar } = montar()
  expect(screen.getByText('CONTA 1 DE 4 · GITHUB')).toBeInTheDocument()
  expect(screen.getByText('PASSO 1 DE 5')).toBeInTheDocument()
  await clicar('Abrir o site →')
  expect(c.abertos).toEqual(['github'])
  for (let i = 0; i < 3; i++) await clicar('Fiz isso →')
  expect(screen.getByText('PASSO 5 DE 5')).toBeInTheDocument()
  await clicar('Próxima conta →')
  expect(screen.getByText('CONTA 2 DE 4 · SUPABASE')).toBeInTheDocument()
  expect(screen.getByText('PASSO 1 DE 4')).toBeInTheDocument()
  await clicar('Abrir o site →')
  await clicar('Fiz isso →'); await clicar('Fiz isso →')
  await clicar('Próxima conta →')
  expect(screen.getByText('CONTA 3 DE 4 · HOSPEDAGEM')).toBeInTheDocument()
  await clicar('Abrir o site →')
  await clicar('Fiz isso →'); await clicar('Fiz isso →')
  expect(screen.queryByRole('button', { name: 'Próxima conta →' })).not.toBeInTheDocument()
  await clicar('Último passo →')
  expect(onContinuar).toHaveBeenCalled()
  expect(c.abertos).toEqual(['github', 'supabase', 'hosp'])
})

test('voltar, abas e pagamentos opcionais', async () => {
  const { onContinuar } = montar()
  await clicar('Abrir o site →')
  await clicar('← Voltar')
  expect(screen.getByText('PASSO 1 DE 5')).toBeInTheDocument()
  await clicar(/Pagamentos/)
  expect(screen.getByText('Você não precisa fazer isso agora.')).toBeInTheDocument()
  await clicar('Último passo →')
  expect(onContinuar).toHaveBeenCalled()
})

test('se o site não abre, avisa com calma e deixa seguir', async () => {
  const c = criarContasFixture()
  c.abrirSite = async () => { throw new Error('x') }
  montar(c)
  await clicar('Abrir o site →')
  expect(screen.getByRole('alert')).toHaveTextContent(/Não consegui abrir o site do GitHub/)
  expect(screen.getByText('PASSO 2 DE 5')).toBeInTheDocument()
})

test('o Atlas percebe sozinho quando a conta ficou pronta e pula para o "Pronto!"', async () => {
  const c = criarContasFixture()
  montar(c, { sondagemMs: 10 })
  await clicar('Abrir o site →')
  expect(screen.getByText('PASSO 2 DE 5')).toBeInTheDocument()
  c.simularPronta('github')
  expect(await screen.findByText('PASSO 5 DE 5')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('está pronta')
  expect(screen.getByText(/Pronto! O Atlas já viu/)).toBeInTheDocument()
  await clicar('Próxima conta →')
  expect(screen.getByText('CONTA 2 DE 4 · SUPABASE')).toBeInTheDocument()
})

test('ao abrir, retoma da primeira conta que ainda não está pronta', async () => {
  montar(criarContasFixture(['github']), { sondagemMs: 10 })
  expect(await screen.findByText('CONTA 2 DE 4 · SUPABASE')).toBeInTheDocument()
})

test('sem detecção (adaptador indisponível) nada é dado como pronto', async () => {
  const c = criarContasFixture()
  c.pronta = async () => { throw new Error('x') }
  montar(c, { sondagemMs: 10 })
  await new Promise((r) => setTimeout(r, 60))
  expect(screen.getByText('CONTA 1 DE 4 · GITHUB')).toBeInTheDocument()
  expect(screen.getByText('PASSO 1 DE 5')).toBeInTheDocument()
})

test('"Não consegui" abre a ajuda do passo e leva o print do passo à Ajuda do Atlas', async () => {
  const onPedirAjuda = vi.fn()
  montar(undefined, { onPedirAjuda })
  expect(screen.queryByText('Tudo bem, acontece com todo mundo.')).not.toBeInTheDocument()
  await clicar('Abrir o site →')
  await clicar('Não consegui fazer este passo')
  expect(screen.getByText('Tudo bem, acontece com todo mundo.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Ver este passo em vídeo/ })).toBeInTheDocument()
  await clicar(/Pedir ajuda ao Atlas/)
  expect(onPedirAjuda).toHaveBeenCalledWith({ origem: 'F04', conta: 'GitHub', passo: 2, totalPassos: 5, print: { url: 'github.com/signup', titulo: 'Welcome to GitHub!', botaoCerto: 'seu e-mail' } })
})
