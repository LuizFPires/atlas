// Caminho novo (Luiz, 23/11/2026): faixa com as 6 etapas no topo e o aviso do protótipo em segundo plano, que leva às telas.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EtapasObra } from './EtapasObra'

test('mostra as 6 etapas, marca a atual e as anteriores como feitas', () => {
  render(<EtapasObra atual="batismo" />)
  const itens = screen.getAllByRole('listitem')
  expect(itens.map((i) => i.textContent)).toEqual(['1 · A ideia', '2 · O visual', '3 · O nome', '4 · O protótipo', '5 · As contas', '6 · Começar'])
  expect(itens[1]).toHaveAttribute('data-estado', 'feito')
  expect(itens[2]).toHaveAttribute('aria-current', 'step')
  expect(itens[3]).toHaveAttribute('data-estado', 'depois')
})

test('com o protótipo em segundo plano: aviso com o andamento; clicar leva às telas', async () => {
  const onVerTelas = vi.fn()
  const progresso = vi.fn(async () => ({ fase: 'pintando' as const, mapa: Array.from({ length: 14 }, (_, i) => ({ id: `t${i}`, nome: 'T' })), telas: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, nome: 'T', html: '' })) }))
  render(<EtapasObra atual="batismo" progresso={progresso} onVerTelas={onVerTelas} intervaloMs={20} />)
  const aviso = await screen.findByRole('button', { name: /Protótipo: pintando 6 de 14/ })
  await userEvent.click(aviso)
  expect(onVerTelas).toHaveBeenCalled()
})

test('mapa sendo montado e mapa pronto têm o seu próprio recado; sem nada em andamento, o aviso some', async () => {
  let r: { fase: 'mapeando' | 'mapa'; mapa: { id: string; nome: string }[]; telas: never[] } | null = { fase: 'mapeando', mapa: [], telas: [] }
  render(<EtapasObra atual="estilo" progresso={async () => r} onVerTelas={() => {}} intervaloMs={20} />)
  expect(await screen.findByRole('button', { name: /Protótipo: montando o mapa de telas/ })).toBeInTheDocument()
  r = { fase: 'mapa', mapa: [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }], telas: [] }
  expect(await screen.findByRole('button', { name: /Protótipo: mapa pronto · 2 telas/ })).toBeInTheDocument()
  r = null
  await act(async () => { await new Promise((ok) => setTimeout(ok, 60)) })
  expect(screen.queryByRole('button', { name: /Protótipo:/ })).toBeNull()
})

// Luiz, 23/11/2026: "o usuário tem que poder navegar entre etapas".
describe('navegar entre as etapas', () => {
  test('etapas já alcançadas são botões que levam a elas; as que ainda não chegaram ficam só como rótulo', async () => {
    const onIr = vi.fn()
    render(<EtapasObra atual="telas" alcancada="contas" onIr={onIr} />)
    await userEvent.click(screen.getByRole('button', { name: /1 · A ideia/i }))
    expect(onIr).toHaveBeenCalledWith('ideia')
    await userEvent.click(screen.getByRole('button', { name: /5 · As contas/i }))
    expect(onIr).toHaveBeenCalledWith('contas')
    expect(screen.queryByRole('button', { name: /6 · Começar/i })).toBeNull()
    expect(screen.getByRole('button', { name: /4 · O protótipo/i })).toHaveAttribute('aria-current', 'step')
  })
})
