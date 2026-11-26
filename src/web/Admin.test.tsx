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
    if (url.includes('/token?grant_type=password')) return resp({ access_token: 'jwt-luiz' })
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
  await userEvent.type(screen.getByLabelText('Senha'), 'segredo-teste')
  await userEvent.click(screen.getByRole('button', { name: /^Entrar/ }))
}

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); localStorage.setItem('atlas.admin.menu-recolhido', '0') }) // os testes partem do menu aberto
const irParaAcoes = async () => { await userEvent.click(await screen.findByRole('link', { name: 'Ações' })) }
// Luiz, 26/11/2026: as cortesias ganharam uma aba própria dentro de Ações (antes a lista ficava embaixo dos cartões).
const irParaCortesias = async () => { await irParaAcoes(); await userEvent.click(await screen.findByRole('tab', { name: /^Cortesias/ })) }

describe('painel do admin (F16)', () => {
  it('login com e-mail e senha; as chamadas levam só o token', async () => {
    const { api, chamadas } = ambiente()
    montar(api)
    expect(screen.getByRole('heading', { name: 'Entrar no painel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Falar' })).toBeInTheDocument()
    await entrar()
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    expect(JSON.parse(String(chamadas.find((c) => c.url.includes('grant_type=password'))!.init.body))).toMatchObject({ email: 'luiz@atlas.com', password: 'segredo-teste' })
    const painel = chamadas.find((c) => c.url.endsWith('/admin/painel'))!
    expect(painel.init.headers).toMatchObject({ Authorization: 'Bearer jwt-luiz' })
    expect(painel.init.body).toBe('{}')
    expect(sessionStorage.getItem(CHAVE_SESSAO_ADMIN)).toBe('jwt-luiz')
  })

  it('e-mail fora da lista, mesmo com senha certa, é barrado pelo servidor (403) e a sessão é descartada', async () => {
    const { api } = ambiente((url) => (url.endsWith('/admin/eu') ? resp({ erro: 'sem_acesso', mensagem: 'Esta área é só do administrador do Atlas.' }, 403) : undefined))
    montar(api)
    await entrar()
    expect(await screen.findByRole('alert')).toHaveTextContent('só do administrador')
    expect(screen.queryByRole('heading', { name: 'Visão geral' })).toBeNull()
    expect(sessionStorage.getItem(CHAVE_SESSAO_ADMIN)).toBeNull()
  })

  it('e-mail ou senha errados mostram o erro e não guardam sessão', async () => {
    const { api } = ambiente((url) => (url.includes('grant_type=password') ? resp({ error: 'invalid_grant' }, 400) : undefined))
    montar(api)
    await entrar()
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
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
    for (const nome of ['Clientes ativos', 'Receita recorrente (MRR)', 'Ativações no mês', 'Inadimplência', 'Clientes travados']) expect(screen.getByText(nome)).toBeInTheDocument()
    expect(screen.getByText('R$ 2.400')).toBeInTheDocument()
    expect(screen.getByText(/meta: 100/)).toBeInTheDocument()
    const clientes = screen.getByRole('region', { name: 'Clientes' })
    expect(within(clientes).getByText('Barbearia do Zé')).toBeInTheDocument()
    expect(within(clientes).getByText('travado em: instalar e ativar')).toBeInTheDocument()
    expect(within(clientes).getByText('Atrasada')).toBeInTheDocument()
    expect(within(clientes).getByText('agora')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Precisam de atenção \(2\)/ }))
    const atencao = screen.getByRole('dialog', { name: 'Precisam de atenção' })
    expect(within(atencao).getByText('Box Força Total')).toBeInTheDocument()
    expect(within(atencao).getByText('Salão Bella')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u) // sem emoji
  })

  it('fidelidade ao F16: rótulo ADMINISTRADOR, menu, subtítulo do mês e a ordem dos 5 cartões', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente()
    montar(api)
    await screen.findByRole('heading', { name: 'Visão geral' })
    expect(screen.getByText('ADMINISTRADOR')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Visão geral' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('novembro de 2026')).toBeInTheDocument()
    expect([...document.querySelectorAll('.ad-info-nome')].map((n) => n.textContent)).toEqual(['Clientes ativos', 'Receita recorrente (MRR)', 'Ticket médio'])
    expect([...document.querySelectorAll('.ad-kpi-nome')].map((n) => n.textContent)).toEqual(['Ativações no mês', 'Inadimplência', 'Cancelamentos no mês', 'Clientes travados'])
    expect(screen.getByRole('button', { name: /Precisam de atenção \(2\)/ })).toBeInTheDocument()
    expect(screen.getByText('CLIENTES')).toBeInTheDocument()
    expect([...document.querySelectorAll('.ad-item')].map((n) => n.getAttribute('aria-label'))).toEqual(['Visão geral', 'Fluxo de caixa', 'Ações', 'Radar', 'Política', 'Mapa', 'Marca d’água'])
    expect(screen.queryByRole('link', { name: 'Cadastros' })).toBeNull()
  })

  it('linha de cima só informa; os 4 cartões são botões que filtram a lista e clicar de novo limpa', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente()
    montar(api)
    await screen.findByRole('heading', { name: 'Visão geral' })
    const infos = screen.getByLabelText('Números do negócio')
    expect(within(infos).getByText('12')).toBeInTheDocument()
    expect(within(infos).getByText('R$ 2.400')).toBeInTheDocument()
    expect(within(infos).getByText('R$ 200')).toBeInTheDocument()
    expect(within(infos).queryAllByRole('button')).toHaveLength(0)
    const grupo = screen.getByRole('group', { name: 'Filtrar clientes por situação' })
    expect(within(grupo).getAllByRole('button')).toHaveLength(4)
    const clientes = screen.getByRole('region', { name: 'Clientes' })
    const inad = within(grupo).getByRole('button', { name: /Inadimplência/ })
    expect(inad).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(inad)
    expect(inad).toHaveAttribute('aria-pressed', 'true')
    expect(within(clientes).getByRole('combobox')).toHaveValue('inadimplentes')
    expect(within(clientes).getByText('Salão Bella')).toBeInTheDocument()
    expect(within(clientes).queryByText('Barbearia do Zé')).toBeNull()
    await userEvent.click(inad)
    expect(inad).toHaveAttribute('aria-pressed', 'false')
    expect(within(clientes).getByRole('combobox')).toHaveValue('todas')
    expect(within(clientes).getByText('Barbearia do Zé')).toBeInTheDocument()
    await userEvent.click(within(grupo).getByRole('button', { name: /Clientes travados/ }))
    expect(within(clientes).getByText('Pet Shop Amigo')).toBeInTheDocument()
    expect(within(clientes).queryByText('Salão Bella')).toBeNull()
  })

  it('liberar troca urgente: pede o motivo, envia o id da licença e confirma', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api, chamadas } = ambiente()
    montar(api)
    await userEvent.click(await screen.findByRole('button', { name: /Precisam de atenção/ }))
    const atencao = screen.getByRole('dialog', { name: 'Precisam de atenção' })
    await userEvent.click(within(atencao).getByRole('button', { name: 'Liberar troca' }))
    expect(screen.queryByRole('dialog')).toBeNull() // a gaveta fecha para o formulário aparecer
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
    await userEvent.click(await screen.findByRole('button', { name: /Precisam de atenção/ }))
    const atencao = screen.getByRole('dialog', { name: 'Precisam de atenção' })
    await userEvent.click(within(atencao).getAllByRole('button', { name: 'Já resolvi' })[1])
    await waitFor(() => expect(chamadas.some((x) => x.url.endsWith('/admin/ocorrencias/resolver') && String(x.init.body) === '{"id":"o2"}')).toBe(true))
  })

  const MARCA = 'k3Zt9QpL0aXv7RmB2yHcN5dE'
  const ENTREGAS = [
    { licenca_id: 'l2', cliente: 'Barbearia do Zé', obra_id: 'agenda-barbearia', marca_dagua: 'AAAA1111BBBB2222CCCC3333', baixado_em: '2026-11-17T10:00:00.000Z' },
    { licenca_id: 'l3', cliente: 'Salão Bella', obra_id: 'cardapio', marca_dagua: 'ZZZZ9999YYYY8888XXXX7777', baixado_em: '2026-11-16T10:00:00.000Z' },
  ]
  const antiga = { licenca_id: 'l1', cliente: 'Pet Shop Amigo', obra_id: 'obra-antiga', marca_dagua: MARCA, baixado_em: '2026-01-10T10:00:00.000Z' }
  const ambienteEntregas = () => { sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz'); return ambienteE() }
  const ambienteE = () => ambiente((url, init) => {
    if (url.endsWith('/admin/entregas')) return resp({ entregas: JSON.parse(String(init.body)).marca ? [antiga] : ENTREGAS })
    if (url.endsWith('/admin/cadastros')) return resp({ cadastros: [{ licenca_id: 'l2', nome: 'Zé', empresa: 'Barbearia do Zé', ramo: 'barbearia', email: 'ze@barbearia.com', cadastro_em: null, comprada_em: null, situacao: 'feito' }] })
    return undefined
  })
  const abrirMarca = async () => { await userEvent.click(await screen.findByRole('link', { name: /Marca d’água/ })) }

  it('marca d’água: busca por nome (sem acento), obra e pedaço da marca', async () => {
    const { api } = ambienteEntregas()
    montar(api)
    await abrirMarca()
    expect(await screen.findByText('Mostrando as últimas 2 entregas.')).toBeInTheDocument()
    const campo = screen.getByLabelText(/Buscar por cliente, obra ou marca/)
    await userEvent.type(campo, 'salao')
    expect(screen.getByText('Mostrando 1 de 2 entregas.')).toBeInTheDocument()
    expect(screen.getByText('cardapio')).toBeInTheDocument()
    expect(screen.queryByText('agenda-barbearia')).toBeNull()
    await userEvent.clear(campo)
    await userEvent.type(campo, 'AGENDA')
    expect(screen.getByText('Mostrando 1 de 2 entregas.')).toBeInTheDocument()
    await userEvent.clear(campo)
    await userEvent.type(campo, 'bbbb2222')
    expect(screen.getByText('agenda-barbearia')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Limpar e ver as últimas/ }))
    expect(screen.getByText('Mostrando as últimas 2 entregas.')).toBeInTheDocument()
  })

  it('marca d’água: marca inteira consulta o servidor e acha entrega antiga sem duplicar', async () => {
    const { api, chamadas } = ambienteEntregas()
    montar(api)
    await abrirMarca()
    await screen.findByText('Mostrando as últimas 2 entregas.')
    await userEvent.type(screen.getByLabelText(/Buscar por cliente, obra ou marca/), MARCA)
    await userEvent.click(screen.getByRole('button', { name: 'Procurar' }))
    expect(await screen.findByText('obra-antiga')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 3 entregas.')).toBeInTheDocument()
    expect(chamadas.filter((x) => x.url.endsWith('/admin/entregas')).at(-1)!.init.body).toBe(`{"marca":"${MARCA}"}`)
  })

  it('marca d’água: ajuda abre e fecha', async () => {
    const { api } = ambienteEntregas()
    montar(api)
    await abrirMarca()
    const det = (await screen.findByText('Onde encontro a marca?')).closest('details')!
    expect(det.open).toBe(false)
    await userEvent.click(screen.getByText('Onde encontro a marca?'))
    expect(det.open).toBe(true)
    expect(screen.getByText(/ATLAS_LICENCA/)).toBeInTheDocument()
    await userEvent.click(screen.getByText('Onde encontro a marca?'))
    expect(det.open).toBe(false)
  })

  it('marca d’água: “Ver este cliente” mostra os dados certos', async () => {
    const { api } = ambienteEntregas()
    montar(api)
    await abrirMarca()
    await screen.findByText('Mostrando as últimas 2 entregas.')
    await userEvent.click(screen.getByRole('button', { name: /Ver o cliente Barbearia do Zé/ }))
    const ficha = await screen.findByRole('group', { name: 'Dados de Zé' })
    expect(within(ficha).getByText('E-mail: ze@barbearia.com')).toBeInTheDocument()
    expect(within(ficha).getByText('Empresa: Barbearia do Zé')).toBeInTheDocument()
    expect(within(ficha).getByText(/Situação: /)).toBeInTheDocument()
    expect(within(ficha).getByText(/fale com este cliente/)).toBeInTheDocument()
  })

  it('a lista de clientes junta e-mail, ramo e cadastro (por licenca_id); sem cadastro mostra traço', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente((url) =>
      url.endsWith('/admin/cadastros')
        ? resp({ cadastros: [
            { licenca_id: 'l1', nome: 'Rafa', empresa: 'Pet Shop Amigo', ramo: 'pet shop', email: 'rafa@pet.com', cadastro_em: '2026-11-16T12:00:00.000Z', comprada_em: '2026-11-15T12:00:00.000Z', situacao: 'feito' },
            { licenca_id: 'l2', nome: 'Zé', empresa: 'Barbearia do Zé', ramo: 'barbearia', email: 'ze@barba.com', cadastro_em: null, comprada_em: '2026-11-14T12:00:00.000Z', situacao: 'pendente' },
          ] })
        : undefined,
    )
    montar(api)
    const clientes = await screen.findByRole('region', { name: 'Clientes' })
    expect(await within(clientes).findByText('rafa@pet.com')).toBeInTheDocument()
    expect(within(clientes).getByText('Feito em 16/11/2026')).toBeInTheDocument()
    expect(within(clientes).getByText('ze@barba.com')).toBeInTheDocument()
    expect(within(clientes).getByText('Ainda não respondeu')).toBeInTheDocument()
    const linhaBella = within(clientes).getByText('Salão Bella').closest('.ad-tabela') as HTMLElement
    expect(within(linhaBella).getAllByText('—').length).toBeGreaterThanOrEqual(2) // sem e-mail e sem cadastro
  })

  it('a aba Cadastros não existe mais; a aba Ações traz os 3 blocos (cortesia na aba própria)', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente()
    montar(api)
    expect(screen.queryByRole('link', { name: 'Cadastros' })).toBeNull()
    await irParaAcoes()
    expect(await screen.findByRole('region', { name: 'Teste grátis' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'E-mails temporários bloqueados' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /^Cortesias/ }))
    expect(screen.getByRole('region', { name: 'Liberar cortesia' })).toBeInTheDocument()
  })

  it('o painel de atenção abre, fecha com X e com Esc, e devolve o foco ao botão', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente()
    montar(api)
    const abrir = await screen.findByRole('button', { name: /Precisam de atenção/ })
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(abrir)
    const d = screen.getByRole('dialog', { name: 'Precisam de atenção' })
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(within(d).getByRole('button', { name: 'Fechar' })).toHaveFocus()
    await userEvent.click(within(d).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(abrir).toHaveFocus()
    await userEvent.click(abrir)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sem preferência salva o menu começa recolhido; o botão fica no rodapé', async () => {
    localStorage.clear()
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente()
    montar(api)
    await screen.findByRole('heading', { name: 'Visão geral' })
    expect(screen.queryByText('ADMINISTRADOR')).toBeNull()
    const b = screen.getByRole('button', { name: 'Abrir o menu' })
    expect(b.closest('.ad-eu')).not.toBeNull()
  })

  it('a gaveta trava a rolagem do fundo, fecha com Esc mesmo com o foco fora e prende o Tab', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente()
    montar(api)
    const abrir = await screen.findByRole('button', { name: /Precisam de atenção/ })
    expect(document.body.style.overflow).toBe('')
    await userEvent.click(abrir)
    const d = screen.getByRole('dialog', { name: 'Precisam de atenção' })
    expect(document.body.style.overflow).toBe('hidden')
    // foco fora do diálogo: o Tab traz de volta para dentro
    ;(document.activeElement as HTMLElement).blur()
    await userEvent.tab()
    expect(d.contains(document.activeElement)).toBe(true)
    // foco no body: Esc ainda fecha
    ;(document.activeElement as HTMLElement).blur()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(abrir).toHaveFocus()
  })

  it('o menu recolhe só com ícones, lembra a escolha e abre de novo', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente()
    const { unmount } = montar(api)
    await screen.findByRole('heading', { name: 'Visão geral' })
    expect(screen.getByText('ADMINISTRADOR')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Recolher o menu' }))
    expect(screen.queryByText('ADMINISTRADOR')).toBeNull()
    expect(screen.queryByText('luiz@atlas.com')).toBeNull()
    const link = screen.getByRole('link', { name: 'Fluxo de caixa' })
    expect(link).toHaveAttribute('title', 'Fluxo de caixa')
    expect(link.textContent).toBe('')
    expect(link.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Visão geral' })).toHaveAttribute('aria-current', 'page')
    expect(localStorage.getItem('atlas.admin.menu-recolhido')).toBe('1')
    unmount()
    montar(api)
    await screen.findByRole('heading', { name: 'Visão geral' })
    expect(screen.queryByText('ADMINISTRADOR')).toBeNull() // lembrou
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o menu' }))
    expect(screen.getByText('ADMINISTRADOR')).toBeInTheDocument()
    expect(localStorage.getItem('atlas.admin.menu-recolhido')).toBe('0')
  })
})

