import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Ajuda } from './Ajuda'
import { criarAjudaFixture, type ContextoAjuda, type PonteAjuda } from './ponte-ajuda'
import { criarCasosFixture, montarCaso, tirarSegredos, type PonteCasosAdmin } from './ponte-ajuda-casos'

const ctx: ContextoAjuda = { origem: 'erro', onde: 'a publicação', erro: { titulo: 'Algo deu errado ao publicar.', detalhe: 'token ghp_abcdefghijklmnop1234 falhou' }, print: { url: 'vercel.com/new?code=segredo123', titulo: 'Error: Repository not found' } }
const digitar = (t: string) => userEvent.type(screen.getByLabelText('Mensagem para a Ajuda do Atlas'), `${t}{enter}`)

test('o caso nunca leva segredo, e-mail nem parâmetros de endereço', () => {
  const c = montarCaso({ ...ctx, passo: { origem: 'F13b', conta: 'Endereço grátis', passo: 3, totalPassos: 5, print: { url: 'x', titulo: 'y' } } }, [{ de: 'cliente', texto: 'minha senha: abc123 e meu email ze@x.com, Bearer eyJhbGciOiJIUzI1NiJ9.abcdefghij' }], 'ainda-nao-deu')
  expect(c.tipo).toBe('ajuda_nao_resolvida')
  expect(c.descricao).toContain('Passo: 3 de 5 (Endereço grátis)')
  expect(c.descricao).toContain('Repository not found')
  for (const proibido of ['ghp_abcdef', 'abc123', 'ze@x.com', 'eyJhbG', 'segredo123']) expect(c.descricao).not.toContain(proibido)
  expect(tirarSegredos('https://a.com/p?token=zzz')).not.toContain('zzz')
})

test('"Ainda não deu" duas vezes manda UM caso ao painel do administrador, sem prometer gente', async () => {
  const casos = criarCasosFixture()
  render(<TemaProvider><Ajuda ajuda={criarAjudaFixture()} casos={casos} contexto={ctx} onFechar={() => {}} /></TemaProvider>)
  await digitar('Apareceu o vermelho')
  await userEvent.click((await screen.findAllByRole('button', { name: 'Ainda não deu' })).at(-1)!)
  await screen.findByText(/Vamos por outro caminho/)
  expect(casos.enviados).toHaveLength(0)
  await userEvent.click(screen.getAllByRole('button', { name: 'Ainda não deu' }).at(-1)!)
  expect(await screen.findByText(/Anotei o seu caso/)).toBeInTheDocument()
  expect(casos.enviados).toHaveLength(1)
  expect(casos.enviados[0].descricao).toContain('Cliente disse: Apareceu o vermelho')
  expect(document.body.textContent).not.toMatch(/atendente|falar com alguém|nossa equipe|suporte humano/i)
})

test('o Claude sem saída (naoResolvido) também vai ao painel', async () => {
  const casos = criarCasosFixture()
  const ajuda: PonteAjuda = { ...criarAjudaFixture(), conversar: async () => ({ texto: 'Não achei o motivo ainda.', naoResolvido: true }) }
  render(<TemaProvider><Ajuda ajuda={ajuda} casos={casos} contexto={ctx} onFechar={() => {}} /></TemaProvider>)
  await digitar('nada funciona')
  await screen.findByText(/Anotei o seu caso/)
  expect(casos.enviados).toHaveLength(1)
  expect(casos.enviados[0].descricao).toContain('o Atlas não achou saída')
})

test('fechar a conversa sem resolver manda o caso; "deu certo" não manda; sem conversa não manda', async () => {
  const casos = criarCasosFixture()
  const { unmount } = render(<TemaProvider><Ajuda ajuda={criarAjudaFixture()} casos={casos} contexto={ctx} onFechar={() => {}} /></TemaProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Fechar a Ajuda' }))
  expect(casos.enviados).toHaveLength(0)
  await digitar('oi')
  await screen.findByText(/Achei o problema/)
  await userEvent.click(screen.getByRole('button', { name: 'Fechar a Ajuda' }))
  expect(casos.enviados).toHaveLength(1)
  unmount()
  const c2 = criarCasosFixture()
  render(<TemaProvider><Ajuda ajuda={criarAjudaFixture()} casos={c2} contexto={ctx} onFechar={() => {}} /></TemaProvider>)
  await digitar('oi')
  await userEvent.click(await screen.findByRole('button', { name: /Fiz, deu certo/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Fechar a Ajuda' }))
  expect(c2.enviados).toHaveLength(0)
})

test('se o envio ao painel falha, não finge que anotou', async () => {
  const casos: PonteCasosAdmin = { enviar: async () => { throw new Error('x') } }
  const ajuda: PonteAjuda = { ...criarAjudaFixture(), conversar: async () => ({ texto: 'Sem saída.', naoResolvido: true }) }
  render(<TemaProvider><Ajuda ajuda={ajuda} casos={casos} contexto={ctx} onFechar={() => {}} /></TemaProvider>)
  await digitar('x')
  await screen.findByText('Sem saída.')
  expect(screen.queryByText(/Anotei o seu caso/)).not.toBeInTheDocument()
})
