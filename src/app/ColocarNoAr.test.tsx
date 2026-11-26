import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { ColocarNoAr } from './ColocarNoAr'
import { criarNoArFixture, explicarErro, noArIndisponivel, type EstadoNoAr, type PonteNoAr } from './ponte-no-ar'
import { criarDominioFixture } from './ponte-dominio'

const obra = { nome: 'Ponto', pasta: 'ponto' }
const montar = (noAr: PonteNoAr, p: Partial<React.ComponentProps<typeof ColocarNoAr>> = {}) =>
  render(<TemaProvider><ColocarNoAr obra={obra} noAr={noAr} extra="ampla" intervaloMs={30} {...p} /></TemaProvider>)

test('obra pronta: endereço já escolhido, contas ligadas, custo zero e um botão só', async () => {
  montar(criarNoArFixture({ passoMs: 5 }))
  expect(await screen.findByText(/pontoampla\.vercel\.app/)).toBeInTheDocument()
  expect(screen.getByText('✓ GitHub · Vercel · Supabase')).toBeInTheDocument()
  expect(screen.getByText('R$ 0 (planos grátis)')).toBeInTheDocument()
  expect(screen.getByText('só este clique')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Colocar no ar →' })).toBeEnabled()
  expect(screen.queryByText(/Cartaz/)).not.toBeInTheDocument()
})

test('um clique: os passos andam sozinhos até no ar, com QR e WhatsApp', async () => {
  const user = userEvent.setup()
  montar(criarNoArFixture({ passoMs: 5 }), { onDominio: () => {}, onLojas: () => {} })
  await user.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  await waitFor(() => expect(screen.getByText('ESTÁ NO AR · ENTREGA DAS CHAVES')).toBeInTheDocument(), { timeout: 2000 })
  const qr = screen.getByRole('img', { name: /QR code/ })
  expect(qr).toHaveAttribute('data-endereco', 'https://pontoampla.vercel.app')
  expect(screen.getByRole('link', { name: 'Mandar pelo WhatsApp' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=.*pontoampla\.vercel\.app/)
  expect(screen.getByRole('button', { name: /Usar meu domínio/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /App Store e no Google Play/ })).toBeInTheDocument()
})

test('trocar o nome: confere se está livre e mostra os livres para escolher', async () => {
  const user = userEvent.setup()
  montar(criarNoArFixture({ passoMs: 5 }))
  await user.click(await screen.findByRole('button', { name: 'trocar' }))
  const campo = screen.getByRole('textbox', { name: 'Nome do endereço' })
  await user.clear(campo)
  await user.type(campo, 'ponto')
  expect(await screen.findByText('✗ já é de outra pessoa')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Usar ponto e colocar no ar/ })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: /ponto-equipe/ }))
  expect(await screen.findByText('✓ livre', { selector: '#noar-situacao' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Usar ponto-equipe e colocar no ar/ })).toBeEnabled()
})

