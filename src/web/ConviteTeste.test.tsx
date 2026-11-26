import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConviteTeste } from './ConviteTeste'

const C = 'abcdefghjk23'
const CONVITE = { app_nome: 'Ponto', grupo_url: 'https://groups.google.com/g/ponto-testadores', optin_url: 'https://play.google.com/apps/testing/br.com.pontoampla.app' }

function api(rotas: Record<string, { status: number; corpo: unknown }>) {
  const chamadas: { url: string; corpo: unknown }[] = []
  const buscar = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, corpo: JSON.parse(String(init?.body ?? '{}')) })
    const r = rotas[url.replace('https://api.test', '')]
    return new Response(JSON.stringify(r?.corpo ?? {}), { status: r?.status ?? 404 })
  }) as typeof fetch
  return { buscar, chamadas }
}

test('mostra os 3 passos com os links do Google e registra "Já instalei" com o nome', async () => {
  const { buscar, chamadas } = api({ '/lojas/convite/ver': { status: 200, corpo: CONVITE }, '/lojas/teste/entrar': { status: 200, corpo: { ok: true } } })
  render(<ConviteTeste codigo={C} api="https://api.test" buscar={buscar} />)
  expect(await screen.findByRole('heading', { name: /Teste o app Ponto/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Entrar no grupo/ })).toHaveAttribute('href', CONVITE.grupo_url)
  expect(screen.getByRole('link', { name: /Quero testar/ })).toHaveAttribute('href', CONVITE.optin_url)
  await userEvent.type(screen.getByRole('textbox', { name: 'Seu nome' }), 'Maria')
  await userEvent.click(screen.getByRole('button', { name: 'Já instalei' }))
  expect(await screen.findByText(/Obrigado, Maria/)).toBeInTheDocument()
  expect(chamadas.at(-1)).toEqual({ url: 'https://api.test/lojas/teste/entrar', corpo: { codigo: C, nome: 'Maria' } })
})

test('links que não são do Google nunca viram botão', async () => {
  const { buscar } = api({ '/lojas/convite/ver': { status: 200, corpo: { ...CONVITE, grupo_url: 'https://evil.com/x' } } })
  render(<ConviteTeste codigo={C} api="https://api.test" buscar={buscar} />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/não pôde ser aberto/)
  expect(screen.queryByRole('link')).toBeNull()
})

test('convite que não existe: recado claro', async () => {
  const { buscar } = api({ '/lojas/convite/ver': { status: 404, corpo: { mensagem: 'Esse convite não existe.' } } })
  render(<ConviteTeste codigo={C} api="https://api.test" buscar={buscar} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Esse convite não existe.')
})
