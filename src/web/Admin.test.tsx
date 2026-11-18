import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Admin, quandoFoi } from './Admin'
import { CHAVE_SESSAO_ADMIN, criarAdminApi, type PainelAdmin } from './admin-api'
import type { ConfigPortal } from './portal-api'

const cfg: ConfigPortal = { api: 'https://api.test', authUrl: 'https://auth.test/auth/v1', anonKey: 'anon' }
const resp = (corpo: unknown, status = 200) => ({ ok: status < 400, status, json: async () => corpo }) as Response

const PAINEL: PainelAdmin = {
  gerado_em: '2026-11-18T12:00:00.000Z',
  indicadores: {
    clientes_ativos: 12,
    receita: { recorrente_mensal: 2400, recebida_no_mes: 9800, implantacoes_recebidas_no_mes: 2 },
    ativacoes: { no_mes: 4, meta: 100, computadores_ativos: 11 },
    inadimplencia: { atrasadas: 1, pausadas: 0, valor_em_aberto: 200 },
    travados: 1,
  },
  atencao: [
    { id: 'o1', tipo: 'troca_antecipada', quem: 'Box Força Total', oque: 'Tentou trocar de computador antes do prazo de 7 dias.', quando: '2026-11-18T10:00:00.000Z', licenca_id: 'l7' },
    { id: 'o2', tipo: 'licenca_pausada', quem: 'Salão Bella', oque: 'Pipeline pausado: mensalidade em atraso.', quando: '2026-11-17T10:00:00.000Z', licenca_id: null },
  ],
  clientes: [
    { licenca_id: 'l1', nome: 'Rafa', empresa: 'Pet Shop Amigo', ramo: 'pet shop', situacao: 'ativando', obras: 0, ultimo_sinal_em: null, travado_em: 'instalacao' },
    { licenca_id: 'l2', nome: 'Zé', empresa: 'Barbearia do Zé', ramo: 'barbearia', situacao: 'em_dia', obras: 1, ultimo_sinal_em: '2026-11-18T11:58:00.000Z', travado_em: null },
    { licenca_id: 'l3', nome: 'Bella', empresa: 'Salão Bella', ramo: 'salão', situacao: 'atrasada', obras: 1, ultimo_sinal_em: '2026-11-17T09:00:00.000Z', travado_em: null },
  ],
}

function ambiente(extra: (url: string, init: RequestInit) => Response | undefined = () => undefined) {
  const chamadas: Array<{ url: string; init: RequestInit }> = []
  const f = vi.fn(async (url: string, init: RequestInit) => {
    chamadas.push({ url, init })
    const o = extra(url, init)
    if (o) return o
    if (url.endsWith('/otp')) return resp({})
    if (url.endsWith('/verify')) return resp({ access_token: 'jwt-luiz' })
    if (url.endsWith('/admin/eu')) return resp({ email: 'luiz@atlas.com' })
    if (url.endsWith('/admin/painel')) return resp(PAINEL)
    if (url.endsWith('/admin/liberar-troca')) return resp({ ok: true, ja_liberada: false })
    if (url.endsWith('/admin/ocorrencias/resolver')) return resp({ ok: true })
    return resp({})
  })
  return { f, chamadas, api: criarAdminApi(cfg, f as unknown as typeof fetch) }
}
const montar = (api: ReturnType<typeof criarAdminApi>) => render(<TemaProvider><Admin api={api} /></TemaProvider>)

async function entrar() {
  await userEvent.type(screen.getByLabelText(/Seu e-mail de administrador/), 'luiz@atlas.com')
  await userEvent.click(screen.getByRole('button', { name: /Receber o código/ }))
  await userEvent.type(await screen.findByLabelText(/Código que chegou/), '123456')
  await userEvent.click(screen.getByRole('button', { name: /^Entrar/ }))
}

beforeEach(() => sessionStorage.clear())