test('vistoria achou pontos: mostra em português e "Corrigir e continuar" segue sozinho até no ar', async () => {
  const user = userEvent.setup()
  montar(criarNoArFixture({ passoMs: 5, reprovar: true }))
  await user.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  expect(await screen.findByText(/A VISTORIA ACHOU 2 PONTOS/)).toBeInTheDocument()
  expect(screen.getByText(/Falta a página de privacidade/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Corrigir e continuar →' }))
  await waitFor(() => expect(screen.getByText('ESTÁ NO AR · ENTREGA DAS CHAVES')).toBeInTheDocument(), { timeout: 3000 })
})

test('erro num passo: diz onde parou em português, religa a conta e tenta de novo', async () => {
  const user = userEvent.setup()
  const erro: EstadoNoAr = { fase: 'erro', nome: 'pontoampla', passos: [{ id: 'vistoria', estado: 'feito' }, { id: 'banco', estado: 'erro' }, { id: 'publicar', estado: 'falta' }, { id: 'github', estado: 'falta' }, { id: 'teste', estado: 'falta' }, { id: 'celular', estado: 'falta' }], achados: [], endereco: null, erro: { passo: 'banco', motivo: 'sem-conta-supabase' }, avisos: [] }
  const iniciados: string[] = []
  const ponte: PonteNoAr = { ...criarNoArFixture(), estado: async () => erro, iniciar: async (_p, n) => { iniciados.push(n); return erro } }
  const ligar = vi.fn()
  const ajuda = vi.fn()
  montar(ponte, { onLigarContas: ligar, onAjuda: ajuda })
  expect(await screen.findByText(/PAROU NO PASSO: BANCO DE DADOS/)).toBeInTheDocument()
  expect(screen.getByText(explicarErro('sem-conta-supabase').frase)).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: /QR code/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Religar a conta' }))
  expect(ligar).toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Tentar de novo →' }))
  expect(iniciados).toEqual(['pontoampla'])
  await user.click(screen.getByRole('button', { name: 'Falar com o Atlas' }))
  expect(ajuda).toHaveBeenCalledWith({ onde: 'colocar no ar', erro: 'sem-conta-supabase' })
})

test('sem adaptador: não finge que publicou', async () => {
  montar(noArIndisponivel)
  expect(await screen.findByText(/não está ligada neste computador/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Colocar no ar →' })).toBeDisabled()
})

test('explicarErro: conta certa para religar', () => {
  expect(explicarErro('vercel-deploy').conta).toBe('vercel')
  expect(explicarErro('teste-falhou').frase).toMatch(/não diz que está no ar/)
})

test('domínio próprio (M57): abre ao lado do prédio e, no ar, o QR e o WhatsApp passam para o endereço novo', async () => {
  const user = userEvent.setup()
  montar(criarNoArFixture({ passoMs: 5 }), { dominio: criarDominioFixture({ passoMs: 5 }), abrirRegistro: async () => {} })
  await user.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  await user.click(await screen.findByRole('button', { name: /Usar meu domínio/ }, { timeout: 2000 }))
  await user.type(screen.getByRole('textbox', { name: 'Seu domínio' }), 'pontoampla.com.br')
  await user.click(screen.getByRole('button', { name: /Conferir e ligar/ }))
  await user.click(await screen.findByRole('button', { name: 'Voltar' }, { timeout: 3000 }))
  await waitFor(() => expect(screen.getByRole('img', { name: /QR code/ })).toHaveAttribute('data-endereco', 'https://pontoampla.com.br'))
  expect(screen.getByRole('link', { name: 'Mandar pelo WhatsApp' }).getAttribute('href')).toMatch(/pontoampla\.com\.br/)
})

test('"Corrigir e continuar" falhou: diz o motivo de verdade, não um "tente de novo" genérico', async () => {
  const casos: [string, RegExp][] = [
    ['sem-licenca', /licença/i],
    ['plan-invalido', /plano da obra/i],
    ['obra-com-config-suspeita', /arquivo estranho/i],
    ['kit-indisponivel', /servidor do Atlas não entregou/i],
  ]
  for (const [codigo, texto] of casos) {
    const user = userEvent.setup()
    const base = criarNoArFixture({ passoMs: 5, reprovar: true })
    const { unmount } = montar({ ...base, corrigir: async () => { throw new Error(codigo) } })
    await user.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
    await user.click(await screen.findByRole('button', { name: 'Corrigir e continuar →' }))
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(/Tente de novo em instantes/)).not.toBeInTheDocument()
    unmount()
  }
})

test('correção travou porque outra obra está trabalhando: espera a vez e corrige sozinho, sem novo clique', async () => {
  const user = userEvent.setup()
  const base = criarNoArFixture({ passoMs: 5, reprovar: true })
  let tentativas = 0
  montar({ ...base, corrigir: async (p) => { tentativas++; if (tentativas < 3) throw new Error('ja-rodando'); return base.corrigir(p) } })
  await user.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  await user.click(await screen.findByRole('button', { name: 'Corrigir e continuar →' }))
  expect(await screen.findByText(/Assim que ela terminar, o Atlas corrige sozinho/)).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('ESTÁ NO AR · ENTREGA DAS CHAVES')).toBeInTheDocument(), { timeout: 3000 })
  expect(tentativas).toBe(3)
})

test('correção travou de outro jeito: o cliente destrava pelo app (tentar de novo ou pedir ao Atlas), sem esperar versão nova', async () => {
  const user = userEvent.setup()
  const base = criarNoArFixture({ passoMs: 5, reprovar: true })
  const ajudas: { onde: string; erro?: string }[] = []
  let falhar = true
  montar({ ...base, corrigir: async (p) => { if (falhar) throw new Error('claude-falhou'); return base.corrigir(p) } }, { onAjuda: (c) => ajudas.push(c) })
  await user.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  await user.click(await screen.findByRole('button', { name: 'Corrigir e continuar →' }))
  await user.click(await screen.findByRole('button', { name: 'Pedir ao Atlas para destravar' }))
  expect(ajudas).toEqual([{ onde: 'a correção que a vistoria pediu antes de publicar', erro: 'claude-falhou' }])
  falhar = false
  await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  await waitFor(() => expect(screen.getByText('ESTÁ NO AR · ENTREGA DAS CHAVES')).toBeInTheDocument(), { timeout: 3000 })
})

test('"Colocar no ar" travou no começo: motivo real e "Pedir ao Atlas para destravar"', async () => {
  const user = userEvent.setup()
  const base = criarNoArFixture({ passoMs: 5 })
  const ajudas: { onde: string; erro?: string }[] = []
  montar({ ...base, iniciar: async () => { throw new Error('sem-licenca') } }, { onAjuda: (c) => ajudas.push(c) })
  await user.click(await screen.findByRole('button', { name: 'Colocar no ar →' }))
  expect(await screen.findByText(/licença deste computador/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Pedir ao Atlas para destravar' }))
  expect(ajudas).toEqual([{ onde: 'o começo da publicação', erro: 'sem-licenca' }])
})
