import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clicar, montar, passoDe, quem } from './publicando-teste'
import { criarPublicarFixture, type RegistroDns } from './ponte-publicar'

async function ateODominio() {
  await clicar(/Seu domínio/)
}

test('domínio: 8 passos; o Atlas confere o nome, abre o Registro.br e quem paga/entra é o cliente', async () => {
  const { pub } = montar({ dominio: true })
  await ateODominio()
  expect(await passoDe(1, 8)).toBeInTheDocument()
  expect(await quem()).toBe('O ATLAS')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('cadeira1.com.br está livre.'))
  await clicar('Abrir o site →')
  expect(pub.abertos).toEqual([{ destino: 'registro', dominio: 'cadeira1.com.br' }])
  expect(await passoDe(2, 8)).toBeInTheDocument()
  expect(await quem()).toBe('VOCÊ')
  await clicar('Fiz isso →')
  expect(screen.getByText(/Escolha por quantos anos quer o endereço e pague com Pix/)).toBeInTheDocument()
  expect(await quem()).toBe('VOCÊ')
  expect(screen.getByText(/pagamento é só seu/)).toBeInTheDocument()
})

test('o Atlas LÊ o DNS na hora (porta) e mostra as 2 linhas com Copiar; depois espera a internet reconhecer e avança sozinho', async () => {
  const dns: RegistroDns[] = [{ tipo: 'A', nome: '@', valor: '203.0.113.7' }, { tipo: 'CNAME', nome: 'www', valor: 'alvo.exemplo.com' }]
  const pub = criarPublicarFixture({ dns })
  montar({ dominio: true }, pub)
  await ateODominio()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('livre'))
  await clicar('Abrir o site →')
  for (let i = 0; i < 3; i++) await clicar('Fiz isso →')
  expect(await passoDe(5, 8)).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Linhas prontas para copiar'))
  expect(screen.getByText('203.0.113.7')).toBeInTheDocument()
  expect(screen.getByText('alvo.exemplo.com')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /^Copiar / })).toHaveLength(2)
  await clicar('Fiz isso →')
  expect(await quem()).toBe('VOCÊ')
  await clicar('Fiz isso →')
  expect(await passoDe(7, 8)).toBeInTheDocument()
  expect(await quem()).toBe('O ATLAS')
  expect(screen.getByRole('button', { name: 'Continuar →' })).toBeDisabled()
  await new Promise((r) => setTimeout(r, 40)) // ainda não reconheceu: continua esperando
  expect(screen.getByText('PASSO 7 DE 8')).toBeInTheDocument()
  act(() => pub.simular.reconhecerDns())
  expect(await passoDe(8, 8)).toBeInTheDocument()
  expect(screen.getByText(/cadeira1.com.br está no ar/)).toBeInTheDocument()
})

test('nome ocupado: avisa, trava o passo e deixa o cliente falar/digitar outro nome', async () => {
  const pub = criarPublicarFixture({ ocupados: ['cadeira1.com.br'] })
  montar({ dominio: true }, pub)
  await ateODominio()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('já tem dono'))
  expect(screen.getByRole('button', { name: 'Abrir o site →' })).toBeDisabled()
  const campo = screen.getByLabelText(/Outro nome para o endereço/)
  await userEvent.clear(campo)
  await userEvent.type(campo, 'Cadeira Dois')
  expect(screen.getByText('Vai ficar assim: cadeiradois.com.br')).toBeInTheDocument()
  await clicar('Conferir de novo')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('cadeiradois.com.br está livre.'))
  await clicar('Abrir o site →')
  expect(pub.abertos[0]).toEqual({ destino: 'registro', dominio: 'cadeiradois.com.br' })
})

test('se não deu para ler o DNS, avisa com calma e não deixa seguir com linhas inventadas', async () => {
  const pub = criarPublicarFixture()
  pub.lerDns = async () => { throw new Error('x') }
  montar({ dominio: true }, pub)
  await ateODominio()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('livre'))
  await clicar('Abrir o site →')
  for (let i = 0; i < 3; i++) await clicar('Fiz isso →')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Não consegui ler o que a Vercel pede/))
  expect(screen.getByRole('button', { name: 'Fiz isso →' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: /^Copiar / })).toBeNull()
})

test('o app também valida o DNS que a porta devolve: linha inválida não é mostrada para copiar', async () => {
  const pub = criarPublicarFixture()
  pub.lerDns = async () => [{ tipo: 'A', nome: '@', valor: '10.0.0.1' }, { tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' }]
  montar({ dominio: true }, pub)
  await ateODominio()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('livre'))
  await clicar('Abrir o site →')
  for (let i = 0; i < 3; i++) await clicar('Fiz isso →')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/não parece certa/))
  expect(screen.queryByText(/10\.0\.0\.1/)).toBeNull()
})
