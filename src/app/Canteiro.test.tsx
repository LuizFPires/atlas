import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Canteiro } from './Canteiro'
import type { PonteObras } from './ponte-obras'
import type { SituacaoObra } from './fase-obra'

const S = (o: Partial<SituacaoObra>): SituacaoObra => ({ estilo: false, prototipo: false, marca: false, plano: false, ...o })
const SITUACOES: Record<string, SituacaoObra> = {
  'academia-do-ze': S({ estilo: true }),
  'meu-ponto': S({ estilo: true, prototipo: true, marca: true, plano: true }),
  'barbearia-do-ze': S({ estilo: true, prototipo: true, marca: true, plano: true }),
  'orcamentos-rapidos': S({}),
}
const PCT: Record<string, number> = { 'meu-ponto': 64, 'barbearia-do-ze': 100 }
const ponte = { listar: async () => Object.keys(SITUACOES), situacao: async (p: string) => SITUACOES[p], raiz: () => 'C:\\x', abrirPasta: async () => {}, criarSubpasta: async () => { throw new Error('x') } } as unknown as PonteObras
const painel = { ler: async (p: string) => ({ pct: PCT[p] ?? 0 }) }

test('Canteiro: só as obras vivas (inacabadas primeiro), com o que falta e o próximo passo; a pronta não aparece', async () => {
  render(<Canteiro modo="canteiro" obras={ponte} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
  const cartoes = await screen.findAllByRole('article')
  expect(cartoes.map((c) => c.getAttribute('aria-label'))).toEqual([
    expect.stringMatching(/^Academia do ze/), expect.stringMatching(/^Orcamentos rapidos/), expect.stringMatching(/^Meu ponto/),
  ])
  expect(within(cartoes[0]).getByText(/FALTA TERMINAR · ETAPA 3 DE 6/)).toBeInTheDocument()
  expect(within(cartoes[0]).getByText(/Próximo: escolher o nome/)).toBeInTheDocument()
  expect(within(cartoes[1]).getByText(/Próximo: escolher o visual/)).toBeInTheDocument()
  // Luiz, 24/11: a capa da obra que falta terminar é a placa de obra "EM BREVE", com o nome e onde paramos.
  const placa = cartoes[0].querySelector('.at-ct__placa')!
  expect(placa.textContent).toContain('EM BREVE')
  expect(placa.textContent).toContain('Academia do ze')
  expect(placa.textContent).toContain('(paramos no nome)')
  expect(cartoes[1].querySelector('.at-ct__placa')!.textContent).toContain('(paramos no visual)')
  expect(within(cartoes[2]).getByText('64,00%')).toBeInTheDocument()
  expect(screen.queryByText(/Barbearia do ze/)).toBeNull()
})

test('Canteiro: filtro e busca pelo nome', async () => {
  const user = userEvent.setup()
  render(<Canteiro modo="canteiro" obras={ponte} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
  await screen.findAllByRole('article')
  expect(screen.getByRole('button', { name: /Falta terminar 2/ })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Em construção 1/ }))
  expect(screen.getAllByRole('article')).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: /Todas 3/ }))
  await user.type(screen.getByRole('searchbox', { name: 'Buscar obra pelo nome' }), 'orça')
  expect(screen.getAllByRole('article').map((c) => c.getAttribute('aria-label'))).toEqual([expect.stringMatching(/^Orcamentos rapidos/)])
})

test('clicar no cartão abre a obra na etapa em que ela está; "Nova obra" leva ao começo', async () => {
  const user = userEvent.setup()
  const onAbrir = vi.fn()
  const onNova = vi.fn()
  render(<Canteiro modo="canteiro" obras={ponte} painel={painel} onAbrir={onAbrir} onNova={onNova} />)
  const [primeiro] = await screen.findAllByRole('article')
  await user.click(within(primeiro).getByRole('button'))
  expect(onAbrir).toHaveBeenCalledWith({ pasta: 'academia-do-ze', nome: 'Academia do ze', etapa: 'batismo' })
  await user.click(screen.getByRole('button', { name: /Nova obra/ }))
  expect(onNova).toHaveBeenCalled()
})

