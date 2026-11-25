import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuiaSite } from './GuiaSite'
import { guiaApple, guiaAsaas, guiaGoogle, guiaRegistro, guiaStripe, passoPeloEndereco } from './guias-site'
import type { PaginaNavegador, PonteNavegador } from './ponte-navegador'

const NS = ['ns1.vercel-dns.com', 'ns2.vercel-dns.com']

function navegadorFalso() {
  let ouvinte: ((p: PaginaNavegador) => void) | null = null
  const nav: PonteNavegador = {
    abrir: vi.fn(async () => {}), abrirGuia: vi.fn(async () => {}), foraGuia: vi.fn(async () => {}), posicionar: vi.fn(async () => {}), mostrar: vi.fn(async () => {}),
    voltar: vi.fn(async () => {}), recarregar: vi.fn(async () => {}), fora: vi.fn(async () => {}), fechar: vi.fn(async () => {}),
    aoMudarPagina: (f) => { ouvinte = f; return () => { ouvinte = null } },
  }
  return { nav, pagina: (url: string) => act(() => { ouvinte?.({ guia: 'registro', url, pronta: false }) }) }
}

describe('guias clique por clique (M58)', () => {
  it('os guias prontos têm o número de passos do protótipo (Registro 7, Apple 6, Google 6) e Stripe e Asaas', () => {
    expect(guiaRegistro({ dominio: 'pontoampla.com.br', servidores: NS }).passos).toHaveLength(7)
    expect(guiaApple().passos).toHaveLength(6)
    expect(guiaGoogle().passos).toHaveLength(6)
    expect(guiaStripe().passos.length).toBeGreaterThanOrEqual(5)
    expect(guiaAsaas().passos.length).toBeGreaterThanOrEqual(5)
    for (const g of [guiaRegistro({ dominio: 'a.com.br', servidores: NS }), guiaApple(), guiaGoogle(), guiaStripe(), guiaAsaas()]) {
      for (const p of g.passos) expect(p.texto.length).toBeLessThan(200)
      expect(g.passos.map((p) => p.texto).join(' ')).not.toMatch(/o Atlas digita|digitamos a sua senha/i)
    }
  })

  it('o passo anda sozinho pelo endereço do site, e volta se o site pedir login de novo', () => {
    const g = guiaRegistro({ dominio: 'pontoampla.com.br', servidores: NS })
    expect(passoPeloEndereco(g, 0, 'https://registro.br/login/')).toBe(1)
    expect(passoPeloEndereco(g, 1, 'https://registro.br/painel/')).toBe(3)
    expect(passoPeloEndereco(g, 3, 'https://registro.br/painel/dominios/pontoampla.com.br')).toBe(4)
    expect(passoPeloEndereco(g, 4, 'https://registro.br/painel/dominios/pontoampla.com.br/dns')).toBe(5)
    expect(passoPeloEndereco(g, 4, 'https://registro.br/login/')).toBe(1)
  })

  it('com e-mail no domínio: não troca servidores; uma linha por registro', () => {
    const g = guiaRegistro({ dominio: 'loja.com.br', registros: [{ tipo: 'A', nome: '@', valor: '76.76.21.21' }, { tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' }] })
    const textos = g.passos.map((p) => p.texto).join(' ')
    expect(textos).not.toMatch(/Alterar servidores DNS/)
    expect(g.passos.flatMap((p) => p.copiar ?? []).map((c) => c.valor)).toEqual(['76.76.21.21', 'cname.vercel-dns.com'])
  })

  it('Registro.br: o site abre ao lado, o passo anda com a página e "Copiar" põe o servidor na área de transferência', async () => {
    const { nav, pagina } = navegadorFalso()
    const escrever = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true })
    render(<GuiaSite guia={guiaRegistro({ dominio: 'pontoampla.com.br', servidores: NS })} navegador={nav} onFim={() => {}} />)
    expect(nav.abrirGuia).toHaveBeenCalledWith('registro', expect.anything())
    expect(screen.getByText('PASSO 1 DE 7')).toBeInTheDocument()
    pagina('https://registro.br/painel/')
    expect(screen.getByText('PASSO 4 DE 7')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fiz, próximo →' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fiz, próximo →' }))
    expect(screen.getByText('PASSO 6 DE 7')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Copiar Servidor 1' }))
    expect(escrever).toHaveBeenCalledWith('ns1.vercel-dns.com')
  })

  it('"Falar com o Atlas" leva o passo, o botão certo e o que se sabe do site', async () => {
    const onAjuda = vi.fn()
    const { nav } = navegadorFalso()
    render(<GuiaSite guia={guiaRegistro({ dominio: 'pontoampla.com.br', servidores: NS })} navegador={nav} onFim={() => {}} onAjuda={onAjuda} />)
    await userEvent.click(screen.getByRole('button', { name: /Falar com o Atlas/ }))
    const p = onAjuda.mock.calls[0][0]
    expect(p).toMatchObject({ origem: 'guia', conta: 'Registro.br', passo: 1, totalPassos: 7 })
    expect(p.saber).toMatch(/Pesquisa recusada/)
    expect(p.print.botaoCerto).toBe('Entrar')
  })

  it('o fim chega sozinho quando o Atlas vê a troca (Registro.br)', async () => {
    const onFim = vi.fn()
    const { nav } = navegadorFalso()
    render(<GuiaSite guia={guiaRegistro({ dominio: 'pontoampla.com.br', servidores: NS })} navegador={nav} onFim={onFim} conferirFim={async () => true} intervaloMs={10} />)
    await vi.waitFor(() => expect(onFim).toHaveBeenCalled())
  })

  it('Apple: é no iPhone, com QR para o app da Apple; Google: abre no navegador do computador', async () => {
    const abrirFora = vi.fn(async () => {})
    const { unmount } = render(<GuiaSite guia={guiaApple()} onFim={() => {}} abrirFora={abrirFora} />)
    expect(screen.getByRole('img', { name: /QR/ })).toHaveAttribute('data-endereco', expect.stringContaining('apps.apple.com'))
    unmount()
    render(<GuiaSite guia={guiaGoogle()} onFim={() => {}} abrirFora={abrirFora} />)
    await userEvent.click(screen.getByRole('button', { name: /Abrir o site do Google Play/ }))
    expect(abrirFora).toHaveBeenCalledWith('google-console')
  })
})
