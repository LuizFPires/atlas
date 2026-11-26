import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Cadastro } from './Cadastro'
import { enviarCadastro, sessionIdDaUrl } from './cadastro-api'
import { juntarFalaEmail } from './compra'
import { falaParaEmail } from '../ui'

const montar = (onEnviar = vi.fn(async () => ({ ok: true }) as const)) => {
  render(<TemaProvider><Cadastro onEnviar={onEnviar} temProva /></TemaProvider>)
  return onEnviar
}

const escolherCidade = async (digitar: string, opcao: string) => {
  await userEvent.type(screen.getByLabelText(/De qual cidade/), digitar)
  await userEvent.click(await screen.findByRole('option', { name: opcao }))
}

test('tem as 5 perguntas, cada uma com microfone', () => {
  montar()
  for (const r of [/Como o Atlas vai te chamar/, /nome da sua empresa/, /O que a sua empresa faz/, /De qual cidade/, /Qual o seu e-mail/]) expect(screen.getByLabelText(r)).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Falar' })).toHaveLength(5)
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
  expect(await screen.findByRole('alert')).toHaveTextContent(/de qual cidade você é/i)
  expect(onEnviar).not.toHaveBeenCalled()
  await escolherCidade('campinas', 'Campinas – SP')
  await userEvent.click(screen.getByRole('button', { name: /Receber meu acesso/ }))
  await waitFor(() => expect(onEnviar).toHaveBeenCalledWith({ nome: 'Zé', empresa: '', faz: 'Barbearia', cidade: 'Campinas', uf: 'SP', email: 'ze@barbearia.com.br' }))
  expect(await screen.findByRole('status')).toHaveTextContent(/Olhe o seu e-mail/)
  expect(screen.getByText(/Não achou o e-mail\? Olhe também nas abas Promoções e Atualizações do Gmail e na caixa de spam/)).toBeInTheDocument()
})

test('voz com o campo de e-mail já preenchido: a fala nova substitui ou continua, sem colar as palavras', () => {
  expect(juntarFalaEmail('ze@barbearia.com', 'ana arroba loja ponto com ponto br')).toBe('ana@loja.com.br')
  expect(juntarFalaEmail('ze', 'arroba barbearia ponto com')).toBe('ze@barbearia.com')
  expect(juntarFalaEmail('ze@barbearia', 'ponto com ponto br')).toBe('ze@barbearia.com.br')
})

test('sem a prova da compra, não afirma que o pagamento foi confirmado', () => {
  render(<TemaProvider><Cadastro onEnviar={vi.fn()} temProva={false} /></TemaProvider>)
  expect(screen.queryByText(/Pagamento confirmado/)).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(/volte pelo botão da página de pagamento/i)
})

test('o tela de sucesso mostra o e-mail REAL da compra (mascarado) devolvido pelo servidor', async () => {
  const onEnviar = vi.fn(async () => ({ ok: true, enviado_para: 'z***@barbearia.com.br', email_diferente: true }) as const)
  montar(onEnviar)
  await userEvent.type(screen.getByLabelText(/Como o Atlas vai te chamar/), 'Zé')
  await userEvent.type(screen.getByLabelText(/O que a sua empresa faz/), 'Barbearia')
  await escolherCidade('campinas', 'Campinas – SP')
  await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'outro@x.com')
  await userEvent.click(screen.getByRole('button', { name: /Receber meu acesso/ }))
  const s = await screen.findByRole('status')
  expect(s).toHaveTextContent('z***@barbearia.com.br')
  expect(s).toHaveTextContent(/diferente do da compra/)
})

test('lê o session_id da URL e só aceita o formato do Stripe', () => {
  expect(sessionIdDaUrl('?session_id=cs_test_a1B2c3D4e5')).toBe('cs_test_a1B2c3D4e5')
  expect(sessionIdDaUrl('?session_id=ana@x.com')).toBe('')
  expect(sessionIdDaUrl('')).toBe('')
})

test('fala vira e-mail', () => {
  expect(falaParaEmail('ze arroba barbearia ponto com ponto br')).toBe('ze@barbearia.com.br')
})

