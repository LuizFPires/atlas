import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lojas } from './Lojas'
import { criarLojasFixture } from './ponte-lojas'

const montar = (extra: Partial<Parameters<typeof Lojas>[0]> = {}) => {
  const lojas = extra.lojas ?? criarLojasFixture({ passoMs: 5 })
  const onGuia = vi.fn()
  render(<Lojas pasta="ponto" appNome="Ponto" lojas={lojas} onGuia={onGuia} intervaloMs={20} {...extra} />)
  return { lojas, onGuia }
}

describe('lojas (M59, PB8/PB9/PB13)', () => {
  it('uma pergunta antes: em nome de quem, com o que muda e os custos; pessoa já marcada', async () => {
    montar()
    expect(await screen.findByText(/vai aparecer em nome de quem/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /No meu nome/ })).toBeChecked()
    expect(screen.getByText(/US\$ 99 por ano/)).toBeInTheDocument()
    expect(screen.getByText(/12 pessoas/)).toBeInTheDocument()
  })

  it('pessoa: Apple, Google, Expo, chave da Apple e testadores, cada um com o seu passo a passo', async () => {
    const { onGuia } = montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir →' }))
    const lista = await screen.findByRole('list', { name: 'O que falta para as lojas' })
    for (const n of [/Conta da Apple/, /Conta do Google Play/, /Conta da Expo/, /Chave da App Store Connect/, /12 testadores/]) expect(within(lista).getByText(n)).toBeInTheDocument()
    expect(within(lista).queryByText(/D-U-N-S/)).toBeNull()
    await userEvent.click(within(lista).getByRole('button', { name: 'Passo a passo: Conta da Apple' }))
    expect(onGuia).toHaveBeenCalledWith(expect.objectContaining({ id: 'apple' }), 'apple')
  })

  it('empresa: aparece o D-U-N-S, o e-mail e o site no domínio, e some a regra dos 12 testadores', async () => {
    montar()
    await userEvent.click(await screen.findByRole('radio', { name: /No nome da empresa/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Seguir →' }))
    const lista = await screen.findByRole('list', { name: 'O que falta para as lojas' })
    expect(within(lista).getByText(/D-U-N-S/)).toBeInTheDocument()
    expect(within(lista).getByText(/e-mail com o domínio/)).toBeInTheDocument()
    expect(within(lista).queryByText(/12 testadores/)).toBeNull()
  })

  it('chave da Expo vai para o cofre; chave errada recebe um recado claro', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir →' }))
    const campo = await screen.findByRole('textbox', { name: 'Chave da Expo' })
    await userEvent.type(campo, 'curta')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar a chave da Expo' }))
    expect(await screen.findByText(/não parece certa/)).toBeInTheDocument()
    await userEvent.clear(campo)
    await userEvent.type(campo, 'A'.repeat(40))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar a chave da Expo' }))
    expect(await screen.findByLabelText('Conta da Expo: pronta')).toBeInTheDocument()
  })

  it('testadores: cola o grupo, cria o convite, manda pelo WhatsApp e acompanha as pessoas e os dias', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir →' }))
    await userEvent.type(await screen.findByRole('textbox', { name: 'Endereço do grupo' }), 'https://groups.google.com/g/ponto-testadores')
    await userEvent.click(screen.getByRole('button', { name: 'Criar o convite' }))
    const zap = await screen.findByRole('link', { name: 'Mandar o convite pelo WhatsApp' })
    expect(zap.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=.*teste%2Fabcdefghjk23/)
    expect(await screen.findByText(/de 12 pessoas já entraram/)).toBeInTheDocument()
    // O Google não avisa quem sai do teste: o Atlas sugere uma folga para não perder os 14 dias.
    expect(screen.getByText('Convide umas 15 pessoas: se alguém sair do teste, ainda sobram 12 (o Google não avisa quem saiu).')).toBeInTheDocument()
  })
})

describe('lojas, parte 2: montar, enviar e o pronto (PB9)', () => {
  it('sem a conta da Expo o botão de montar não aparece; com ela, monta, manda e pede o 1º envio ao Google', async () => {
    const lojas = criarLojasFixture({ passoMs: 5 })
    const { onGuia } = montar({ lojas })
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir →' }))
    expect(screen.queryByRole('button', { name: /Montar a versão de app/ })).toBeNull()
    await userEvent.type(screen.getByRole('textbox', { name: 'Chave da Expo' }), 'A'.repeat(40))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar a chave da Expo' }))
    await userEvent.click(await screen.findByRole('button', { name: /Montar a versão de app/ }))
    expect(await screen.findByRole('button', { name: /Baixar o arquivo do app/ }, { timeout: 3000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Passo a passo: 1º envio ao Google' }))
    expect(onGuia).toHaveBeenCalledWith(expect.objectContaining({ id: 'google-primeiro' }), undefined)
    await userEvent.click(screen.getByRole('button', { name: 'Já fiz o 1º envio' }))
    expect(await screen.findByText(/FALTA SÓ O SEU ENVIO/)).toBeInTheDocument()
    expect(screen.getAllByText(/Enviar para revisão/).length).toBeGreaterThan(0)
  })

  it('a chave da Apple pede o Issuer ID e o Team ID', async () => {
    const lojas = criarLojasFixture({ passoMs: 5 })
    await lojas.marcarConta('ponto', 'apple', true)
    montar({ lojas })
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir →' }))
    expect(await screen.findByRole('textbox', { name: 'Issuer ID' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Team ID' })).toBeInTheDocument()
  })
})

