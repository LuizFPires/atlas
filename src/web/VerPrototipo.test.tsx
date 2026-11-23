import { render, screen } from '@testing-library/react'
import { VerPrototipo } from './VerPrototipo'

const DOC = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><section id="tela-a">oi</section>'
const T = 'A'.repeat(43)
const resp = (status: number, corpo: unknown) => async () => new Response(JSON.stringify(corpo), { status })

test('mostra o protótipo em tela cheia, protegido (sandbox vazio), com o nome e até quando vale', async () => {
  render(<VerPrototipo token={T} api="https://api.test" buscar={resp(200, { nome: 'Colore', documento: DOC, expira_em: '2026-11-30T03:00:00.000Z' })} />)
  const quadro = await screen.findByTitle('Protótipo do Colore')
  expect(quadro).toHaveAttribute('sandbox', '')
  expect(quadro).toHaveAttribute('srcdoc', DOC)
  expect(screen.getByText(/Colore/)).toBeInTheDocument()
  expect(screen.getByText(/vale até 30\/11/)).toBeInTheDocument()
})

test('link vencido: recado claro, sem protótipo', async () => {
  render(<VerPrototipo token={T} api="https://api.test" buscar={resp(410, { erro: 'link_vencido', mensagem: 'Esse link venceu (ele vale 7 dias). Peça um link novo no Atlas.' })} />)
  expect(await screen.findByText(/Esse link venceu/)).toBeInTheDocument()
  expect(screen.queryByTitle(/Protótipo/)).toBeNull()
})

test('documento sem a proteção do Atlas nunca é mostrado', async () => {
  render(<VerPrototipo token={T} api="https://api.test" buscar={resp(200, { nome: 'X', documento: '<script>alert(1)</script>', expira_em: '2026-11-30T03:00:00.000Z' })} />)
  expect(await screen.findByText(/não pôde ser aberto/)).toBeInTheDocument()
  expect(screen.queryByTitle(/Protótipo/)).toBeNull()
})
