// M33 — o app do Atlas no celular: o projeto inteiro e o acompanhamento da obra, com o notebook do escritório trabalhando.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppCelular } from './AppCelular'
import { criarApiCelularFixture } from './api'

const relato = 'Tenho uma barbearia com 3 cadeiras e a agenda vive dando horário duplicado.'

test('entrar com o e-mail da compra e o código que chegou no e-mail', async () => {
  const api = criarApiCelularFixture({ logado: false })
  render(<AppCelular api={api} intervalo={20} />)
  await userEvent.type(screen.getByLabelText('E-mail da sua compra'), 'ze@barbearia.com')
  await userEvent.click(screen.getByRole('button', { name: 'Receber o código' }))
  await userEvent.type(await screen.findByLabelText('Código que chegou no e-mail'), '482071')
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByRole('heading', { name: 'Minhas obras' })).toBeInTheDocument()
})

// Guilherme, 24/11/2026: o e-mail chegou com um código de 8 números e o botão Entrar não aceitava ("pede um código de 6").
// O tamanho do código é o que o e-mail trouxer (6 a 8 números); a tela não promete um número de dígitos.
test('código de 8 números (o que chegou no e-mail) também entra', async () => {
  const api = criarApiCelularFixture({ logado: false })
  render(<AppCelular api={api} intervalo={20} />)
  await userEvent.type(screen.getByLabelText('E-mail da sua compra'), 'guilherme@amplaconstrutora.com.br')
  await userEvent.click(screen.getByRole('button', { name: 'Receber o código' }))
  expect(screen.queryByText(/6 números/)).toBeNull()
  await userEvent.type(await screen.findByLabelText('Código que chegou no e-mail'), '67056795')
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByRole('heading', { name: 'Minhas obras' })).toBeInTheDocument()
})

test('Minhas obras: estado do notebook e as abas Em andamento, Concluídas, Paradas e Excluídas', async () => {
  render(<AppCelular api={criarApiCelularFixture()} intervalo={20} />)
  expect(await screen.findByText(/Ligado · Atlas aberto/)).toBeInTheDocument()
  expect(await screen.findByText('Agenda da Barbearia')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: /Concluídas/ }))
  expect(screen.getByText('Orçamentos rápidos')).toBeInTheDocument()
  expect(screen.queryByText('Agenda da Barbearia')).toBeNull()
  await userEvent.click(screen.getByRole('tab', { name: /Paradas/ }))
  expect(screen.getByText(/Nenhuma obra parada/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: /Excluídas/ }))
  expect(screen.getByText(/Nenhuma obra excluída/)).toBeInTheDocument()
})

test('do celular: ideia, visual, telas surgindo, ajuste, nome e deixar o Atlas construir', async () => {
  const api = criarApiCelularFixture()
  render(<AppCelular api={api} intervalo={20} />)
  await userEvent.click(await screen.findByRole('button', { name: /Começar uma obra nova/ }))
  // Etapa 1: a ideia (falada ou escrita).
  expect(screen.getByText(/Etapa 1 de 3/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Digitar em vez de falar' }))
  await userEvent.type(screen.getByLabelText(/O que o Atlas escreveu/), relato)
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  // Etapa 2: o visual.
  expect(screen.getByText(/Etapa 2 de 3/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /O Atlas sugere 3 estilos/ }))
  await userEvent.click(screen.getByRole('button', { name: /Mandar o notebook desenhar/ }))
  expect(api.pedidos[0]).toMatchObject({ tipo: 'obra_nova', dados: { relato, visual: { modo: 'sugere' } } })
  // O notebook desenha: o mapa de telas aparece e as telas ficam prontas.
  expect(await screen.findByRole('heading', { name: /desenhando as telas/ })).toBeInTheDocument()
  expect(await screen.findByTitle(/Protótipo/, {}, { timeout: 3000 })).toBeInTheDocument()
  // Ajuste falado (aqui, escrito na barra de baixo).
  await userEvent.type(screen.getByLabelText('Peça um ajuste'), 'deixa o botão de marcar maior')
  await userEvent.click(screen.getByRole('button', { name: 'Mandar o ajuste' }))
  expect(api.pedidos[1]).toMatchObject({ tipo: 'ajuste', dados: { texto: 'deixa o botão de marcar maior' } })
  // Aprovar as telas: o notebook pensa em 3 nomes.
  await userEvent.click(await screen.findByRole('button', { name: 'Aprovar' }, { timeout: 3000 }))
  expect(await screen.findByText(/Etapa 3 de 3/, {}, { timeout: 3000 })).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: /^Navalha/ }, { timeout: 3000 }))
  await userEvent.click(screen.getByRole('button', { name: 'Usar “Navalha”' }))
  expect(api.pedidos[3]).toMatchObject({ tipo: 'nome', dados: { nome: 'Navalha' } })
  // Deixar o Atlas construir.
  await userEvent.click(await screen.findByRole('button', { name: /Deixar o Atlas construir/ }, { timeout: 3000 }))
  expect(api.pedidos[4]).toMatchObject({ tipo: 'construir', dados: { modo: 'auto' } })
  expect(await screen.findByRole('button', { name: 'Pausar' })).toBeInTheDocument()
})

test('notebook desligado: o celular avisa, guarda o pedido e explica como voltar', async () => {
  const api = criarApiCelularFixture({ ligado: false })
  render(<AppCelular api={api} intervalo={20} />)
  const aviso = await screen.findByRole('button', { name: /Notebook do escritório/ })
  expect(within(aviso).getByText(/Desligado/)).toBeInTheDocument()
  await userEvent.click(aviso)
  expect(screen.getByRole('heading', { name: /está desligado/ })).toBeInTheDocument()
  expect(screen.getByText(/O Atlas abre sozinho/)).toBeInTheDocument()
})

test('acompanhar a obra e pausar pelo celular', async () => {
  const api = criarApiCelularFixture()
  render(<AppCelular api={api} intervalo={20} />)
  await userEvent.click(await screen.findByRole('button', { name: /Agenda da Barbearia/ }))
  expect(screen.getByText('62%')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Pausar' }))
  expect(api.pedidos[0]).toMatchObject({ tipo: 'pausar', obra_id: 'o1' })
})
