import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Vendas } from './Vendas'

const montar = (onComprar = vi.fn()) => {
  const r = render(<TemaProvider><Vendas onComprar={onComprar} /></TemaProvider>)
  return { onComprar, ...r }
}

test('mostra as seções da página de vendas e o preço confirmado', () => {
  montar()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sem saber programar')
  for (const t of ['Se dá para explicar, dá para construir.', 'Fazer um sistema é igual construir uma casa.', 'Perguntas de quem nunca programou']) {
    expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
  }
  expect(screen.getByText('R$ 4.800')).toBeInTheDocument()
  expect(screen.getByText(/Espaço para depoimentos reais/)).toBeInTheDocument()
  expect(screen.getAllByAltText(/canteiro 3D/i).length).toBeGreaterThan(0)
})

test('os botões de compra chamam onComprar', async () => {
  const { onComprar } = montar()
  await userEvent.click(screen.getAllByRole('button', { name: /Quero construir o meu/ })[0])
  expect(onComprar).toHaveBeenCalled()
})

test('não usa emoji nem promete atendimento humano', () => {
  const { container } = montar()
  expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
  expect(container.textContent).not.toMatch(/atendente|suporte humano|falar com (uma )?pessoa/i)
})

test('vitrine Comece pronto: 4 segmentos, preço e botão que abre a compra do segmento', async () => {
  const onComprarPronto = vi.fn()
  render(<TemaProvider><Vendas onComprar={vi.fn()} onComprarPronto={onComprarPronto} /></TemaProvider>)
  for (const n of ['Barbearia', 'Restaurante', 'Mercearia', 'Academia']) expect(screen.getByRole('button', { name: `Começar pronto: ${n}` })).toBeInTheDocument()
  expect(screen.getAllByText('R$ 7.300')).toHaveLength(4)
  expect(screen.getByText(/de uma empresa só/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Começar pronto: Mercearia' }))
  expect(onComprarPronto).toHaveBeenCalledWith('mercearia')
})

test('perto do preço: o Atlas só funciona com uma assinatura do Claude, paga à parte, e plano maior anda mais rápido', () => {
  render(<Vendas onComprar={() => {}} />)
  const aviso = screen.getByRole('note', { name: 'Assinatura do Claude' })
  expect(aviso).toHaveTextContent('O Atlas só funciona com uma assinatura do Claude')
  expect(aviso).toHaveTextContent('paga direto à Anthropic, à parte do Atlas')
  expect(aviso).toHaveTextContent('Quanto maior o plano, mais rápido a obra anda')
  expect(aviso).not.toHaveTextContent(/plano Pro|no Max/)
})

test('dúvidas explicam quando o sistema vai para o ar: prévia desde o 1º dia, publicação a partir do 8º dia da compra', () => {
  montar()
  const p = screen.getByText('Quando o meu sistema vai para o ar?')
  expect(p.parentElement).toHaveTextContent('prévia desde o primeiro dia')
  expect(p.parentElement).toHaveTextContent('a partir do 8º dia da compra')
})

test('seção dos agentes: o mestre de obras coordena especialistas de mesa limpa, e a conta de tokens aparece com premissas', () => {
  montar()
  const sec = screen.getByRole('region', { name: 'Como o Atlas trabalha por dentro' })
  expect(within(sec).getByRole('heading', { name: 'O mestre de obras não carrega a obra inteira na cabeça.' })).toBeInTheDocument()
  const desenhos = within(sec).getAllByRole('img', { name: /Mestre de obras no centro/ }) // um para computador, outro para celular
  expect(desenhos).toHaveLength(2)
  for (const d of desenhos) for (const quem of ['Arquiteta', 'Equipe de execução', 'Inspetor de qualidade', 'Técnico de segurança', 'Eng. de desempenho', 'Despachante']) expect(d).toHaveTextContent(quem)
  expect(sec).toHaveTextContent('22 milhões')
  expect(sec).toHaveTextContent('8 milhões')
  expect(sec).toHaveTextContent('64% a menos')
  expect(sec).toHaveTextContent('mesmo com três revisões a mais por etapa')
  expect(within(sec).getByRole('note', { name: 'Como fizemos a conta' })).toHaveTextContent('conta simplificada')
  for (const g of ['Um método pronto, no automático', 'A sua cota do Claude rende mais']) expect(within(sec).getByText(g)).toBeInTheDocument()
})

// ---- M31: página em inglês (F00VendasEN), bandeirinhas e Windows · Mac ---------------------------------------------------
describe('página em inglês (M31)', () => {
  const montarEn = () => render(<TemaProvider><Vendas onComprar={vi.fn()} idioma="en" /></TemaProvider>)

  test('título, preço em dólar e app pronto a $2,400', () => {
    montarEn()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('No coding required.')
    expect(screen.getByText('$1,700')).toBeInTheDocument()
    expect(screen.getAllByText('$2,400').length).toBe(4)
    expect(screen.getByRole('heading', { name: 'If you can explain it, you can build it.' })).toBeInTheDocument()
  })

  test('nenhum texto do português aparece na página em inglês', () => {
    const { container } = montarEn()
    // O nome da empresa (PL Participações LTDA) é nome próprio: fica como é.
    const texto = (container.textContent ?? '').replace('PL Participações LTDA', '')
    for (const pt of ['Quero', 'Você', 'Preço', 'Dúvidas', 'obra', 'português simples', 'Pix', 'R$']) expect(texto).not.toContain(pt)
    expect(texto).not.toMatch(/[ãõçáéíóúâêô]/)
  })

  test('bandeirinhas no topo, com o inglês marcado; Windows e Mac logo abaixo dos botões', () => {
    montarEn()
    expect(screen.getByRole('link', { name: 'English (US)' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'Português (Brasil)' })).toHaveAttribute('aria-current', 'false')
    const plat = screen.getByLabelText('Works on Windows, Mac')
    expect(plat).toHaveTextContent('Windows')
    expect(plat).toHaveTextContent('Mac')
    expect(screen.getByRole('img', { name: 'In English and Portuguese' })).toBeInTheDocument()
  })
})

test('português: bandeira do Brasil marcada, Windows e Mac (nada de "só Windows")', () => {
  montar()
  expect(screen.getByRole('link', { name: 'Português (Brasil)' })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByLabelText('Funciona em Windows, Mac')).toBeInTheDocument()
  expect(screen.getByText(/no Windows 10 ou 11 e no Mac/)).toBeInTheDocument()
})