test('Obras concluídas: só as prontas, com o selo No ar', async () => {
  render(<Canteiro modo="concluidas" obras={ponte} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
  const cartoes = await screen.findAllByRole('article')
  expect(cartoes).toHaveLength(1)
  expect(within(cartoes[0]).getByText('NO AR')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Prontas e no ar' })).toBeInTheDocument()
})

test('sem obras: o Canteiro convida a começar a primeira', async () => {
  const vazia = { ...ponte, listar: async () => [] } as PonteObras
  render(<Canteiro modo="canteiro" obras={vazia} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
  expect(await screen.findByText(/Nenhuma obra no canteiro ainda/)).toBeInTheDocument()
})

describe('situação de cada obra em construção no cartão (K1Canteiro)', () => {
  const SIT: Record<string, SituacaoObra> = { a: S({ estilo: true, prototipo: true, marca: true, plano: true }), b: S({ estilo: true, prototipo: true, marca: true, plano: true }), c: S({ estilo: true, prototipo: true, marca: true, plano: true }), d: S({ estilo: true, prototipo: true, marca: true, plano: true }), e: S({ estilo: true, prototipo: true, marca: true, plano: true }) }
  const obras4 = { listar: async () => Object.keys(SIT), situacao: async (p: string) => SIT[p] } as unknown as PonteObras
  const base = { pct: 50, parada: null, pausadaPorVoce: false, agora: [] as { sigla: string; quem: string; oque: string; tom: 'ativo' | 'espera' }[] }
  const LER: Record<string, object> = {
    a: { ...base, agora: [{ sigla: 'IM', quem: 'Implementador', oque: 'a tela de relatórios do mês', tom: 'ativo' }] },
    b: { ...base, parada: 'cota' },
    c: { ...base, parada: 'voce' },
    d: { ...base, pausadaPorVoce: true },
    e: { ...base },
  }
  const painel2 = { ler: async (p: string) => LER[p] as { pct: number } }
  const retomar = { obraEmAndamento: async () => ({ nome: 'E', pasta: 'e', pct: 50, etapa: null, paradaEm: new Date(Date.now() - 3 * 3600_000).toISOString() }), continuar: vi.fn(async () => {}) }

  test('trabalhando, esperando o Claude, precisa de você, pausada e parada (computador desligado)', async () => {
    render(<Canteiro modo="canteiro" obras={obras4} painel={painel2} retomar={retomar} onAbrir={() => {}} onNova={() => {}} />)
    const c = (n: string) => screen.findByRole('article', { name: new RegExp(`^${n}:`) })
    expect(await c('A')).toHaveTextContent(/TRABALHANDO AGORA.*Trabalhando agora: a tela de relatórios do mês/)
    expect(await c('B')).toHaveTextContent(/ESPERANDO O CLAUDE.*O limite do Claude acabou. A obra volta sozinha/)
    expect(await c('C')).toHaveTextContent(/PRECISA DE VOCÊ.*Responder/)
    expect(await c('D')).toHaveTextContent(/PAUSADA POR VOCÊ.*Continuar obra/)
    expect(await c('E')).toHaveTextContent(/PARADA.*quando o computador desligou.*Continuar obra/)
  })

  test('na obra parada, o clique religa a obra (um clique) e abre', async () => {
    const onAbrir = vi.fn()
    render(<Canteiro modo="canteiro" obras={obras4} painel={painel2} retomar={retomar} onAbrir={onAbrir} onNova={() => {}} />)
    const e = await screen.findByRole('article', { name: /^E:/ })
    await userEvent.click(within(e).getByRole('button'))
    expect(retomar.continuar).toHaveBeenCalledWith({ pasta: 'e' })
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ pasta: 'e', etapa: 'obra' }))
  })
})

