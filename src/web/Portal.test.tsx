import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Portal } from './Portal'
import { criarPortalApi, CHAVE_SESSAO, type ConfigPortal } from './portal-api'

const cfg: ConfigPortal = { api: 'https://api.test', authUrl: 'https://auth.test/auth/v1', anonKey: 'anon' }
const resp = (corpo: unknown, status = 200) => ({ ok: status < 400, status, json: async () => corpo }) as Response

beforeEach(() => sessionStorage.clear())

describe('login do portal', () => {
  test('e-mail e código: pede o código ao Auth do Atlas e abre a conta com o token', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.endsWith('/otp')) return resp({})
      if (url.endsWith('/verify')) return resp({ access_token: 'jwt-ana' })
      if (url.endsWith('/portal/conta')) return resp(CONTA)
      return resp({ nome: 'Zé', empresa: 'Barbearia do Zé', email: 'ze@barbearia.com' })
    })
    const api = criarPortalApi(cfg, f as unknown as typeof fetch)
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    expect(screen.getByRole('heading', { name: 'Entrar na minha conta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Falar' })).toBeInTheDocument() // microfone no campo
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ze@barbearia.com')
    await userEvent.click(screen.getByRole('button', { name: /Receber o código/ }))
    await userEvent.type(await screen.findByLabelText(/Código que chegou/), '123456')
    await userEvent.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(await screen.findByRole('heading', { name: 'Minha conta' })).toBeInTheDocument()
    expect(screen.getByText('Zé · Barbearia do Zé')).toBeInTheDocument()
    // a chamada ao servidor leva o token no cabeçalho, nunca e-mail/id no corpo
    const chamada = (f.mock.calls as unknown as Array<[string, RequestInit]>).find(([u]) => u.endsWith('/portal/eu'))!
    expect(chamada[1].headers).toMatchObject({ Authorization: 'Bearer jwt-ana' })
    expect(chamada[1].body).toBe('{}')
    expect(sessionStorage.getItem(CHAVE_SESSAO)).toBe('jwt-ana')
  })

  test('código errado mostra mensagem amiga e não abre a conta', async () => {
    const f = vi.fn(async (url: string) => (url.endsWith('/otp') ? resp({}) : resp({ msg: 'x' }, 403)))
    render(<TemaProvider><Portal api={criarPortalApi(cfg, f as unknown as typeof fetch)} /></TemaProvider>)
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ze@barbearia.com')
    await userEvent.click(screen.getByRole('button', { name: /Receber o código/ }))
    await userEvent.type(await screen.findByLabelText(/Código que chegou/), '000000')
    await userEvent.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorreto ou vencido')
    expect(screen.queryByRole('heading', { name: 'Minha conta' })).toBeNull()
  })

  test('e-mail de quem não comprou: o servidor recusa e a sessão é descartada', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.endsWith('/otp')) return resp({})
      if (url.endsWith('/verify')) return resp({ access_token: 'jwt-x' })
      return resp({ erro: 'sem_compra', mensagem: 'Não achamos uma compra do Atlas para esse e-mail.' }, 403)
    })
    const api = criarPortalApi(cfg, f as unknown as typeof fetch)
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'x@y.com')
    await userEvent.click(screen.getByRole('button', { name: /Receber o código/ }))
    await userEvent.type(await screen.findByLabelText(/Código que chegou/), '123456')
    await userEvent.click(screen.getByRole('button', { name: /^Entrar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não achamos uma compra')
    await waitFor(() => expect(api.logado()).toBe(false))
  })

  test('sem configuração, explica em vez de quebrar', async () => {
    render(<TemaProvider><Portal api={criarPortalApi(null)} /></TemaProvider>)
    await userEvent.type(screen.getByLabelText(/Qual o seu e-mail/), 'ze@barbearia.com')
    await userEvent.click(screen.getByRole('button', { name: /Receber o código/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ainda não está aberto')
  })
})

const CONTA = {
  perfil: { nome: 'Zé', empresa: 'Barbearia do Zé', email: 'ze@barbearia.com' },
  licenca: {
    status: 'ativa', comprada_em: '2026-11-18T12:00:00.000Z', mensalidade_valor: 200, mensalidade_ativa: true, mensalidade_encerra_em: null,
    proxima_cobranca_em: '2026-12-18T12:00:00.000Z', arrependimento_ate: '2026-11-25T12:00:00.000Z',
    pode_cancelar_compra: true, pode_cancelar_mensalidade: true, pode_mudar_pagamento: true,
  },
  computador: { ativado_em: '2026-11-18T12:00:00.000Z' },
  troca: { pode_agora: true, proxima_troca_em: null },
  pagamentos: [{ data: '2026-11-18T12:00:00.000Z', descricao: 'Implantação do Atlas (curso, treinamento e licença)', valor: 4800, status: 'pago', tipo: 'implantacao' }],
}

/** Servidor falso já com sessão aberta nesta aba. */
export function sessaoAberta(rotas: Record<string, (corpo: unknown) => Response>) {
  sessionStorage.setItem(CHAVE_SESSAO, 'jwt-ze')
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const rota = url.replace('https://api.test', '')
    return (rotas[rota] ?? (() => resp({ erro: 'nao_encontrado' }, 404)))(init?.body ? JSON.parse(String(init.body)) : {})
  })
  return { f, api: criarPortalApi(cfg, f as unknown as typeof fetch) }
}