describe('paginação da lista de clientes', () => {
  const muitos: PainelAdmin = {
    ...PAINEL,
    clientes: Array.from({ length: 45 }, (_, n) => ({ licenca_id: `x${n}`, nome: `Pessoa ${n + 1}`, empresa: `Loja ${String(n + 1).padStart(2, '0')}`, ramo: 'loja', situacao: n < 25 ? ('em_dia' as const) : ('atrasada' as const), obras: 1, ultimo_sinal_em: null, travado_em: null })),
  }
  const abrir = async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente((url) => (url.endsWith('/admin/painel') ? resp(muitos) : undefined))
    montar(api)
    return await screen.findByRole('region', { name: 'Clientes' })
  }

  it('mostra 20 por vez, muda de página e desabilita nos extremos', async () => {
    const lista = await abrir()
    expect(within(lista).getByText('mostrando 1–20 de 45')).toBeInTheDocument()
    expect(within(lista).getAllByRole('button', { name: /^Liberar troca de/ })).toHaveLength(20)
    expect(within(lista).getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    await userEvent.click(within(lista).getByRole('button', { name: 'Próxima página' }))
    expect(within(lista).getByText('mostrando 21–40 de 45')).toBeInTheDocument()
    expect(within(lista).getByText('Loja 21')).toBeInTheDocument()
    expect(within(lista).queryByText('Loja 01')).toBeNull()
    await userEvent.click(within(lista).getByRole('button', { name: 'Próxima página' }))
    expect(within(lista).getByText('mostrando 41–45 de 45')).toBeInTheDocument()
    expect(within(lista).getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    await userEvent.click(within(lista).getByRole('button', { name: 'Página anterior' }))
    expect(within(lista).getByText('mostrando 21–40 de 45')).toBeInTheDocument()
  })

  it('trocar o filtro ou a busca volta para a página 1 e pagina só o que foi filtrado', async () => {
    const lista = await abrir()
    await userEvent.click(within(lista).getByRole('button', { name: 'Próxima página' }))
    await userEvent.selectOptions(within(lista).getByRole('combobox'), 'inadimplentes')
    expect(within(lista).getByText('mostrando 1–20 de 20')).toBeInTheDocument()
    expect(within(lista).getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    await userEvent.selectOptions(within(lista).getByRole('combobox'), 'todas')
    await userEvent.click(within(lista).getByRole('button', { name: 'Próxima página' }))
    await userEvent.type(within(lista).getByLabelText('Buscar por nome ou empresa'), 'Loja 3')
    expect(within(lista).getByText('mostrando 1–10 de 10')).toBeInTheDocument()
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

describe('aba Cortesias: mudar prazo, link novo e renovar a vencida', () => {
  const diaIso = (n: number) => new Date(Date.now() + n * 86400000).toISOString()
  const hojeBr = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)
  type Rota = (url: string, init?: RequestInit) => Response | undefined
  const abrirCom = async (cortesias: unknown[], extra: Rota = () => undefined) => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const amb = ambiente((url, init) => extra(url, init) ?? (url.endsWith('/admin/cortesias') ? resp({ ok: true, cortesias }) : undefined))
    montar(amb.api)
    await irParaCortesias()
    return { ...amb, lista: await screen.findByRole('region', { name: 'Cortesias' }) }
  }

  it('Ações separa em abas: Geral (teste grátis e bloqueios) e Cortesias (liberar e gerenciar)', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente((url) => (url.endsWith('/admin/cortesias') ? resp({ ok: true, cortesias: [] }) : undefined))
    montar(api)
    await irParaAcoes()
    expect(screen.getByRole('tab', { name: 'Geral' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('region', { name: 'Teste grátis' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Liberar cortesia' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: /^Cortesias/ }))
    expect(screen.getByRole('region', { name: 'Liberar cortesia' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Cortesias' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Teste grátis' })).toBeNull()
    expect(await screen.findByText('Nenhuma cortesia em vigor agora.')).toBeInTheDocument()
  })

  it('mudar prazo: tira dias (encurta) e salva sem mandar e-mail', async () => {
    const { lista, chamadas } = await abrirCom([{ email: 'amigo@x.com', nome: 'Amigo', validade_em: diaIso(20), vencida: false }],
      (url) => (url.endsWith('/admin/cortesia') ? resp({ ok: true, nova: false, validade_em: diaIso(13) }) : undefined))
    expect(await within(lista).findByText('amigo@x.com')).toBeInTheDocument()
    expect(within(lista).getByText(/faltam (19|20|21) dias/)).toBeInTheDocument()
    await userEvent.click(within(lista).getByRole('button', { name: 'Mudar prazo de amigo@x.com' }))
    const campo = within(lista).getByLabelText('Termina em') as HTMLInputElement
    const antes = campo.value
    await userEvent.click(within(lista).getByRole('button', { name: '−7 dias' }))
    expect(campo.value < antes).toBe(true)
    expect(campo.min).toBe(hojeBr())
    await userEvent.click(within(lista).getByRole('button', { name: 'Salvar prazo' }))
    await waitFor(() => expect(within(lista).getByRole('status')).toHaveTextContent(/Prazo de amigo@x\.com mudado: termina em \d\d\/\d\d\/\d{4}\./))
    const corpo = JSON.parse(String(chamadas.find((x) => x.url.endsWith('/admin/cortesia'))!.init.body))
    expect(corpo).toMatchObject({ email: 'amigo@x.com', silencioso: true })
    expect(corpo.validade_em).toMatch(/T02:59:59\.000Z$/)
    expect(new Date(corpo.validade_em).getTime()).toBeLessThan(new Date(diaIso(20)).getTime())
  })

  it('tirar dias não passa de hoje; somar não passa de 180 dias', async () => {
    const { lista } = await abrirCom([{ email: 'amigo@x.com', nome: 'Amigo', validade_em: diaIso(2), vencida: false }])
    await userEvent.click(await within(lista).findByRole('button', { name: 'Mudar prazo de amigo@x.com' }))
    const campo = within(lista).getByLabelText('Termina em') as HTMLInputElement
    await userEvent.click(within(lista).getByRole('button', { name: '−7 dias' }))
    expect(campo.value).toBe(campo.min)
    for (let i = 0; i < 7; i++) await userEvent.click(within(lista).getByRole('button', { name: '+30 dias' }))
    expect(campo.value).toBe(campo.max)
  })

  it('"Novo link": gera outro link (o e-mail vai de novo) e mostra para copiar', async () => {
    const { lista, chamadas } = await abrirCom([{ email: 'amigo@x.com', nome: 'Amigo', validade_em: diaIso(5), vencida: false }],
      (url) => (url.endsWith('/admin/cortesia/reenviar') ? resp({ ok: true, email_enviado: true, link: 'https://atlas-ia.app.br/instalar?t=abc' }) : undefined))
    await userEvent.click(await within(lista).findByRole('button', { name: 'Novo link para amigo@x.com' }))
    expect(await within(lista).findByText('https://atlas-ia.app.br/instalar?t=abc')).toBeInTheDocument()
    expect(within(lista).getByRole('status')).toHaveTextContent('Link novo gerado e e-mail reenviado para amigo@x.com.')
    expect(JSON.parse(String(chamadas.find((x) => x.url.endsWith('/admin/cortesia/reenviar'))!.init.body))).toEqual({ email: 'amigo@x.com' })
    expect(within(lista).getByRole('button', { name: 'Copiar link' })).toBeInTheDocument()
  })

  it('cortesia vencida: aparece em "Vencidas" e "Renovar" escolhe a nova data, renova e manda link novo', async () => {
    const { lista, chamadas } = await abrirCom([
      { email: 'ativo@x.com', nome: 'Ativo', validade_em: diaIso(5), vencida: false },
      { email: 'velho@x.com', nome: 'Velho', validade_em: diaIso(-4), vencida: true },
    ], (url) => (url.endsWith('/admin/cortesia') ? resp({ ok: true, nova: false, validade_em: diaIso(7), email_enviado: true, link: 'https://atlas-ia.app.br/instalar?t=novo' }) : undefined))
    expect(await within(lista).findByText('ativo@x.com')).toBeInTheDocument()
    expect(within(lista).queryByText('velho@x.com')).toBeNull()
    await userEvent.click(within(lista).getByRole('tab', { name: 'Vencidas 1' }))
    expect(within(lista).getByText('velho@x.com')).toBeInTheDocument()
    expect(within(lista).getByText(/venceu em \d\d\/\d\d\/\d{4}/)).toBeInTheDocument()
    expect(within(lista).queryByRole('button', { name: 'Novo link para velho@x.com' })).toBeNull()
    await userEvent.click(within(lista).getByRole('button', { name: 'Renovar velho@x.com' }))
    await userEvent.click(within(lista).getByRole('button', { name: '+7 dias' }))
    await userEvent.click(within(lista).getByRole('button', { name: 'Renovar e mandar o link' }))
    expect(await within(lista).findByText('https://atlas-ia.app.br/instalar?t=novo')).toBeInTheDocument()
    const corpo = JSON.parse(String(chamadas.find((x) => x.url.endsWith('/admin/cortesia'))!.init.body))
    expect(corpo.email).toBe('velho@x.com')
    expect(corpo.silencioso).toBeUndefined()
  })
})

describe('cortesia manual no painel', () => {
  it('mostra tipo e validade da cortesia na lista e libera uma nova (data vira fim do dia em Brasília)', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const comCortesia: PainelAdmin = { ...PAINEL, clientes: [...PAINEL.clientes, { licenca_id: 'l9', nome: 'Convidado', empresa: '', ramo: '', situacao: 'em_dia', obras: 0, ultimo_sinal_em: null, travado_em: null, tipo: 'cortesia', validade_em: '2026-11-30T02:59:59.000Z' }] }
    const { api, chamadas } = ambiente((url) => (url.endsWith('/admin/painel') ? resp(comCortesia) : url.endsWith('/admin/cortesia') ? resp({ ok: true, nova: true, validade_em: '2026-11-28T02:59:59.000Z' }) : undefined))
    montar(api)
    const clientes = await screen.findByRole('region', { name: 'Clientes' })
    expect(within(clientes).getByText(/Cortesia até 29\/11\/2026/)).toBeInTheDocument()
    await irParaCortesias()
    const form = screen.getByRole('region', { name: 'Liberar cortesia' })
    await userEvent.type(within(form).getByLabelText('E-mail da pessoa'), 'Amigo@Email.com')
    await userEvent.type(within(form).getByLabelText('Vale até'), '2026-11-27')
    await userEvent.click(within(form).getByRole('button', { name: 'Liberar cortesia' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cortesia liberada para amigo@email.com'))
    const c = chamadas.find((x) => x.url.endsWith('/admin/cortesia'))!
    expect(JSON.parse(String(c.init.body))).toEqual({ email: 'amigo@email.com', validade_em: '2026-11-28T02:59:59.000Z' })
  })

  it('dá para liberar cortesia só do dia: o calendário começa hoje (vale até 23:59 de hoje)', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente(() => undefined)
    montar(api)
    await irParaCortesias()
    const form = screen.getByRole('region', { name: 'Liberar cortesia' })
    const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10) // dia de hoje em Brasília
    expect(within(form).getByLabelText('Vale até')).toHaveAttribute('min', hoje)
    expect(within(form).getByText(/Pode ser só hoje/)).toBeInTheDocument()
  })

  it('e-mail enviado: lembra o gestor de avisar a pessoa sobre Promoções, Atualizações e spam', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente((url) => (url.endsWith('/admin/cortesia') ? resp({ ok: true, nova: true, validade_em: '2026-11-28T02:59:59.000Z', email_enviado: true }) : undefined))
    montar(api)
    await irParaCortesias()
    const form = screen.getByRole('region', { name: 'Liberar cortesia' })
    await userEvent.type(within(form).getByLabelText('E-mail da pessoa'), 'amigo@email.com')
    await userEvent.type(within(form).getByLabelText('Vale até'), '2026-11-27')
    await userEvent.click(within(form).getByRole('button', { name: 'Liberar cortesia' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Avisamos a pessoa por e-mail'))
    expect(screen.getByRole('status')).toHaveTextContent('Avise a pessoa: se não achar, olhar nas abas Promoções e Atualizações do Gmail e no spam.')
  })

  it('mostra o link de instalação com "Copiar link" (para mandar pelo WhatsApp se o e-mail cair no spam)', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const LINK = 'https://atlas-ia.app.br/instalar?t=abc123def456ghi789jkl'
    const { api } = ambiente((url) => (url.endsWith('/admin/cortesia') ? resp({ ok: true, nova: true, validade_em: '2026-11-28T02:59:59.000Z', email_enviado: false, link: LINK }) : undefined))
    const escrever = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true })
    montar(api)
    await irParaCortesias()
    const form = screen.getByRole('region', { name: 'Liberar cortesia' })
    await userEvent.type(within(form).getByLabelText('E-mail da pessoa'), 'dudu@gmail.com')
    await userEvent.type(within(form).getByLabelText('Vale até'), '2026-11-27')
    await userEvent.click(within(form).getByRole('button', { name: 'Liberar cortesia' }))
    expect(await within(form).findByText(LINK)).toBeInTheDocument()
    expect(within(form).getByText(/funciona uma vez.*o mais novo/)).toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: 'Copiar link' }))
    expect(escrever).toHaveBeenCalledWith(LINK)
    expect(await within(form).findByRole('button', { name: 'Link copiado ✓' })).toBeInTheDocument()
  })

  it('se o servidor recusar, mostra o erro e NÃO diz que liberou', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api } = ambiente((url) => (url.endsWith('/admin/cortesia') ? resp({ erro: 'ja_tem_licenca_paga', mensagem: 'Essa pessoa já tem uma licença paga. Não precisa de cortesia.' }, 409) : undefined))
    montar(api)
    await irParaCortesias()
    const form = await screen.findByRole('region', { name: 'Liberar cortesia' })
    await userEvent.type(within(form).getByLabelText('E-mail da pessoa'), 'ana@loja.com')
    await userEvent.type(within(form).getByLabelText('Vale até'), '2026-11-27')
    await userEvent.click(within(form).getByRole('button', { name: 'Liberar cortesia' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('já tem uma licença paga')
    expect(screen.queryByText(/Cortesia liberada/)).toBeNull()
  })
})

describe('teste grátis (degustação) no painel', () => {
  it('mostra o estado atual e liga com um clique; o servidor decide', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    const { api, chamadas } = ambiente((url, init) => {
      if (!url.endsWith('/admin/degustacao')) return undefined
      const corpo = JSON.parse(String(init.body)) as { ativa?: boolean }
      return resp({ ok: true, ativa: corpo.ativa ?? false, dias: 5 })
    })
    montar(api)
    await irParaAcoes()
    const sec = await screen.findByRole('region', { name: 'Teste grátis' })
    expect(await within(sec).findByText('Desligado')).toBeInTheDocument()
    await userEvent.click(within(sec).getByRole('button', { name: 'Ligar o teste grátis' }))
    expect(await within(sec).findByText('Ligado')).toBeInTheDocument()
    const c = chamadas.filter((x) => x.url.endsWith('/admin/degustacao')).pop()!
    expect(JSON.parse(String(c.init.body))).toEqual({ ativa: true })
  })

  it('se o servidor recusar, mostra o erro e mantém o estado', async () => {
    sessionStorage.setItem(CHAVE_SESSAO_ADMIN, 'jwt-luiz')
    let n = 0
    const { api } = ambiente((url) => (url.endsWith('/admin/degustacao') ? (n++ === 0 ? resp({ ok: true, ativa: false, dias: 5 }) : resp({ erro: 'dias_invalidos', mensagem: 'O teste pode durar de 1 a 30 dias.' }, 400)) : undefined))
    montar(api)
    await irParaAcoes()
    const sec = await screen.findByRole('region', { name: 'Teste grátis' })
    await within(sec).findByText('Desligado')
    await userEvent.click(within(sec).getByRole('button', { name: 'Ligar o teste grátis' }))
    expect(await within(sec).findByRole('alert')).toHaveTextContent('1 a 30 dias')
    expect(within(sec).getByText('Desligado')).toBeInTheDocument()
  })
})