describe('excluir obra (Luiz, 23/11/2026)', () => {
  test('lixeira em cada obra do Canteiro; pede confirmação avisando que não tem volta; exclui e some da lista', async () => {
    const excluidas: string[] = []
    const comExcluir = { ...ponte, excluir: async (p: string) => { excluidas.push(p) } } as PonteObras
    render(<Canteiro modo="canteiro" obras={comExcluir} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
    const cartao = await screen.findByRole('article', { name: /^Academia do ze/ })
    await userEvent.click(within(cartao).getByRole('button', { name: 'Excluir a obra Academia do ze' }))
    const dlg = screen.getByRole('alertdialog', { name: 'Excluir a obra "Academia do ze"?' })
    expect(dlg).toHaveTextContent(/não tem volta/i)
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    expect(excluidas).toEqual([])
    await userEvent.click(within(cartao).getByRole('button', { name: 'Excluir a obra Academia do ze' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir para sempre' }))
    expect(excluidas).toEqual(['academia-do-ze'])
    expect(screen.queryByRole('article', { name: /^Academia do ze/ })).toBeNull()
  })

  test('obra concluída nunca tem lixeira', async () => {
    const comExcluir = { ...ponte, excluir: async () => {} } as PonteObras
    render(<Canteiro modo="concluidas" obras={comExcluir} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
    const [c] = await screen.findAllByRole('article')
    expect(within(c).queryByRole('button', { name: /Excluir/ })).toBeNull()
  })
})

test('Canteiro com trava: o cartão diz qual conta e quando volta; a que precisa de você abre um aviso uma vez, com "Resolver"', async () => {
  const user = userEvent.setup()
  const sit = { 'loja-da-ana': S({ estilo: true, prototipo: true, marca: true, plano: true }), 'agenda-da-clinica': S({ estilo: true, prototipo: true, marca: true, plano: true }) }
  const obras = { ...ponte, listar: async () => Object.keys(sit), situacao: async (p: string) => sit[p as keyof typeof sit] } as unknown as PonteObras
  const travas = {
    'loja-da-ana': { id: 2, tipo: 'supabase-dormindo' as const, servico: 'Supabase' as const, liberaEm: null },
    'agenda-da-clinica': { id: 1, tipo: 'vercel-limite' as const, servico: 'Vercel' as const, liberaEm: null },
  }
  const onAbrir = vi.fn()
  render(<Canteiro modo="canteiro" obras={obras} painel={{ ler: async (p: string) => ({ pct: 40, trava: travas[p as keyof typeof travas] }) }} onAbrir={onAbrir} onNova={() => {}} />)
  const aviso = await screen.findByRole('dialog', { name: /enquanto você estava fora/i })
  expect(within(aviso).getByText(/Loja da ana · precisa de você/)).toBeInTheDocument()
  expect(within(aviso).getByText(/Agenda da clinica · publica amanhã, sozinho/)).toBeInTheDocument()
  await user.click(within(aviso).getByRole('button', { name: /Resolver Loja da ana/ }))
  expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ pasta: 'loja-da-ana', etapa: 'obra' }))
  const cartoes = screen.getAllByRole('article')
  expect(within(cartoes.find((c) => /Loja/.test(c.getAttribute('aria-label') ?? ''))!).getByText('PRECISA DE VOCÊ · 1 CLIQUE')).toBeInTheDocument()
  expect(screen.getByText('PUBLICA AMANHÃ · SOZINHO')).toBeInTheDocument()
})

// M51 (Q4Canteiro): quem trabalha, quem espera na fila, e "Mudar a ordem".
test('Canteiro com fila: o selo NA FILA, a faixa "1 trabalhando, 1 na fila" e mudar a ordem para ao mesmo tempo', async () => {
  const user = userEvent.setup()
  const naFila = { depoisDe: 'meu-ponto', nome: 'Meu ponto' }
  const SIT2: Record<string, SituacaoObra> = { 'meu-ponto': SITUACOES['meu-ponto'], estoque: S({ estilo: true, prototipo: true, marca: true, plano: true }) }
  const ponte2 = { ...ponte, listar: async () => Object.keys(SIT2), situacao: async (p: string) => SIT2[p] } as unknown as PonteObras
  const painel2 = { ler: async (p: string) => (p === 'estoque' ? { pct: 0, naFila } : { pct: 64, agora: [{ sigla: 'IM', quem: 'Equipe', oque: 'a tela do mês', tom: 'ativo' as const }] }) }
  const mudarVez = vi.fn(async () => {})
  const construcao = { fila: async () => ({ trabalhando: [{ pasta: 'meu-ponto', nome: 'Meu ponto', restanteMin: 600 }], fila: [{ pasta: 'estoque', depoisDe: 'meu-ponto' }], juntas: [] }), mudarVez }
  render(<Canteiro modo="canteiro" obras={ponte2} painel={painel2} construcao={construcao} plano="pro" onAbrir={() => {}} onNova={() => {}} />)
  const faixa = await screen.findByRole('region', { name: 'Como as obras estão dividindo o Claude' })
  expect(faixa).toHaveTextContent('1 obra trabalhando, 1 na fila')
  expect(faixa).toHaveTextContent('Estoque começa sozinha quando Meu ponto ficar pronta')
  const estoque = screen.getAllByRole('article').find((a) => /^Estoque/.test(a.getAttribute('aria-label') ?? ''))!
  expect(within(estoque).getByText('NA FILA')).toBeInTheDocument()
  await user.click(within(faixa).getByRole('button', { name: 'Mudar a ordem' }))
  const dialogo = await screen.findByRole('dialog', { name: 'Como começar esta obra' })
  await user.click(within(dialogo).getAllByRole('radio')[1])
  await user.click(within(dialogo).getByRole('button', { name: 'Começar ao mesmo tempo →' }))
  expect(mudarVez).toHaveBeenCalledWith('estoque', 'juntas')
})

test('Obras concluídas: o cartão mostra o endereço e o dia em que ficou pronta', async () => {
  const comEnd = { ...ponte, situacao: async (p: string) => (p === 'barbearia-do-ze' ? { ...SITUACOES[p], noAr: { endereco: 'barbeariadoze.app.br', quando: '2026-10-28T15:00:00.000Z' } } : SITUACOES[p]) } as unknown as PonteObras
  render(<Canteiro modo="concluidas" obras={comEnd} painel={painel} onAbrir={() => {}} onNova={() => {}} />)
  const [c] = await screen.findAllByRole('article')
  expect(within(c).getByText('barbeariadoze.app.br')).toBeInTheDocument()
  expect(within(c).getByText('Concluída em 28/10')).toBeInTheDocument()
})

test('retrato do canteiro: com o mouse em cima a obra fica ao vivo; ao sair, volta a ficar parada', async () => {
  const vivo = { ...painel, enderecoCanteiro: (p: string) => (p === 'meu-ponto' ? 'http://127.0.0.1:4321/' : null) }
  render(<Canteiro modo="canteiro" obras={ponte} painel={vivo} onAbrir={() => {}} onNova={() => {}} />)
  const cartao = await screen.findByRole('article', { name: /Meu ponto/ })
  expect(screen.getByText('Passe o mouse num cartão para ver a obra ao vivo')).toBeInTheDocument()
  expect(cartao.querySelector('iframe')).toBeNull()
  await userEvent.hover(cartao)
  expect(cartao.querySelector('iframe')).not.toBeNull()
  expect(within(cartao).getByText('AO VIVO')).toBeInTheDocument()
})
