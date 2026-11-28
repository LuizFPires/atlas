import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { UsarOSistema } from './UsarOSistema'
import { AbasDaObra } from './AbasDaObra'
import { ColocarNoAr } from './ColocarNoAr'
import { criarNoArFixture, type EstadoNoAr, type PessoaDaEquipe, type PonteNoAr } from './ponte-no-ar'

const obra = { nome: 'Ponto', pasta: 'ponto' }
const noArBase: EstadoNoAr = { fase: 'noar', nome: 'ponto-sistema', passos: [], achados: [], endereco: 'https://ponto-sistema.vercel.app', erro: null, avisos: [], acesso: { email: 'gui@ampla.com.br', novo: true, senha: true } }
const DONO: PessoaDaEquipe = { id: '11111111-2222-3333-4444-555555555555', email: 'gui@ampla.com.br', nome: '', papel: 'dono', voce: true, bloqueado: false, trocarSenha: false }

function ponte(extra: Partial<PonteNoAr> = {}): PonteNoAr {
  const base = criarNoArFixture()
  let equipe: PessoaDaEquipe[] = [DONO]
  return {
    ...base,
    estado: async () => structuredClone(noArBase),
    definirSenha: async () => ({ ok: true as const }),
    papeis: async () => [{ id: 'dono', nome: 'Dono', descricao: 'vê e muda tudo' }, { id: 'gerente', nome: 'Gerente', descricao: 'cuida da agenda' }, { id: 'profissional', nome: 'Profissional', descricao: 'vê os próprios horários' }],
    pessoas: async () => equipe.map((p) => ({ ...p })),
    colocarPessoa: async (_pasta, p) => {
      equipe = [...equipe, { id: 'aaaaaaaa-2222-3333-4444-555555555555', email: p.email.toLowerCase(), nome: p.nome, papel: p.papel, voce: false, bloqueado: false, trocarSenha: true }]
      return { ok: true as const, id: 'aaaaaaaa-2222-3333-4444-555555555555', senha: 'ponte-azul-farol-47' }
    },
    novaSenha: async () => ({ ok: true as const, senha: 'trilha-verde-ilha-12' }),
    tirarAcesso: async (_pasta, id) => { equipe = equipe.map((p) => (p.id === id ? { ...p, bloqueado: true } : p)); return { ok: true as const } },
    ...extra,
  }
}
const montar = (noAr: PonteNoAr, p: Partial<React.ComponentProps<typeof UsarOSistema>> = {}) =>
  render(<TemaProvider><UsarOSistema obra={obra} noAr={noAr} {...p} /></TemaProvider>)

