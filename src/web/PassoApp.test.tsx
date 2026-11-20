import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { PassoApp } from './PassoApp'
import { criarPersonalizacaoFixture, type PortaPersonalizacao } from './personalizacao'
import type { PortalApi } from './portal-api'

const api = (logado: boolean) => ({ logado: () => logado, sair: () => {} }) as unknown as PortalApi
const montar = (porta: PortaPersonalizacao, logado = true) => render(<TemaProvider><PassoApp api={api(logado)} porta={porta} /></TemaProvider>)

test('logado com app pronto: configurador, salvar e entrega com o nome salvo', async () => {
  const porta = criarPersonalizacaoFixture('barbearia')
  montar(porta)
  await userEvent.type(await screen.findByLabelText('Nome do negócio'), 'Barbearia do Zé')
  await userEvent.click(screen.getByRole('button', { name: /criar o meu app/ }))
  expect(await screen.findByRole('heading', { name: 'O app da Barbearia do Zé está no ar.' })).toBeInTheDocument()
  expect(porta.salvas).toEqual([{ nome_negocio: 'Barbearia do Zé', logo_url: null, cor_principal: '#C6F135', cor_apoio: '#2A3A12' }])
})

test('sem sessão: pede o login antes de mostrar o configurador', async () => {
  montar(criarPersonalizacaoFixture(), false)
  expect(await screen.findByRole('heading', { name: 'Entrar na minha conta' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Nome do negócio')).toBeNull()
})

test('conta sem app pronto (implantação do zero) não vê o configurador', async () => {
  const porta: PortaPersonalizacao = { ler: async () => ({ ok: true, segmento: null, personalizacao: null }), salvar: async () => ({ ok: false, mensagem: 'x' }) }
  montar(porta)
  expect(await screen.findByRole('alert')).toHaveTextContent(/não tem um app pronto/)
  expect(screen.queryByLabelText('Nome do negócio')).toBeNull()
})

test('erro do servidor ao salvar fica no configurador, sem ir para a entrega', async () => {
  const porta: PortaPersonalizacao = { ler: async () => ({ ok: true, segmento: 'mercearia', personalizacao: null }), salvar: async () => ({ ok: false, mensagem: 'Muitas alterações seguidas.' }) }
  montar(porta)
  await userEvent.type(await screen.findByLabelText('Nome do negócio'), 'Mercadinho')
  await userEvent.click(screen.getByRole('button', { name: /criar o meu app/ }))
  await waitFor(() => expect(screen.getByText('Muitas alterações seguidas.')).toBeInTheDocument())
  expect(screen.queryByText(/está no ar/)).toBeNull()
})

test('em produção (fora do modo fixture) a entrega é "preparando": sem app pronto nem link de instalar', async () => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_FIXTURE', '')
  try {
    montar(criarPersonalizacaoFixture('barbearia'))
    await userEvent.type(await screen.findByLabelText('Nome do negócio'), 'Barbearia do Zé')
    await userEvent.click(screen.getByRole('button', { name: /criar o meu app/ }))
    expect(await screen.findByText(/Estamos preparando o seu app/)).toBeInTheDocument()
    expect(screen.queryByText(/está no ar/)).toBeNull()
    expect(screen.queryByRole('link', { name: /Instalar no celular/ })).toBeNull()
    expect(screen.queryByText(/atlas-ia\.app\.br\/?$/)).toBeNull()
    expect(document.body.innerHTML).not.toContain('barbeariadoze')
  } finally {
    vi.unstubAllEnvs()
  }
})
