import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { LigarContas } from './LigarContas'
import { criarLigarContasFixture, type LigarContasFixture } from './ponte-ligar-contas'

const montar = (f: LigarContasFixture = criarLigarContasFixture()) => {
  const onContinuar = vi.fn()
  const onVoltar = vi.fn()
  render(<TemaProvider><LigarContas ponte={f} onContinuar={onContinuar} onVoltar={onVoltar} sondagemMs={20} /></TemaProvider>)
  return { f, onContinuar, onVoltar }
}
const espera = (ms = 60) => act(() => new Promise((r) => setTimeout(r, ms)))

test('GitHub: Ligar mostra o código grande e espera; quando a pessoa confirma no site, fica "Ligado como"', async () => {
  const { f } = montar()
  await espera()
  await userEvent.click(screen.getByRole('button', { name: 'Ligar o GitHub' }))
  expect(await screen.findByText('4F2A-9C1B')).toBeInTheDocument()
  expect(screen.getByText(/Esperando você confirmar no site/)).toBeInTheDocument()
  f.confirmar('github')
  expect(await screen.findByText('Ligado como ze-barbearia')).toBeInTheDocument()
})

test('Supabase: a pessoa cola a chave; formato errado explica com calma; certo fica ligado', async () => {
  montar()
  await espera()
  await userEvent.click(screen.getByRole('button', { name: 'Ligar o Supabase' }))
  const campo = screen.getByLabelText('Chave do Supabase')
  await userEvent.type(campo, 'minha-senha')
  await userEvent.click(screen.getByRole('button', { name: 'Pronto' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('começa com sbp_')
  await userEvent.clear(campo)
  await userEvent.type(campo, 'sbp_' + 'a'.repeat(40))
  await userEvent.click(screen.getByRole('button', { name: 'Pronto' }))
  expect(await screen.findByText('Ligado')).toBeInTheDocument()
})

test('Supabase: sem internet na conferência, não diz que a chave é ruim', async () => {
  const f = criarLigarContasFixture()
  f.chaveSupabase = async () => ({ ok: false, motivo: 'sem-internet' })
  montar(f)
  await espera()
  await userEvent.click(screen.getByRole('button', { name: 'Ligar o Supabase' }))
  await userEvent.type(screen.getByLabelText('Chave do Supabase'), 'sbp_' + 'a'.repeat(40))
  await userEvent.click(screen.getByRole('button', { name: 'Pronto' }))
  const aviso = await screen.findByRole('alert')
  expect(aviso).toHaveTextContent('a chave pode estar certa')
  expect(aviso).not.toHaveTextContent('não aceitou')
})

test('o último passo só aparece com as três contas ligadas; antes diz quantas faltam', async () => {
  montar(criarLigarContasFixture(['github', 'supabase']))
  await espera()
  expect(screen.getByText(/Falta 1 conta/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Último passo/ })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Ligar a Vercel' }))
  expect(await screen.findByText('WXKD-TPLM')).toBeInTheDocument()
})

test('tudo já ligado (próximas obras): só confirma e segue', async () => {
  const { onContinuar } = montar(criarLigarContasFixture(['github', 'supabase', 'hosp']))
  await espera()
  await userEvent.click(screen.getByRole('button', { name: 'Tudo ligado · Último passo →' }))
  expect(onContinuar).toHaveBeenCalled()
})

test('se o login falhar, a linha diz e deixa tentar de novo', async () => {
  const { f } = montar()
  await espera()
  await userEvent.click(screen.getByRole('button', { name: 'Ligar o GitHub' }))
  await screen.findByText('4F2A-9C1B')
  f.falhar('github')
  expect(await screen.findByRole('button', { name: 'Tentar de novo o GitHub' })).toBeInTheDocument()
})

test('tela larga: sem moldura e sem os passos da instalação à esquerda', () => {
  const { container } = render(<TemaProvider><LigarContas ponte={criarLigarContasFixture()} onContinuar={() => {}} onVoltar={() => {}} sondagemMs={20} /></TemaProvider>)
  expect(container.querySelector('.at-ativ-fundo')).toBeNull()
  expect(container.querySelector('.at-ativ__lado')).toBeNull()
})