test('duas metades: usando agora (grátis, endereço, QR, WhatsApp) e abrir para clientes (só se quiser)', async () => {
  const dominio = vi.fn()
  montar(ponte(), { onDominio: dominio, onEmails: () => {}, onLojas: () => {}, onVender: () => {} })
  const agora = screen.getByRole('region', { name: 'Usando agora' })
  expect(within(agora).getByText('R$ 0 POR MÊS')).toBeInTheDocument()
  expect(within(agora).getByText('Seu sistema já está funcionando.')).toBeInTheDocument()
  expect(within(agora).getByText(/Não precisa pagar nada nem comprar domínio/)).toBeInTheDocument()
  expect(await within(agora).findByText('ponto-sistema.vercel.app')).toBeInTheDocument()
  expect(within(agora).getByRole('img', { name: /QR code/ })).toHaveAttribute('data-endereco', 'https://ponto-sistema.vercel.app')
  expect(within(agora).getByRole('link', { name: 'Mandar pelo WhatsApp' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\//)
  const clientes = screen.getByRole('region', { name: 'Abrir para clientes' })
  expect(within(clientes).getByText('SÓ SE VOCÊ QUISER')).toBeInTheDocument()
  expect(within(clientes).getByText(/nunca ao Atlas/)).toBeInTheDocument()
  for (const t of ['Usar meu domínio', 'E-mails para qualquer pessoa', 'App Store e Google Play', 'Vender o Ponto para outras empresas']) expect(within(clientes).getByRole('button', { name: new RegExp(t) })).toBeInTheDocument()
  await userEvent.setup().click(within(clientes).getByRole('button', { name: /Usar meu domínio/ }))
  expect(dominio).toHaveBeenCalled()
  expect(screen.queryByText(/LIMITADO/)).not.toBeInTheDocument()
})

test('abrir para clientes: só aparece o que existe nesta versão', () => {
  montar(ponte(), { onEmails: () => {} })
  const clientes = screen.getByRole('region', { name: 'Abrir para clientes' })
  expect(within(clientes).getAllByRole('button')).toHaveLength(1)
})

test('pessoas da equipe na tela: o dono primeiro, marcado, com Trocar senha; sem ninguém, explica como colocar', async () => {
  montar(ponte())
  expect(await screen.findByText('Você (você)')).toBeInTheDocument()
  expect(screen.getByText('PESSOAS DA EQUIPE · 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Trocar senha' })).toBeInTheDocument()
  expect(screen.getByText(/Ainda só você/)).toBeInTheDocument()
})

test('dono sem senha: o cartão de criar a senha aparece em cima da equipe', async () => {
  montar(ponte({ estado: async () => ({ ...structuredClone(noArBase), acesso: { email: 'gui@ampla.com.br', novo: true, senha: false } }) }))
  expect(await screen.findByLabelText('Senha')).toBeInTheDocument()
})

test('colocar uma pessoa: papéis da obra, senha inicial mostrada uma vez e recado pronto para o WhatsApp', async () => {
  const user = userEvent.setup()
  const p = ponte()
  const colocar = vi.fn(p.colocarPessoa!)
  montar({ ...p, colocarPessoa: colocar })
  await user.click(await screen.findByRole('button', { name: '+ Colocar uma pessoa' }))
  expect(screen.getByRole('heading', { name: 'Pessoas da equipe' })).toBeInTheDocument()
  const papeis = await screen.findByRole('radiogroup', { name: 'Papel' })
  expect(within(papeis).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Donovê e muda tudo', 'Gerentecuida da agenda', 'Profissionalvê os próprios horários'])
  expect(within(papeis).getByRole('radio', { name: /Gerente/ })).toHaveAttribute('aria-checked', 'true')
  const criar = screen.getByRole('button', { name: 'Criar acesso' })
  expect(criar).toBeDisabled()
  await user.type(screen.getByLabelText('Nome'), 'Rafael Souza')
  await user.type(screen.getByLabelText('E-mail'), 'rafael@ampla.com.br')
  await user.click(within(papeis).getByRole('radio', { name: /Profissional/ }))
  await user.click(criar)
  expect(colocar).toHaveBeenCalledWith('ponto', { nome: 'Rafael Souza', email: 'rafael@ampla.com.br', papel: 'profissional' })
  expect(await screen.findByText('Rafael já pode entrar.')).toBeInTheDocument()
  expect(screen.getByText('ponte-azul-farol-47')).toBeInTheDocument()
  const wpp = screen.getByRole('link', { name: 'Mandar pelo WhatsApp' }).getAttribute('href') ?? ''
  expect(decodeURIComponent(wpp)).toMatch(/Oi Rafael! Seu acesso ao Ponto: ponto-sistema\.vercel\.app · login rafael@ampla\.com\.br · senha ponte-azul-farol-47/)
  expect(screen.getByText(/mostra a senha só agora e não guarda/)).toBeInTheDocument()
  const lista = screen.getByLabelText('Quem já entra')
  await waitFor(() => expect(within(lista).getByText('Rafael Souza')).toBeInTheDocument())
  expect(within(lista).getByText('PROFISSIONAL')).toBeInTheDocument()
  expect(within(lista).getByText(/ainda vai trocar a senha/)).toBeInTheDocument()
})

test('erro ao colocar: explica em português (e-mail que já tem conta)', async () => {
  const user = userEvent.setup()
  montar(ponte({ colocarPessoa: async () => { throw new Error('pessoa-ja-existe') } }), { inicio: 'pessoas' })
  await user.type(await screen.findByLabelText('Nome'), 'Ana')
  await user.type(screen.getByLabelText('E-mail'), 'ana@x.com')
  await user.click(screen.getByRole('button', { name: 'Criar acesso' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Esse e-mail já tem conta no seu sistema.')
})

test('nova senha e tirar acesso (com confirmação); o dono não tem esses botões', async () => {
  const user = userEvent.setup()
  const p = ponte()
  await p.colocarPessoa!('ponto', { nome: 'Eduardo', email: 'edu@ampla.com.br', papel: 'gerente' })
  const tirar = vi.fn(p.tirarAcesso!)
  montar({ ...p, tirarAcesso: tirar }, { inicio: 'pessoas' })
  const lista = await screen.findByLabelText('Quem já entra')
  await within(lista).findByText('Eduardo')
  expect(within(lista).getAllByRole('button', { name: 'Nova senha' })).toHaveLength(1)
  await user.click(within(lista).getByRole('button', { name: 'Nova senha' }))
  expect(await screen.findByText('Nova senha para Eduardo.')).toBeInTheDocument()
  expect(screen.getByText('trilha-verde-ilha-12')).toBeInTheDocument()
  await user.click(within(lista).getByRole('button', { name: 'Tirar acesso' }))
  expect(tirar).not.toHaveBeenCalled()
  await user.click(within(lista).getByRole('button', { name: 'Sim, tirar' }))
  expect(tirar).toHaveBeenCalledWith('ponto', 'aaaaaaaa-2222-3333-4444-555555555555')
  expect(await within(lista).findByText('SEM ACESSO')).toBeInTheDocument()
})

test('aba "Usar o sistema" só aparece com a obra no ar', () => {
  const { rerender } = render(<AbasDaObra nome="Ponto" atual="obra" onIr={() => {}} onCanteiro={() => {}} so="abas" />)
  expect(screen.queryByRole('tab', { name: /Usar o sistema/ })).not.toBeInTheDocument()
  rerender(<AbasDaObra nome="Ponto" atual="obra" onIr={() => {}} onCanteiro={() => {}} so="abas" comUsar />)
  expect(screen.getByRole('tab', { name: /Usar o sistema/ })).toBeInTheDocument()
})

test('colocar no ar: quando fica no ar, leva o cliente para "Usar o sistema"', async () => {
  const pronto = vi.fn()
  render(<TemaProvider><ColocarNoAr obra={obra} noAr={ponte()} intervaloMs={30} onPronto={pronto} /></TemaProvider>)
  await waitFor(() => expect(pronto).toHaveBeenCalled())
})
