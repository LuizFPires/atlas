import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Shell } from './Shell'
import { TemaProvider } from '../tema/tema'

test('mostra itens, marca o ativo e tem um botão só: Falar com o Atlas', async () => {
  const onNavegar = vi.fn(), onFalar = vi.fn()
  render(<Shell ativo="obras" onNavegar={onNavegar} onFalar={onFalar} />)
  expect(screen.getAllByRole('link').map((l) => l.textContent?.trim())).toEqual(['Nova obra', 'Canteiro de obras', 'Obras concluídas', 'Lançamentos'])
  expect(screen.getByRole('link', { name: 'Nova obra' })).toHaveAttribute('aria-current', 'page')
  await userEvent.click(screen.getByRole('button', { name: /Falar com o Atlas/ }))
  expect(onFalar).toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: /Ajuda do Atlas/ })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Obras concluídas' }))
  expect(onNavegar).toHaveBeenCalledWith('concluidas')
})

test('telas de dentro da obra (protótipo, obra, pós-obra) acendem o Canteiro de obras no menu', () => {
  render(<Shell ativo="prototipo" onNavegar={() => {}} onFalar={() => {}} />)
  expect(screen.getByRole('link', { name: 'Canteiro de obras' })).toHaveAttribute('aria-current', 'page')
})

test('no tema claro usa o monograma de fundo claro', async () => {
  const { TemaProvider } = await import('../tema/tema')
  const { default: claro } = await import('../assets/monograma-fundo-claro.png')
  const { default: escuro } = await import('../assets/monograma-fundo-escuro.png')
  localStorage.setItem('atlas.tema', 'claro')
  const { container, unmount } = render(<TemaProvider><Shell ativo="ajuda" onNavegar={() => {}} onFalar={() => {}} /></TemaProvider>)
  expect(container.querySelector('.at-lateral__marca img')).toHaveAttribute('src', claro)
  unmount()
  localStorage.setItem('atlas.tema', 'escuro')
  const r = render(<TemaProvider><Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} /></TemaProvider>)
  expect(r.container.querySelector('.at-lateral__marca img')).toHaveAttribute('src', escuro)
  localStorage.removeItem('atlas.tema')
})

// ---- cartão da licença (contador do teste) ----------------------------------------------------------------------------------

test('sem dado de licença, ou com licença paga: a linha de sempre, sem botão de compra', () => {
  const { rerender } = render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} />)
  expect(screen.getByText('Licença ativa · este computador')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Quero o Atlas' })).toBeNull()
  rerender(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} licenca={{ estado: 'ativa' }} onComprar={() => {}} />)
  expect(screen.getByText('Licença ativa · este computador')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Quero o Atlas' })).toBeNull()
})

test('licença paga nos 7 dias de arrependimento: mostra quando a entrega em produção libera', () => {
  const { rerender } = render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} licenca={{ estado: 'ativa', entrega: 'Entrega em produção libera em 25/11' }} />)
  expect(screen.getByText('Licença ativa · este computador')).toBeInTheDocument()
  expect(screen.getByText('Entrega em produção libera em 25/11')).toBeInTheDocument()
  rerender(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} licenca={{ estado: 'ativa' }} />)
  expect(screen.queryByText(/Entrega em produção libera/)).toBeNull()
})

test('teste em andamento: rótulo, quanto falta, quando vence e o botão de compra', async () => {
  const onComprar = vi.fn()
  render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} licenca={{ estado: 'contando', rotulo: 'TESTE GRÁTIS', titulo: 'Faltam 3 dias', sub: 'Vence em 24/11' }} onComprar={onComprar} />)
  const cartao = screen.getByRole('status', { name: 'Seu acesso ao Atlas' })
  expect(cartao).toHaveTextContent('TESTE GRÁTIS')
  expect(cartao).toHaveTextContent('Faltam 3 dias')
  expect(cartao).toHaveTextContent('Vence em 24/11')
  expect(screen.queryByText('Licença ativa · este computador')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Quero o Atlas' }))
  expect(onComprar).toHaveBeenCalledTimes(1)
})

test('teste vencido: avisa que acabou e mantém o botão', () => {
  render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} licenca={{ estado: 'vencida', rotulo: 'TESTE GRÁTIS', titulo: 'Seu teste acabou', sub: null }} onComprar={() => {}} />)
  expect(screen.getByRole('status', { name: 'Seu acesso ao Atlas' })).toHaveTextContent('Seu teste acabou')
  expect(screen.getByRole('button', { name: 'Quero o Atlas' })).toBeInTheDocument()
})

test('cartão do plano: mostra só o que o app leu do Claude; nunca cota ou horário inventados', () => {
  const { rerender } = render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} plano={{ valor: 'Ultra', sub: 'Conectado neste computador' }} />)
  expect(screen.getByText('Ultra')).toBeInTheDocument()
  expect(screen.getByText('Conectado neste computador')).toBeInTheDocument()
  expect(screen.queryByText(/64% da cota|Renova hoje/)).toBeNull()
  rerender(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} />)
  expect(screen.queryByText('Plano Claude')).toBeNull()
  expect(screen.queryByText(/64% da cota|Renova hoje/)).toBeNull()
})

test('Claude não conectado: o cartão do plano leva a conectar o Claude', async () => {
  const conectar = vi.fn()
  render(<TemaProvider><Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} plano={{ valor: 'Não conectado', sub: 'Conecte o Claude para construir' }} onConectarClaude={conectar}><p>x</p></Shell></TemaProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Conectar o Claude' }))
  expect(conectar).toHaveBeenCalled()
})

test('a faixa do topo (ex.: nova versão) vem antes do conteúdo da tela', () => {
  const { container } = render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} topo={<p>faixa</p>}><h1>tela</h1></Shell>)
  const main = container.querySelector('main.at-conteudo')!
  expect(main.firstElementChild).toHaveTextContent('faixa')
})

// Luiz, 24/11/2026: "colocar ícones para esses menus e tornar esse menu lateral colapsável ... por default, ele deveria vir colapsado".
describe('menu recolhível', () => {
  beforeEach(() => localStorage.removeItem('atlas:menu:aberto'))

  test('vem recolhido: só ícones, com o nome no aviso do mouse; o botão abre e a escolha fica guardada', async () => {
    const { container, unmount } = render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} />)
    const lateral = container.querySelector('.at-lateral')!
    expect(lateral).toHaveClass('at-lateral--recolhida')
    expect(container.querySelectorAll('.at-item svg')).toHaveLength(4)
    expect(screen.getByRole('link', { name: 'Canteiro de obras' })).toHaveAttribute('title', 'Canteiro de obras')
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o menu' }))
    expect(lateral).not.toHaveClass('at-lateral--recolhida')
    expect(screen.getByRole('button', { name: 'Recolher o menu' })).toHaveAttribute('aria-expanded', 'true')
    unmount()
    const r = render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} />)
    expect(r.container.querySelector('.at-lateral')).not.toHaveClass('at-lateral--recolhida')
  })

  test('recolhido, o prazo da cortesia continua à vista (só o número de dias)', () => {
    const { container } = render(<Shell ativo="obras" onNavegar={() => {}} onFalar={() => {}} licenca={{ estado: 'contando', rotulo: 'CORTESIA', titulo: 'Faltam 5 dias', sub: 'Vence em 28/11' }} />)
    expect(container.querySelector('.at-teste__curto')).toHaveTextContent('5d')
  })
})