test('enviarCadastro manda as respostas ao POST /cadastro', async () => {
  const f = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
  const r = await enviarCadastro({ nome: 'Zé', empresa: 'B', faz: 'corte', cidade: 'Campinas', uf: 'SP', email: 'ze@b.com' }, { api: 'https://api.test/fn' }, f as unknown as typeof fetch, 'cs_test_a1B2c3D4e5')
  expect(r).toMatchObject({ ok: true })
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.test/fn/cadastro')
  expect(JSON.parse(init.body as string)).toEqual({ session_id: 'cs_test_a1B2c3D4e5', nome: 'Zé', empresa: 'B', ramo: 'corte', cidade: 'Campinas', uf: 'SP', email: 'ze@b.com' })
  expect((await enviarCadastro({ nome: 'a', empresa: '', faz: 'b', cidade: 'X', uf: 'SP', email: 'c@d.e' }, null)).ok).toBe(false)
  // sem session_id nem chama o servidor; resposta 202 (Pix pendente) não é sucesso
  const g = vi.fn()
  expect((await enviarCadastro({ nome: 'a', empresa: '', faz: 'b', cidade: 'X', uf: 'SP', email: 'c@d.e' }, { api: 'https://api.test/fn' }, g as unknown as typeof fetch, '')).ok).toBe(false)
  expect(g).not.toHaveBeenCalled()
  const pend = vi.fn(async () => new Response('{"ok":false,"pendente":true,"mensagem":"espere"}', { status: 202 }))
  expect(await enviarCadastro({ nome: 'a', empresa: '', faz: 'b', cidade: 'X', uf: 'SP', email: 'c@d.e' }, { api: 'https://api.test/fn' }, pend as unknown as typeof fetch, 'cs_test_a1B2c3D4e5')).toEqual({ ok: false, mensagem: 'espere' })
})

test('cidade: digitar sem acento acha a sugestão, setas + Enter escolhem e a UF aparece; Esc fecha', async () => {
  montar()
  const campo = screen.getByLabelText(/De qual cidade/)
  await userEvent.type(campo, 'sao paulo')
  expect(await screen.findByRole('option', { name: 'São Paulo – SP' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('option')).not.toBeInTheDocument()
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(campo).toHaveValue('São Paulo')
  expect(screen.getByLabelText('Estado: SP')).toBeInTheDocument()
  // mexer no texto desfaz o estado: precisa escolher de novo
  await userEvent.type(campo, 'x')
  expect(screen.queryByLabelText(/Estado:/)).not.toBeInTheDocument()
})

test('cidade que não existe: avisa com gentileza e não deixa enviar sem escolher da lista', async () => {
  const onEnviar = montar()
  await userEvent.type(screen.getByLabelText(/De qual cidade/), 'zzzzqq')
  expect(await screen.findByText(/Não achei essa cidade/)).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText(/Como o Atlas vai te chamar/), 'Zé')
  await userEvent.type(screen.getByLabelText(/O que a sua empresa faz/), 'Barbearia')
  await userEvent.click(screen.getByRole('button', { name: /Receber meu acesso/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/escolha a sua cidade na lista/i)
  expect(onEnviar).not.toHaveBeenCalled()
})

// ---- M31: cadastro em inglês (compra em dólar) ----------------------------------------------------------------------------
describe('cadastro em inglês (M31)', () => {
  const montarEn = (onEnviar = vi.fn(async () => ({ ok: true, enviado_para: 'j***@shop.com' }) as const)) => {
    const r = render(<TemaProvider><Cadastro idioma="en" onEnviar={onEnviar} temProva /></TemaProvider>)
    return { onEnviar, ...r }
  }
  test('4 perguntas (sem cidade do Brasil), compra em dólar e nenhum texto em português', () => {
    const { container } = montarEn()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to Atlas! Just 4 quick answers.')
    expect(screen.getAllByRole('button', { name: 'Speak' })).toHaveLength(4)
    expect(screen.getByText('$1,700')).toBeInTheDocument()
    expect((container.textContent ?? '').replace(/PL Participações LTDA/g, '')).not.toMatch(/[ãõçáéíóúâêô]|R\$/)
  })
  test('envia sem cidade e mostra o recado de sucesso em inglês', async () => {
    const { onEnviar } = montarEn()
    await userEvent.type(screen.getByLabelText(/What should Atlas call you/), 'John')
    await userEvent.type(screen.getByLabelText(/What does your business do/), 'Barber shop')
    await userEvent.type(screen.getByLabelText(/What’s your email/), 'john@shop.com')
    await userEvent.click(screen.getByRole('button', { name: /Email me my access/ }))
    await waitFor(() => expect(onEnviar).toHaveBeenCalledWith(expect.objectContaining({ nome: 'John', cidade: '', uf: '' })))
    expect(await screen.findByRole('heading', { name: 'Done, John! Check your email.' })).toBeInTheDocument()
  })
})