describe('painel do admin (F16)', () => {
  it('login com código, sem criar usuário novo; as chamadas levam só o token', async () => {
    const { api, chamadas } = ambiente()
    montar(api)
    expect(screen.getByRole('heading', { name: 'Entrar no painel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Falar' })).toBeInTheDocument()
    await entrar()
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    expect(JSON.parse(String(chamadas.find((c) => c.url.endsWith('/otp'))!.init.body))).toMatchObject({ create_user: false })
    const painel = chamadas.find((c) => c.url.endsWith('/admin/painel'))!
    expect(painel.init.headers).toMatchObject({ Authorization: 'Bearer jwt-luiz' })
    expect(painel.init.body).toBe('{}')
    expect(sessionStorage.getItem(CHAVE_SESSAO_ADMIN)).toBe('jwt-luiz')
  })

  it('cliente comum que entra com código válido é barrado pelo servidor (403) e a sessão é descartada', async () => {
    const { api } = ambiente((url) => (url.endsWith('/admin/eu') ? resp({ erro: 'sem_acesso', mensagem: 'Esta área é só do administrador do Atlas.' }, 403) : undefined))
    montar(api)
    await entrar()
    expect(await screen.findByRole('alert')).toHaveTextContent('só do administrador')
    expect(screen.queryByRole('heading', { name: 'Visão geral' })).toBeNull()
    expect(sessionStorage.getItem(CHAVE_SESSAO_ADMIN)).toBeNull()
  })

  it('a sessão do portal do cliente não abre o painel (chave de sessão separada)', async () => {
    sessionStorage.setItem('atlas.portal.sessao', 'jwt-cliente')
    const { api, f } = ambiente()
    montar(api)
    expect(screen.getByRole('heading', { name: 'Entrar no painel' })).toBeInTheDocument()
    expect(f).not.toHaveBeenCalled()
  })

  it('mostra os 5 indicadores, a tabela de clientes e a lista "precisam de atenção"', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente()
    montar(api)
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    for (const nome of ['Clientes ativos', 'Receita recorrente', 'Ativações no mês', 'Inadimplência', 'Clientes travados']) expect(screen.getByText(nome)).toBeInTheDocument()
    expect(screen.getByText('R$ 2.400')).toBeInTheDocument()
    expect(screen.getByText(/meta: 100/)).toBeInTheDocument()
    const clientes = screen.getByRole('region', { name: 'Clientes' })
    expect(within(clientes).getByText('Barbearia do Zé')).toBeInTheDocument()
    expect(within(clientes).getByText('travado em: instalar e ativar')).toBeInTheDocument()
    expect(within(clientes).getByText('Atrasada')).toBeInTheDocument()
    expect(within(clientes).getByText('agora')).toBeInTheDocument()
    const atencao = screen.getByRole('region', { name: 'Precisam de atenção' })
    expect(within(atencao).getByText('Box Força Total')).toBeInTheDocument()
    expect(within(atencao).getByText('Salão Bella')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u) // sem emoji
  })

  it('liberar troca urgente: pede o motivo, envia o id da licença e confirma', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api, chamadas } = ambiente()
    montar(api)
    const atencao = await screen.findByRole('region', { name: 'Precisam de atenção' })
    await userEvent.click(within(atencao).getByRole('button', { name: 'Liberar troca' }))
    const form = screen.getByRole('region', { name: 'Liberar troca urgente' })
    expect(within(form).getByLabelText('Motivo')).toHaveValue('Cliente pediu a troca antes do prazo de 7 dias.')
    await userEvent.click(within(form).getByRole('button', { name: 'Liberar a troca' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Troca liberada para Box Força Total'))
    const c = chamadas.find((x) => x.url.endsWith('/admin/liberar-troca'))!
    expect(JSON.parse(String(c.init.body))).toEqual({ licenca_id: 'l7', motivo: 'Cliente pediu a troca antes do prazo de 7 dias.' })
  })

  it('"Já resolvi" dá baixa na ocorrência', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api, chamadas } = ambiente()
    montar(api)
    const atencao = await screen.findByRole('region', { name: 'Precisam de atenção' })
    await userEvent.click(within(atencao).getAllByRole('button', { name: 'Já resolvi' })[1])
    await waitFor(() => expect(chamadas.some((x) => x.url.endsWith('/admin/ocorrencias/resolver') && String(x.init.body) === '{"id":"o2"}')).toBe(true))
  })

  it('entregas: procurar por marca d’água mostra de quem é', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api, chamadas } = ambiente((url, init) =>
      url.endsWith('/admin/entregas')
        ? resp({ entregas: JSON.parse(String(init.body)).marca ? [{ licenca_id: 'l2', cliente: 'Barbearia do Zé', obra_id: 'obra-3', marca_dagua: 'abc12345def', baixado_em: '2026-11-17T10:00:00.000Z' }] : [] })
        : undefined,
    )
    montar(api)
    await userEvent.click(await screen.findByRole('link', { name: /Entregas e marca/ }))
    expect(await screen.findByText('Ainda não houve entregas.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/De quem é esta marca/), 'abc12345def')
    await userEvent.click(screen.getByRole('button', { name: 'Procurar' }))
    expect(await screen.findByText('obra-3')).toBeInTheDocument()
    expect(chamadas.filter((x) => x.url.endsWith('/admin/entregas')).at(-1)!.init.body).toBe('{"marca":"abc12345def"}')
  })

  it('cadastros: lista as respostas e quem ainda não respondeu', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente((url) =>
      url.endsWith('/admin/cadastros')
        ? resp({ cadastros: [
            { licenca_id: 'l1', nome: 'Rafa', empresa: 'Pet Shop Amigo', ramo: 'pet shop', email: 'rafa@pet.com', cadastro_em: '2026-11-16T12:00:00.000Z', comprada_em: '2026-11-15T12:00:00.000Z', situacao: 'feito' },
            { licenca_id: 'l2', nome: 'Carla', empresa: '', ramo: '', email: 'carla@x.com', cadastro_em: null, comprada_em: '2026-11-14T12:00:00.000Z', situacao: 'pendente' },
          ] })
        : undefined,
    )
    montar(api)
    await userEvent.click(await screen.findByRole('link', { name: 'Cadastros' }))
    expect(await screen.findByText('rafa@pet.com')).toBeInTheDocument()
    expect(screen.getByText('Ainda não respondeu')).toBeInTheDocument()
  })
})

describe('quandoFoi', () => {
  it('fala como gente', () => {
    const agora = new Date('2026-11-18T12:00:00Z')
    expect(quandoFoi('2026-11-18T11:58:00Z', agora)).toBe('agora')
    expect(quandoFoi('2026-11-18T09:00:00Z', agora)).toBe('há 3 h')
    expect(quandoFoi('2026-11-17T09:00:00Z', agora)).toBe('ontem')
    expect(quandoFoi('2026-11-13T09:00:00Z', agora)).toBe('há 5 dias')
    expect(quandoFoi(null, agora)).toBe('sem sinal ainda')
  })
})
