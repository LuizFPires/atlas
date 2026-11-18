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
