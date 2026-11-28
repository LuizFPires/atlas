import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/react'
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
    ['plan-invalido', /plano de construção da obra/i],
    ['obra-com-config-suspeita', /arquivo de configuração que o Atlas não criou/i],
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

test('banco parou: cada motivo do Supabase vira a frase certa e o código aparece (26/11/2026, Ponto: "não terminou de preparar" escondia a causa)', () => {
  expect(explicarErro('supabase-limite-gratis').frase).toMatch(/2 bancos/)
  expect(explicarErro('supabase-401').conta).toBe('supabase')
  expect(explicarErro('supabase-403').conta).toBe('supabase')
  expect(explicarErro('supabase-migrations').frase).toMatch(/tabelas/)
  expect(explicarErro('supabase-link').frase).toMatch(/conectar/)
  expect(explicarErro('supabase-funcoes').frase).toMatch(/funções/)
  expect(explicarErro('supabase-demorou').frase).toMatch(/demor/)
  expect(explicarErro('supabase-429').fazer).toMatch(/minuto/)
})

test('erro num passo mostra o código técnico pequeno, para o Atlas saber exatamente o que houve', async () => {
  const erro: EstadoNoAr = { fase: 'erro', nome: 'ponto', passos: [{ id: 'vistoria', estado: 'feito' }, { id: 'banco', estado: 'erro' }, { id: 'publicar', estado: 'falta' }, { id: 'github', estado: 'falta' }, { id: 'teste', estado: 'falta' }, { id: 'celular', estado: 'falta' }], achados: [], endereco: null, erro: { passo: 'banco', motivo: 'supabase-migrations' }, avisos: [] }
  montar({ ...criarNoArFixture(), estado: async () => erro })
  expect(await screen.findByText('código: supabase-migrations')).toBeInTheDocument()
})

test('antes de colocar no ar: a conta do Supabase já tem 2 bancos ativos → avisa na tela o limite grátis e o que fazer, antes de travar', async () => {
  montar({ ...criarNoArFixture(), conferirAntes: async () => ({ precisaBanco: true, bancoNovo: true, contaLigada: true, bancosAtivos: 2 }) })
  const aviso = await screen.findByRole('alert')
  expect(aviso).toHaveTextContent(/já tem 2 bancos ativos/)
  expect(aviso).toHaveTextContent(/conta grátis.*limite é 2/)
  expect(aviso).toHaveTextContent(/pause ou apague um projeto/)
})

