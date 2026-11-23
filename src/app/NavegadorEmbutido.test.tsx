// Luiz, 23/11/2026: o site de verdade na metade direita da tela das contas, sem sair do Atlas.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavegadorEmbutido } from './NavegadorEmbutido'
import type { PaginaNavegador, PonteNavegador } from './ponte-navegador'

function falso() {
  let ouvinte: ((p: PaginaNavegador) => void) | null = null
  const n = {
    abrir: vi.fn(async () => {}), posicionar: vi.fn(async () => {}), mostrar: vi.fn(async () => {}), voltar: vi.fn(async () => {}),
    recarregar: vi.fn(async () => {}), fora: vi.fn(async () => {}), fechar: vi.fn(async () => {}),
    aoMudarPagina: vi.fn((f: (p: PaginaNavegador) => void) => { ouvinte = f; return () => { ouvinte = null } }),
  } satisfies PonteNavegador
  return { n, pagina: (p: PaginaNavegador) => ouvinte?.(p) }
}

test('abre o site da conta no espaço da direita e mostra o endereço da página', async () => {
  const { n, pagina } = falso()
  render(<NavegadorEmbutido navegador={n} conta="supabase" />)
  expect(n.abrir).toHaveBeenCalledWith('supabase', expect.objectContaining({ width: expect.any(Number) }))
  act(() => pagina({ conta: 'supabase', url: 'https://supabase.com/dashboard/sign-in', pronta: false }))
  expect(screen.getByText('supabase.com/dashboard/sign-in')).toBeInTheDocument()
})

test('a conta ficou pronta no site: avisa a tela das contas', async () => {
  const { n, pagina } = falso()
  const onPronta = vi.fn()
  render(<NavegadorEmbutido navegador={n} conta="hosp" onPronta={onPronta} />)
  act(() => pagina({ conta: 'hosp', url: 'https://vercel.com/new', pronta: true }))
  expect(onPronta).toHaveBeenCalledWith('hosp')
})

test('voltar, recarregar e abrir no meu navegador', async () => {
  const { n } = falso()
  render(<NavegadorEmbutido navegador={n} conta="github" />)
  await userEvent.click(screen.getByRole('button', { name: 'Voltar a página' }))
  await userEvent.click(screen.getByRole('button', { name: 'Recarregar a página' }))
  await userEvent.click(screen.getByRole('button', { name: /Abrir no meu navegador/ }))
  expect(n.voltar).toHaveBeenCalled()
  expect(n.recarregar).toHaveBeenCalled()
  expect(n.fora).toHaveBeenCalledWith('github')
})

test('uma janela por cima (vídeo, ajuda) esconde o navegador; ao fechar, ele volta', async () => {
  const { n } = falso()
  render(<NavegadorEmbutido navegador={n} conta="github" />)
  const modal = document.createElement('div')
  modal.setAttribute('aria-modal', 'true')
  await act(async () => { document.body.appendChild(modal); await new Promise((ok) => setTimeout(ok, 0)) })
  expect(n.mostrar).toHaveBeenLastCalledWith(false)
  await act(async () => { modal.remove(); await new Promise((ok) => setTimeout(ok, 0)) })
  expect(n.mostrar).toHaveBeenLastCalledWith(true)
})

test('sair da tela das contas fecha o navegador (o login fica guardado)', () => {
  const { n } = falso()
  const r = render(<NavegadorEmbutido navegador={n} conta="github" />)
  r.unmount()
  expect(n.fechar).toHaveBeenCalled()
})
