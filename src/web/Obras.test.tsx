import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { MinhasObras } from './Obras'
import { Portal } from './Portal'
import { criarPortalApi, CHAVE_SESSAO, type ConfigPortal } from './portal-api'
import { criarStatusObrasFixture, OBRAS_EXEMPLO, statusObrasIndisponivel } from './obras-status'

const doTema = (ui: React.ReactElement) => render(<TemaProvider>{ui}</TemaProvider>)

describe('porta PonteStatusObras (fixture)', () => {
  test('lista e busca por id devolvem cópias; id que não é do dono vira null', async () => {
    const f = criarStatusObrasFixture()
    const lista = await f.listarObras()
    expect(lista).toHaveLength(3)
    lista[0].nome = 'mexi'
    expect((await f.listarObras())[0].nome).toBe('Agenda da Barbearia')
    expect((await f.obra('o2'))?.estado).toBe('pronta')
    expect(await f.obra('de-outro-dono')).toBeNull()
    expect(f.pedidos).toBe(2)
  })

  test('o modelo é só resumo: no máximo uma obra ativa, percentual de 0 a 100, sem campos internos', () => {
    expect(OBRAS_EXEMPLO.filter((o) => o.ativa_agora).length).toBeLessThanOrEqual(1)
    const permitidos = ['id', 'nome', 'segmento', 'etapa_atual', 'total_etapas', 'percentual', 'estado', 'ativa_agora', 'ultima_noticia', 'quando']
    for (const o of OBRAS_EXEMPLO) {
      expect(o.percentual).toBeGreaterThanOrEqual(0)
      expect(o.percentual).toBeLessThanOrEqual(100)
      expect(Object.keys(o).every((k) => permitidos.includes(k))).toBe(true)
    }
  })
})

describe('Minhas obras', () => {
  test('lista com nome, selo de estado, porcentagem e a obra ativa agora', async () => {
    doTema(<MinhasObras ponte={criarStatusObrasFixture()} />)
    const barbearia = await screen.findByRole('button', { name: 'Abrir a obra Agenda da Barbearia' })
    expect(within(barbearia).getByText(/Construindo/)).toBeInTheDocument()
    expect(within(barbearia).getByText(/Sendo construída agora/)).toBeInTheDocument()
    expect(within(barbearia).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
    const estoque = screen.getByRole('button', { name: 'Abrir a obra Controle de Estoque' })
    expect(within(estoque).getByText(/Pronta/)).toBeInTheDocument()
    expect(within(estoque).queryByText(/Sendo construída agora/)).toBeNull()
    expect(screen.getAllByText(/Sendo construída agora/)).toHaveLength(1)
  })

  test('sem obras: mensagem amiga', async () => {
    doTema(<MinhasObras ponte={statusObrasIndisponivel} />)
    expect(await screen.findByText(/ainda não tem obras/)).toBeInTheDocument()
  })

  test('falha ao buscar: aviso, sem quebrar', async () => {
    doTema(<MinhasObras ponte={{ listarObras: async () => { throw new Error('x') }, obra: async () => null }} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não consegui buscar')
  })

  test('detalhe: prédio em 3D, linha do tempo e última notícia; dá para voltar', async () => {
    doTema(<MinhasObras ponte={criarStatusObrasFixture()} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir a obra Agenda da Barbearia' }))
    expect(screen.getByRole('heading', { name: 'Agenda da Barbearia' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Prédio em 3D com 3 de 5 andares/ })).toHaveAttribute('data-feitos', '3')
    const etapas = within(screen.getByRole('list', { name: 'Etapas da obra' })).getAllByRole('listitem')
    expect(etapas).toHaveLength(5)
    expect(etapas[2]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText(/Terminei a tela onde o cliente escolhe o horário/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Voltar para as obras/ }))
    expect(await screen.findByRole('button', { name: 'Abrir a obra Controle de Estoque' })).toBeInTheDocument()
  })

  test('obra pronta: todas as etapas marcadas como prontas', async () => {
    doTema(<MinhasObras ponte={criarStatusObrasFixture()} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir a obra Controle de Estoque' }))
    expect(screen.getByRole('img', { name: /4 de 4 andares/ })).toBeInTheDocument()
    expect(screen.getAllByText(/\(pronta\)/)).toHaveLength(4)
  })
})

describe('Minhas obras dentro do Portal', () => {
  test('aparece na conta logada, sem tirar licença e pagamentos', async () => {
    sessionStorage.setItem(CHAVE_SESSAO, 'jwt')
    const cfg: ConfigPortal = { api: 'https://api.test', authUrl: 'https://auth.test/auth/v1', anonKey: 'anon' }
    const perfil = { nome: 'Zé', empresa: 'B', email: 'z@b.com' }
    const conta = {
      perfil,
      licenca: { status: 'ativa', comprada_em: null, mensalidade_valor: 99, mensalidade_ativa: true, mensalidade_encerra_em: null, proxima_cobranca_em: null, arrependimento_ate: null, pode_cancelar_compra: false, pode_cancelar_mensalidade: false, pode_mudar_pagamento: false },
      computador: null, troca: { pode_agora: true, proxima_troca_em: null }, pagamentos: [],
    }
    const f = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (String(url).endsWith('/portal/conta') ? conta : perfil) }) as Response)
    doTema(<Portal api={criarPortalApi(cfg, f as unknown as typeof fetch)} obras={criarStatusObrasFixture()} />)
    expect(await screen.findByRole('button', { name: 'Abrir a obra Cardápio Digital' })).toBeInTheDocument()
    expect(screen.getByText('Licença')).toBeInTheDocument()
    expect(screen.getByText('Pagamentos')).toBeInTheDocument()
    sessionStorage.clear()
  })
})