test('antes de colocar no ar: conta do Supabase não ligada → diz e oferece religar; com folga → mostra quantos bancos usa', async () => {
  const user = userEvent.setup()
  const ligar = vi.fn()
  const { unmount } = montar({ ...criarNoArFixture(), conferirAntes: async () => ({ precisaBanco: true, bancoNovo: true, contaLigada: false, bancosAtivos: null }) }, { onLigarContas: ligar })
  expect(await screen.findByText(/precisa de um banco de dados na sua conta do Supabase, e ela não está ligada/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Ligar a conta do Supabase' }))
  expect(ligar).toHaveBeenCalled()
  unmount()
  montar({ ...criarNoArFixture(), conferirAntes: async () => ({ precisaBanco: true, bancoNovo: true, contaLigada: true, bancosAtivos: 1 }) })
  expect(await screen.findByText(/Você usa 1 de 2 bancos da conta grátis do Supabase/)).toBeInTheDocument()
})

test('conta do Supabase não ligada: a linha "Contas" não mostra ✓ (não diz que está tudo ligado quando não está)', async () => {
  montar({ ...criarNoArFixture(), conferirAntes: async () => ({ precisaBanco: true, bancoNovo: true, contaLigada: false, bancosAtivos: null }) })
  expect(await screen.findByText('GitHub · Vercel · Supabase (falta ligar)')).toBeInTheDocument()
  expect(screen.queryByText('✓ GitHub · Vercel · Supabase')).not.toBeInTheDocument()
})

test('erro num passo: o que houve no título e o que fazer logo abaixo', async () => {
  const erro: EstadoNoAr = { fase: 'erro', nome: 'ponto', passos: [{ id: 'vistoria', estado: 'feito' }, { id: 'banco', estado: 'erro' }, { id: 'publicar', estado: 'falta' }, { id: 'github', estado: 'falta' }, { id: 'teste', estado: 'falta' }, { id: 'celular', estado: 'falta' }], achados: [], endereco: null, erro: { passo: 'banco', motivo: 'supabase-limite-gratis' }, avisos: [] }
  montar({ ...criarNoArFixture(), estado: async () => erro })
  expect(await screen.findByText('A sua conta grátis do Supabase já tem 2 bancos ativos, que é o limite do plano grátis.')).toBeInTheDocument()
  expect(screen.getByText(/pause ou apague um projeto que você não usa/)).toBeInTheDocument()
})

test('erro que é defeito da obra (tabelas do banco): botão "Corrigir e continuar" manda para a linha, e o erro técnico fica à mão', async () => {
  const user = userEvent.setup()
  const erro: EstadoNoAr = { fase: 'erro', nome: 'ponto', passos: [{ id: 'vistoria', estado: 'feito' }, { id: 'banco', estado: 'erro' }, { id: 'publicar', estado: 'falta' }, { id: 'github', estado: 'falta' }, { id: 'teste', estado: 'falta' }, { id: 'celular', estado: 'falta' }], achados: [], endereco: null, erro: { passo: 'banco', motivo: 'supabase-migrations', detalhe: 'ERROR: relation "public.funcionarios" does not exist (SQLSTATE 42P01)' }, avisos: [] }
  let corrigiu = 0
  montar({ ...criarNoArFixture(), estado: async () => (corrigiu ? { ...erro, fase: 'corrigindo', erro: null } : erro), corrigir: async () => { corrigiu++; return { ...erro, fase: 'corrigindo', erro: null } } })
  await user.click(await screen.findByText('Ver o erro técnico'))
  expect(screen.getByText(/relation "public\.funcionarios" does not exist/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Corrigir e continuar →' }))
  expect(corrigiu).toBe(1)
})

// Achado em 26/11/2026 (Guilherme sem cota do Claude): a tela dizia "defeito do Atlas". Agora diz o que houve e que continua sozinho.
test('cota do Claude acabou durante a publicação: a tela diz que está esperando a cota e que continua sozinho', async () => {
  const passos: EstadoNoAr['passos'] = [{ id: 'vistoria', estado: 'agora' }, { id: 'banco', estado: 'falta' }, { id: 'publicar', estado: 'falta' }, { id: 'github', estado: 'falta' }, { id: 'teste', estado: 'falta' }, { id: 'celular', estado: 'falta' }]
  const esperando: EstadoNoAr = { fase: 'rodando', nome: 'ponto', passos, achados: [], endereco: null, erro: null, avisos: [], esperandoCota: true }
  montar({ ...criarNoArFixture(), estado: async () => esperando })
  expect(await screen.findByText(/A cota do seu plano do Claude acabou por agora/)).toBeInTheDocument()
  expect(screen.getByText(/continua sozinho de onde parou quando a cota renovar/)).toBeInTheDocument()
})

test('cota do Claude que não renovou no prazo: erro explicado (não "defeito do Atlas")', async () => {
  const erro: EstadoNoAr = { fase: 'erro', nome: 'ponto', passos: [{ id: 'vistoria', estado: 'erro' }, { id: 'banco', estado: 'falta' }, { id: 'publicar', estado: 'falta' }, { id: 'github', estado: 'falta' }, { id: 'teste', estado: 'falta' }, { id: 'celular', estado: 'falta' }], achados: [], endereco: null, erro: { passo: 'vistoria', motivo: 'claude-cota' }, avisos: [] }
  montar({ ...criarNoArFixture(), estado: async () => erro })
  expect(await screen.findByText('A cota do seu plano do Claude acabou por agora.')).toBeInTheDocument()
  expect(screen.queryByText(/defeito do Atlas/)).not.toBeInTheDocument()
})

test('publicando: sem bolinha girando; a etapa de agora tem anel, barra com o que faz e %, avanço total, diário e o painel grande opcional', async () => {
  const T = Date.now()
  const estado: EstadoNoAr = {
    fase: 'rodando', nome: 'pontoampla', achados: [], endereco: null, erro: null, avisos: [],
    passos: [{ id: 'vistoria', estado: 'feito' }, { id: 'banco', estado: 'feito' }, { id: 'publicar', estado: 'agora' }, { id: 'github', estado: 'falta' }, { id: 'teste', estado: 'falta' }, { id: 'acesso', estado: 'falta' }, { id: 'celular', estado: 'falta' }],
    sub: { texto: 'Gravando o endereço do banco · 1 de 2', pct: 10, costume: null, inicio: T - 5000, noticia: T - 2000 },
    duracoes: { vistoria: 108_000, banco: 125_000 },
    diario: [{ hora: '2026-11-27T08:40:31Z', texto: 'Banco pronto.' }, { hora: '2026-11-27T08:40:58Z', texto: 'Endereço do banco gravado na Vercel.' }],
  }
  const noAr: PonteNoAr = { ...criarNoArFixture(), estado: async () => structuredClone(estado) }
  const user = userEvent.setup()
  const { container } = montar(noAr)
  expect(await screen.findByRole('progressbar', { name: 'Publicando na sua conta Vercel' })).toHaveAttribute('aria-valuenow', '10')
  expect(screen.getByText('Gravando o endereço do banco · 1 de 2')).toBeInTheDocument()
  expect(screen.getByText(/Última notícia da Vercel há/)).toBeInTheDocument()
  expect(screen.getByText('1 MIN 48 S')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Avanço total' })).toHaveAttribute('aria-valuenow', '30') // 2 de 7 etapas + 10% da terceira
  expect(screen.getByText('05:40:58')).toBeInTheDocument()
  expect(container.querySelector('[class*="gira"]')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Painel de acompanhamento' }))
  const painel = screen.getByRole('region', { name: 'Painel de acompanhamento' })
  expect(painel).toHaveTextContent('Banco pronto.')
  expect(painel).toHaveTextContent('Endereço do banco gravado na Vercel.')
  await user.click(screen.getByRole('button', { name: '← Voltar para a obra' }))
  expect(screen.queryByRole('region', { name: 'Painel de acompanhamento' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Painel de acompanhamento' })).toBeInTheDocument()
})

// Guilherme, 28/11/2026: "não funcionou o reset de senha". A senha do dono é criada aqui, sem e-mail.
test('no ar: o dono cria a senha no próprio Atlas (8 letras, as duas iguais) e vê "Senha criada" com o botão para abrir o sistema', async () => {
  const user = userEvent.setup()
  const noar: EstadoNoAr = { fase: 'noar', nome: 'pontoampla', passos: [], achados: [], endereco: 'https://pontoampla.vercel.app', erro: null, avisos: [], acesso: { email: 'gui@exemplo.com', novo: true, senha: false } }
  const senhas: string[] = []
  montar({ ...criarNoArFixture(), estado: async () => noar, definirSenha: async (_p: string, s: string) => { senhas.push(s); return { ok: true as const } } })
  const card = await screen.findByRole('region', { name: 'Seu acesso' })
  expect(card).toHaveTextContent('gui@exemplo.com')
  expect(card).not.toHaveTextContent('Esqueci minha senha')
  const salvar = within(card).getByRole('button', { name: 'Salvar senha' })
  await user.type(within(card).getByLabelText('Senha'), 'curta')
  expect(salvar).toBeDisabled()
  await user.clear(within(card).getByLabelText('Senha'))
  await user.type(within(card).getByLabelText('Senha'), 'pontodaampla26')
  await user.type(within(card).getByLabelText('Repita a senha'), 'pontodaampla2')
  expect(salvar).toBeDisabled()
  await user.type(within(card).getByLabelText('Repita a senha'), '6')
  await user.click(salvar)
  expect(senhas).toEqual(['pontodaampla26'])
  const ok = await screen.findByRole('region', { name: 'Seu acesso' })
  expect(ok).toHaveTextContent('Senha criada.')
  expect(within(ok).getByRole('link', { name: 'Abrir o sistema ↗' })).toHaveAttribute('href', 'https://pontoampla.vercel.app')
  await user.click(within(ok).getByRole('button', { name: 'Trocar a senha' }))
  expect(screen.getByText('Escolha a nova senha.')).toBeInTheDocument()
})

test('no ar com a senha já criada: mostra direto "Senha criada"; erro ao salvar é explicado', async () => {
  const noar: EstadoNoAr = { fase: 'noar', nome: 'pontoampla', passos: [], achados: [], endereco: 'https://pontoampla.vercel.app', erro: null, avisos: [], acesso: { email: 'gui@exemplo.com', novo: true, senha: true } }
  montar({ ...criarNoArFixture(), estado: async () => noar, definirSenha: async () => { throw new Error('supabase-sem-chave') } })
  const card = await screen.findByRole('region', { name: 'Seu acesso' })
  expect(card).toHaveTextContent('Senha criada.')
  const user = userEvent.setup()
  await user.click(within(card).getByRole('button', { name: 'Trocar a senha' }))
  const c2 = screen.getByRole('region', { name: 'Seu acesso' })
  await user.type(within(c2).getByLabelText('Senha'), 'pontodaampla26')
  await user.type(within(c2).getByLabelText('Repita a senha'), 'pontodaampla26')
  await user.click(within(c2).getByRole('button', { name: 'Salvar senha' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Supabase não está ligada')
})

test('a Vercel bloqueou pelo autor das mudanças: explica sem mandar mexer no GitHub', () => {
  const e = explicarErro('vercel-bloqueado')
  expect(e.frase).toMatch(/não reconheceu quem assinou/)
  expect(e.fazer).toMatch(/não precisa mexer no GitHub/)
})
