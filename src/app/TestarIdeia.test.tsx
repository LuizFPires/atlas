import { act, fireEvent, render, screen } from '@testing-library/react'
import { TestarIdeia } from './TestarIdeia'
import { criarTestarFixture, type RelatorioTeste } from './ponte-testar'
import { compararTemas, frasesDoVeredito } from './testar-ideia-util'

const c = (u: number, n: number, d: number) => ({ total: u + n + d, usaria: u, nao: n, duvida: d, pctUsaria: Math.round((u / (u + n + d)) * 100), pctNao: Math.round((n / (u + n + d)) * 100), pctDuvida: Math.round((d / (u + n + d)) * 100) })

async function relDaFixture(n = 1): Promise<RelatorioTeste> {
  const f = criarTestarFixture()
  if (n > 1) { await f.iniciar('p', { quantidade: 100 }); for (let i = 0; i < 6; i++) await f.estado('p', n) }
  return (await f.relatorio('p', n))!
}

describe('TestarIdeia', () => {
  afterEach(() => vi.useRealTimers())

  test('sem nenhum teste, convida e leva para a escolha da quantidade (500 já marcado)', async () => {
    const ponte = { ...criarTestarFixture(), listar: async () => [] }
    render(<TestarIdeia pasta="p" nome="Ponto" ponte={ponte} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Testar a ideia →' }))
    expect(screen.getByRole('radio', { name: /500/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText(/gasta o dobro da cota de 500/)).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /1\.000/ }))
    expect(screen.getByText(/gasta o dobro da cota de 500/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Começar com 1.000 pessoas →' })).toBeTruthy()
    expect(screen.queryByText(/mesmos agentes/)).toBeNull()
  })

  test('lista os testes salvos com o mais citado contra e compara quando há só um', async () => {
    render(<TestarIdeia pasta="p" nome="Ponto" ponte={criarTestarFixture()} />)
    expect(await screen.findByText('Teste 1')).toBeTruthy()
    expect(screen.getByText('Sem internet na obra')).toBeTruthy()
    expect(screen.getByText(/Quando você rodar outro teste, a comparação aparece aqui/)).toBeTruthy()
  })

  test('novo teste com os mesmos agentes roda até o relatório, que avisa que é termômetro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const ponte = criarTestarFixture()
    const iniciar = vi.spyOn(ponte, 'iniciar')
    render(<TestarIdeia pasta="p" nome="Ponto" ponte={ponte} />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Novo teste' }))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: /100/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Começar com 100 pessoas →' }))
    expect(iniciar).toHaveBeenCalledWith('p', { quantidade: 100, mesmosDe: 1, versao: null })
    expect(await screen.findByText('O QUE ELAS ESTÃO DIZENDO')).toBeTruthy()
    for (let i = 0; i < 6; i++) await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(await screen.findByText('Isto é um termômetro, não uma pesquisa de mercado.')).toBeTruthy()
    expect(screen.getByText('O que 97 agentes de IA acharam do Ponto')).toBeTruthy() // conta quem respondeu (3 ficaram sem resposta)
  })

  test('não deixa começar outro teste enquanto um está rodando', async () => {
    const ponte = criarTestarFixture()
    await ponte.iniciar('p', { quantidade: 100 })
    render(<TestarIdeia pasta="p" nome="Ponto" ponte={ponte} />)
    const b = await screen.findByRole('button', { name: '+ Novo teste' })
    expect((b as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('RODANDO')).toBeTruthy()
  })

  test('pausado pela cota: explica e oferece tentar agora', async () => {
    const f = criarTestarFixture()
    const ponte = { ...f, estado: async () => ({ ...(await f.estado('p', 1))!, estado: 'pausado-cota' as const, etapa: 'olhar' as const }) }
    const retomar = vi.spyOn(ponte, 'retomar')
    render(<TestarIdeia pasta="p" nome="Ponto" ponte={ponte} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir relatório' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar agora' }))
    expect(screen.getByText('Pausado: a cota do Claude acabou.')).toBeTruthy()
    expect(retomar).toHaveBeenCalledWith('p', 1)
  })

  test('relatório: troca o tipo do mapa de calor e apaga grupos com menos de 20 agentes', async () => {
    const ponte = criarTestarFixture()
    const r = await ponte.relatorio('p', 1)
    render(<TestarIdeia pasta="p" nome="Ponto" ponte={{ ...ponte, relatorio: async () => ({ ...r!, porTipo: { ...r!.porTipo, Cidade: [{ valor: 'Capital', ...c(30, 10, 0) }, { valor: 'Interior', ...c(5, 5, 0) }] } }) }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir relatório' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cidade' }))
    expect(screen.getByLabelText('Interior: 50% a favor, 50% contra').closest('.at-rel__duelo')!.className).toContain('poucos')
    expect(screen.getByLabelText('Capital: 75% a favor, 25% contra').closest('.at-rel__duelo')!.className).not.toContain('poucos')
  })
})

describe('contas do relatório', () => {
  test('compararTemas casa os temas pelo nome e marca os novos com antes = 0', async () => {
    const a = await relDaFixture(2)
    const b = await relDaFixture(1)
    const x = compararTemas(a, b)
    expect(x).toContainEqual({ tema: 'Sem internet na obra', antes: 141, depois: 0 })
    expect(x).toContainEqual({ tema: 'Caro para equipe pequena', antes: 117, depois: 41 })
    expect(x).toContainEqual({ tema: 'Caro para equipe grande', antes: 0, depois: 37 })
  })

  test('frasesDoVeredito: dividido quando a diferença é menor que 10 pontos, e ignora grupos pequenos', async () => {
    const r = await relDaFixture()
    const v = frasesDoVeredito({ ...r, geral: c(45, 40, 15), porTipo: { Profissão: [{ valor: 'Pedreiro', ...c(2, 8, 0) }, { valor: 'RH', ...c(30, 10, 0) }, { valor: 'Mestre', ...c(10, 25, 0) }] } })
    expect(v.titulo).toBe('Termômetro: dividido.')
    expect(v.quem).toBe('Quem mais gostou: RH (75% a favor). Quem mais torceu o nariz: Mestre (71% contra).')
  })

  test('frasesDoVeredito: mais a favor e sem frase de grupos quando só há um grupo grande', async () => {
    const r = await relDaFixture()
    const v = frasesDoVeredito({ ...r, geral: c(70, 20, 10), porTipo: { Profissão: [{ valor: 'RH', ...c(30, 10, 0) }] } })
    expect(v).toEqual({ titulo: 'Termômetro: mais a favor do que contra.', quem: null })
  })
})