describe('tela da conta (item 2)', () => {
  test('mostra licença, mensalidade, computador e pagamentos como no protótipo', async () => {
    const { api } = sessaoAberta({ '/portal/eu': () => resp(CONTA.perfil), '/portal/conta': () => resp(CONTA) })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    expect(await screen.findByRole('heading', { name: 'Minha conta' })).toBeInTheDocument()
    expect(screen.getByText('● Ativa')).toBeInTheDocument()
    expect(screen.getByText(/Implantação paga em 18\/11\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*200,00\/mês/)).toBeInTheDocument()
    expect(screen.getByText(/Próxima cobrança: 18\/12\/2026/)).toBeInTheDocument()
    expect(screen.getByText('Computador com a licença')).toBeInTheDocument()
    expect(screen.getByText(/Ativado em 18\/11\/2026/)).toBeInTheDocument()
    expect(screen.getByText('Implantação do Atlas (curso, treinamento e licença)')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*4\.800,00/)).toBeInTheDocument()
    expect(screen.getByText('Agendado')).toBeInTheDocument()
  })

  test('trocar forma de pagamento leva ao portal de cobrança (https) do cliente', async () => {
    const { api } = sessaoAberta({ '/portal/eu': () => resp(CONTA.perfil), '/portal/conta': () => resp(CONTA), '/portal/forma-pagamento': () => resp({ url: 'http://evil.test' }) })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    await userEvent.click(await screen.findByRole('button', { name: 'Trocar forma de pagamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('estranho') // só aceita https
  })

  test('sessão vencida no servidor: pede para entrar de novo', async () => {
    const { api } = sessaoAberta({ '/portal/eu': () => resp({ mensagem: 'Entre de novo na sua conta para continuar.' }, 401) })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Entre de novo')
    expect(api.logado()).toBe(false)
  })
})

describe('trocar de computador (item 3)', () => {
  test('desativar pede código por e-mail, confirma e mostra "Licença liberada"', async () => {
    let conta: unknown = CONTA
    const { api, f } = sessaoAberta({
      '/portal/eu': () => resp(CONTA.perfil),
      '/portal/conta': () => resp(conta),
      '/portal/trocar/solicitar-codigo': () => resp({ ok: true, enviado_para: 'z***@barbearia.com' }),
      '/portal/trocar/desativar': (corpo) => {
        if ((corpo as { codigo: string }).codigo !== '123456') return resp({ mensagem: 'Código incorreto.' }, 400)
        conta = { ...CONTA, computador: null, troca: { pode_agora: false, proxima_troca_em: '2026-11-25T12:00:00.000Z' } }
        return resp({ ok: true, enviado_para: 'z***@barbearia.com', proxima_troca_em: '2026-11-25T12:00:00.000Z' })
      },
    })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    expect(await screen.findByText(/Não precisa do computador antigo/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desativar este computador' }))
    expect(await screen.findByText(/z\*\*\*@barbearia\.com/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Falar' }).length).toBeGreaterThan(0) // código também pode ser falado
    await userEvent.type(screen.getByLabelText(/Código que chegou/), '999999')
    await userEvent.click(screen.getByRole('button', { name: /Desativar e liberar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorreto.')
    await userEvent.clear(screen.getByLabelText(/Código que chegou/))
    await userEvent.type(screen.getByLabelText(/Código que chegou/), '123456')
    await userEvent.click(screen.getByRole('button', { name: /Desativar e liberar/ }))
    expect(await screen.findByText('Licença liberada.')).toBeInTheDocument()
    expect(screen.getByText(/Próxima troca possível a partir de 25\/11\/2026/)).toBeInTheDocument()
    // nenhuma chamada leva id/e-mail no corpo: só o código
    const corpos = (f.mock.calls as unknown as Array<[string, RequestInit]>).filter(([u]) => u.includes('/trocar/')).map(([, i]) => String(i.body))
    expect(corpos.every((b) => !/email|licenca|cliente/.test(b))).toBe(true)
  })

  test('dentro dos 7 dias o botão fica travado e explica quando libera', async () => {
    const { api } = sessaoAberta({
      '/portal/eu': () => resp(CONTA.perfil),
      '/portal/conta': () => resp({ ...CONTA, troca: { pode_agora: false, proxima_troca_em: '2026-11-25T12:00:00.000Z' } }),
    })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    expect(await screen.findByRole('button', { name: 'Desativar este computador' })).toBeDisabled()
    expect(screen.getByText(/1 vez a cada 7 dias: próxima troca possível a partir de 25\/11\/2026/)).toBeInTheDocument()
  })

  test('sem computador ativo: oferece reenviar o acesso', async () => {
    const { api } = sessaoAberta({
      '/portal/eu': () => resp(CONTA.perfil),
      '/portal/conta': () => resp({ ...CONTA, computador: null }),
      '/portal/reenviar-acesso': () => resp({ ok: true, enviado_para: 'z***@barbearia.com' }),
    })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    await userEvent.click(await screen.findByRole('button', { name: /Enviar o acesso de novo/ }))
    expect(await screen.findByText(/Mandamos um novo link de instalação para/)).toBeInTheDocument()
  })
})

describe('cancelar compra e mensalidade (item 4)', () => {
  test('desistir da compra pede confirmação, manda confirmar:true e mostra o resultado', async () => {
    let conta: unknown = CONTA
    const { api, f } = sessaoAberta({
      '/portal/eu': () => resp(CONTA.perfil),
      '/portal/conta': () => resp(conta),
      '/portal/compra/cancelar': () => {
        conta = { ...CONTA, licenca: { ...CONTA.licenca, status: 'cancelada', pode_cancelar_compra: false, pode_cancelar_mensalidade: false } }
        return resp({ ok: true, estornados: 1 })
      },
    })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar a compra' }))
    expect(screen.getByText('Tem certeza que quer desistir da compra?')).toBeInTheDocument()
    expect(f.mock.calls.some(([u]) => String(u).includes('/cancelar'))).toBe(false) // nada sai antes de confirmar
    await userEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))
    expect(await screen.findByText(/Compra cancelada\. Devolvemos o que você pagou/)).toBeInTheDocument()
    const chamada = (f.mock.calls as unknown as Array<[string, RequestInit]>).find(([u]) => u.endsWith('/portal/compra/cancelar'))!
    expect(chamada[1].body).toBe('{"confirmar":true}')
  })

  test('cancelar mensalidade: sem fidelidade, e informa até quando a licença vale', async () => {
    const { api } = sessaoAberta({
      '/portal/eu': () => resp(CONTA.perfil),
      '/portal/conta': () => resp({ ...CONTA, licenca: { ...CONTA.licenca, pode_cancelar_compra: false } }),
      '/portal/mensalidade/cancelar': () => resp({ ok: true, encerra_em: '2026-12-05T00:00:00.000Z' }),
    })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    expect(screen.queryByRole('button', { name: 'Cancelar a compra' })).toBeNull()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar a mensalidade' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))
    expect(await screen.findByText(/Sua licença continua valendo até 04\/12\/2026|Sua licença continua valendo até 05\/12\/2026/)).toBeInTheDocument()
  })

  test('"Não, voltar" desiste do pedido; erro do servidor aparece em linguagem simples', async () => {
    const { api } = sessaoAberta({
      '/portal/eu': () => resp(CONTA.perfil),
      '/portal/conta': () => resp(CONTA),
      '/portal/compra/cancelar': () => resp({ mensagem: 'O prazo de 7 dias para desistir da compra já passou.' }, 409),
    })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar a compra' }))
    await userEvent.click(screen.getByRole('button', { name: 'Não, voltar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar a compra' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('O prazo de 7 dias')
  })

  test('sem direito a nenhum cancelamento, a seção nem aparece', async () => {
    const { api } = sessaoAberta({
      '/portal/eu': () => resp(CONTA.perfil),
      '/portal/conta': () => resp({ ...CONTA, licenca: { ...CONTA.licenca, pode_cancelar_compra: false, pode_cancelar_mensalidade: false } }),
    })
    render(<TemaProvider><Portal api={api} /></TemaProvider>)
    await screen.findByRole('heading', { name: 'Minha conta' })
    expect(screen.queryByText('Cancelamento')).toBeNull()
  })
})
