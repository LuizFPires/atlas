import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DominioProprio } from './DominioProprio'
import { criarDominioFixture, limparDominio, type PonteDominio } from './ponte-dominio'

const montar = (dominio: PonteDominio, extra: Partial<Parameters<typeof DominioProprio>[0]> = {}) =>
  render(<DominioProprio pasta="ponto" dominio={dominio} sugestao="pontoampla" intervaloMs={10} abrirRegistro={async () => {}} {...extra} />)

describe('domínio próprio (M57, PB6/PB7)', () => {
  it('limpa o que o cliente cola', () => {
    expect(limparDominio(' https://www.PontoAmpla.com.br/ ')).toBe('pontoampla.com.br')
    expect(limparDominio('pontoampla.com')).toBeNull()
  })

  it('domínio sem e-mail: o Atlas confere, liga sozinho e mostra os dois servidores para colar', async () => {
    const abrir = vi.fn(async () => {})
    montar(criarDominioFixture({ passoMs: 10_000 }), { abrirRegistro: abrir })
    await userEvent.type(screen.getByRole('textbox', { name: 'Seu domínio' }), 'pontoampla.com.br')
    await userEvent.click(screen.getByRole('button', { name: /Conferir e ligar/ }))
    expect(await screen.findByText('ns1.vercel-dns.com')).toBeInTheDocument()
    expect(screen.getByText('ns2.vercel-dns.com')).toBeInTheDocument()
    expect(screen.getByText('✓ feito')).toBeInTheDocument()
    expect(screen.getByText('não')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Abrir o Registro.br/ }))
    expect(abrir).toHaveBeenCalled()
  })

  it('domínio com e-mail: não troca servidores, mostra só as linhas para acrescentar', async () => {
    montar(criarDominioFixture({ passoMs: 10_000 }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Seu domínio' }), 'lojaemail.com.br')
    await userEvent.click(screen.getByRole('button', { name: /Conferir e ligar/ }))
    expect(await screen.findByText('76.76.21.21')).toBeInTheDocument()
    expect(screen.getByText(/e-mail continua funcionando/)).toBeInTheDocument()
    expect(screen.queryByText('ns1.vercel-dns.com')).toBeNull()
  })

  it('nome livre: oferece a compra no Registro.br (paga pelo cliente) e não liga nada', async () => {
    const dom = criarDominioFixture()
    const ligar = vi.spyOn(dom, 'ligar')
    montar(dom)
    await userEvent.type(screen.getByRole('textbox', { name: 'Seu domínio' }), 'novolivre.com.br')
    await userEvent.click(screen.getByRole('button', { name: /Conferir e ligar/ }))
    expect(await screen.findByText(/está livre/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /comprar/ })).toBeInTheDocument()
    expect(ligar).not.toHaveBeenCalled()
  })

  it('o Atlas vigia sozinho até o cadeado e avisa a tela com o endereço novo', async () => {
    const onNoAr = vi.fn()
    montar(criarDominioFixture({ passoMs: 5 }), { onNoAr })
    await userEvent.type(screen.getByRole('textbox', { name: 'Seu domínio' }), 'pontoampla.com.br')
    await userEvent.click(screen.getByRole('button', { name: /Conferir e ligar/ }))
    expect(await screen.findByText(/DOMÍNIO PRÓPRIO NO AR/, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(onNoAr).toHaveBeenCalledWith('https://pontoampla.com.br')
  })
})
