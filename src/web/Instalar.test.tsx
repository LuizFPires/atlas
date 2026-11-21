import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Instalar } from './Instalar'
import { criarInstalarApi, criarInstalarFixture, type InstalarApi } from './instalar-api'

const T = 'a'.repeat(30)

test('sem token: mensagem honesta, sem chamar o servidor', async () => {
  const abrir = vi.fn()
  render(<Instalar api={{ ...criarInstalarFixture(), abrir }} token="" />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/não está completo/)
  expect(abrir).not.toHaveBeenCalled()
})

test('token inválido: mostra o recado do servidor', async () => {
  const api: InstalarApi = { ...criarInstalarFixture(), abrir: async () => ({ ok: false, mensagem: 'Esse link venceu.' }) }
  render(<Instalar api={api} token={T} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Esse link venceu.')
})

test('celular: aviso e reenvio para o computador', async () => {
  const enviar = vi.fn(async () => ({ ok: true as const }))
  render(<Instalar api={{ ...criarInstalarFixture(true), enviarParaComputador: enviar }} token={T} />)
  expect(await screen.findByRole('heading', { name: /acesso está liberado/ })).toBeInTheDocument()
  expect(screen.getByText(/Abra no computador/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Enviar para o meu computador/ }))
  expect(enviar).toHaveBeenCalledWith(T)
  expect(await screen.findByRole('status')).toHaveTextContent(/Mandei o acesso de novo/)
})

test('celular: limite de pedidos aparece como erro honesto', async () => {
  const api: InstalarApi = { ...criarInstalarFixture(true), enviarParaComputador: async () => ({ ok: false, mensagem: 'Espere uns minutos.', limite: true }) }
  render(<Instalar api={api} token={T} />)
  await userEvent.click(await screen.findByRole('button', { name: /Enviar para o meu computador/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Espere uns minutos.')
})

test('computador: acesso liberado, sem link nem botão de download inventado', async () => {
  const { container } = render(<Instalar api={criarInstalarFixture(false)} token={T} />)
  expect(await screen.findByRole('heading', { name: /acesso está liberado/ })).toBeInTheDocument()
  expect(screen.getByTestId('download-pendente')).toHaveTextContent(/ainda não está disponível/)
  expect(screen.queryByRole('button')).toBeNull()
  expect(container.querySelector('a[download], a[href$=".exe"]')).toBeNull()
})

test('adaptador: 429 vira limite e sem servidor responde com honestidade', async () => {
  const f = vi.fn(async () => new Response(JSON.stringify({ mensagem: 'Muitas.' }), { status: 429 })) as unknown as typeof fetch
  const api = criarInstalarApi({ api: 'https://x.test' }, f)
  expect(await api.enviarParaComputador(T)).toMatchObject({ ok: false, limite: true })
  expect(await criarInstalarApi(null).abrir(T)).toMatchObject({ ok: false })
})
