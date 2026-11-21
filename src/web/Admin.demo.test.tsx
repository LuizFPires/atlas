import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Admin } from './Admin'
import { criarAdminFixture } from './admin-fixture'

const montar = () => render(<TemaProvider><Admin api={criarAdminFixture()} /></TemaProvider>)

describe('painel em modo demonstração', () => {
  it('abre direto (sem login) com KPIs gerenciais e filtra as contas', async () => {
    montar()
    expect(await screen.findByText('Ticket médio')).toBeInTheDocument()
    expect(screen.getByText('Cancelamentos no mês')).toBeInTheDocument()
    expect(screen.getByText('14 contas')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Mostrar'), 'inadimplentes')
    expect(screen.getByText('3 de 14 contas')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar por nome ou empresa'), { target: { value: 'doces' } })
    expect(screen.getByText('1 de 14 contas')).toBeInTheDocument()
  })
  it('a aba Fluxo de caixa mostra a tabela por mês', async () => {
    montar()
    await userEvent.click(await screen.findByRole('link', { name: 'Fluxo de caixa' }))
    expect(await screen.findByRole('img', { name: /Entradas por mês/ })).toBeInTheDocument()
    expect(screen.getByText('Mensalidades')).toBeInTheDocument()
  })
})
