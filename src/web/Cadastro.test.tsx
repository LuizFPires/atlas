import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Cadastro } from './Cadastro'
import { enviarCadastro } from './cadastro-api'
import { falaParaEmail } from '../ui'

const montar = (onEnviar = vi.fn(async () => ({ ok: true }) as const)) => {
  render(<TemaProvider><Cadastro onEnviar={onEnviar} /></TemaProvider>)
  return onEnviar
}

test('tem as 4 perguntas, cada uma com microfone', () => {
  montar()
  for (const r of [/Como o Atlas vai te chamar/, /nome da sua empresa/, /O que a sua empresa faz/, /Qual o seu e-mail/]) expect(screen.getByLabelText(r)).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Falar' })).toHaveLength(4)
})

test('a transcrição é editável: o texto falado cai no campo e dá para mudar', async () => {
  const w = window as unknown as { webkitSpeechRecognition: unknown }
  let inst: { onresult: (e: unknown) => void; onend: () => void } | undefined
  w.webkitSpeechRecognition = class {
    lang = ''; continuous = false; interimResults = false
    onresult: ((e: unknown) => void) | null = null
    onend: (() => void) | null = null
    onerror = null
    constructor() { inst = this as never }
    start() {}
    stop() { this.onend?.() }
  }
  montar()
  await userEvent.click(screen.getAllByRole('button', { name: 'Falar' })[2])
  const falado = { isFinal: true, 0: { transcript: 'barbearia de bairro' } }
  inst!.onresult({ resultIndex: 0, results: [falado] })
  const campo = await screen.findByDisplayValue('barbearia de bairro')
  await userEvent.type(campo, ' e produtos')
  expect(campo).toHaveValue('barbearia de bairro e produtos')
  delete (w as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
})

test('valida antes de enviar e mostra a tela de e-mail depois de enviar', async () => {
  const onEnviar = montar()
  await userEvent.click(screen.getByRole('button', { name: /Receber meu acesso/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/como o Atlas vai te chamar/i)
  expect(onEnviar).not.toHaveBeenCalled()
  await userEvent.type(screen.getByLabelText(/Como o Atlas vai te chamar/), 'Zé')
  await userEvent.type(screen.getByLabelText(/O que a sua empresa faz/), 'Barbearia')
  await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ze@barbearia.com.br')
  await userEvent.click(screen.getByRole('button', { name: /Receber meu acesso/ }))
  await waitFor(() => expect(onEnviar).toHaveBeenCalledWith({ nome: 'Zé', empresa: '', faz: 'Barbearia', email: 'ze@barbearia.com.br' }))
  expect(await screen.findByRole('status')).toHaveTextContent(/Olhe o seu e-mail/)
})

test('fala vira e-mail', () => {
  expect(falaParaEmail('ze arroba barbearia ponto com ponto br')).toBe('ze@barbearia.com.br')
})

test('enviarCadastro manda as respostas ao POST /cadastro', async () => {
  const f = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
  const r = await enviarCadastro({ nome: 'Zé', empresa: 'B', faz: 'corte', email: 'ze@b.com' }, { api: 'https://api.test/fn' }, f as unknown as typeof fetch)
  expect(r).toEqual({ ok: true })
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.test/fn/cadastro')
  expect(JSON.parse(init.body as string)).toEqual({ nome: 'Zé', empresa: 'B', ramo: 'corte', email: 'ze@b.com' })
  expect((await enviarCadastro({ nome: 'a', empresa: '', faz: 'b', email: 'c@d.e' }, null)).ok).toBe(false)
})
